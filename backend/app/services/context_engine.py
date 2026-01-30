"""
Powercast AI - Context Engine (RAG)
Retrieval-Augmented Generation for contextual forecast analysis.

This module:
- Ingests external context (weather bulletins, grid notices, events)
- Creates vector embeddings using Gemini text-embedding-004
- Stores embeddings in Supabase pgvector
- Retrieves similar historical contexts for learning

Dependencies: google-generativeai, supabase, numpy
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
from dataclasses import dataclass
import json
import os

import numpy as np

logger = logging.getLogger(__name__)


# =============================================================================
# CONFIGURATION
# =============================================================================

GEMINI_EMBEDDING_MODEL = "models/text-embedding-004"
EMBEDDING_DIMENSIONS = 768  # text-embedding-004 output dimensions


# =============================================================================
# DATA MODELS
# =============================================================================

@dataclass
class ContextSnapshot:
    """Context captured at the time of a forecast error."""
    forecast_error_id: str
    region_code: str
    time_window_start: datetime
    time_window_end: datetime
    weather_context: Optional[Dict[str, Any]] = None
    grid_notices: Optional[List[Dict[str, Any]]] = None
    event_context: Optional[Dict[str, Any]] = None
    context_summary: Optional[str] = None
    embedding: Optional[List[float]] = None
    
    def to_db_dict(self) -> Dict[str, Any]:
        """Convert to database-ready dictionary."""
        return {
            "forecast_error_id": self.forecast_error_id,
            "region_code": self.region_code,
            "time_window_start": self.time_window_start.isoformat(),
            "time_window_end": self.time_window_end.isoformat(),
            "weather_context": self.weather_context,
            "grid_notices": self.grid_notices,
            "event_context": self.event_context,
            "context_summary": self.context_summary,
            "embedding": self.embedding,
        }
    
    def to_text(self) -> str:
        """Convert context to text for embedding."""
        parts = [f"Region: {self.region_code}"]
        
        if self.weather_context:
            weather = self.weather_context
            parts.append(f"Weather: {weather.get('condition', 'unknown')}, "
                        f"temp={weather.get('temperature', 'N/A')}°C, "
                        f"humidity={weather.get('humidity', 'N/A')}%, "
                        f"wind={weather.get('wind_speed', 'N/A')} m/s")
        
        if self.grid_notices:
            for notice in self.grid_notices[:3]:  # Limit to first 3
                parts.append(f"Grid Notice: {notice.get('type', 'unknown')} - {notice.get('message', '')}")
        
        if self.event_context:
            events = self.event_context
            if events.get('holidays'):
                parts.append(f"Holidays: {', '.join(events['holidays'])}")
            if events.get('special_events'):
                parts.append(f"Events: {', '.join(events['special_events'])}")
        
        return ". ".join(parts)


@dataclass
class SimilarContext:
    """Result from similarity search."""
    snapshot_id: str
    lesson_id: Optional[str]
    failure_cause: Optional[str]
    context_signature: Optional[List[str]]
    generalized_rule: Optional[str]
    similarity: float
    llm_confidence: Optional[float]


# =============================================================================
# CONTEXT ENGINE SERVICE
# =============================================================================

class ContextEngine:
    """
    RAG-based context retrieval and embedding service.
    
    Uses Gemini for embeddings and Supabase pgvector for similarity search.
    Integrates with external_apis.py for weather and grid context.
    """
    
    _instance = None
    _initialized = False
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        if self._initialized:
            return
        
        self._supabase = None
        self._genai = None
        self._embedding_model = None
        self._initialized = True
        
        self._init_services()
    
    def _init_services(self):
        """Initialize Supabase and Gemini connections."""
        # Initialize Supabase
        try:
            from app.core.supabase import get_supabase_admin
            self._supabase = get_supabase_admin()
            if self._supabase:
                logger.info("ContextEngine: Connected to Supabase")
        except Exception as e:
            logger.warning(f"ContextEngine: Could not connect to Supabase: {e}")
        
        # Initialize Gemini
        try:
            import google.generativeai as genai
            api_key = os.getenv("GOOGLE_GENERATIVE_AI_API_KEY")
            if api_key:
                genai.configure(api_key=api_key)
                self._genai = genai
                logger.info("ContextEngine: Gemini API configured")
            else:
                logger.warning("ContextEngine: GOOGLE_GENERATIVE_AI_API_KEY not set")
        except Exception as e:
            logger.warning(f"ContextEngine: Could not initialize Gemini: {e}")
    
    async def create_context_snapshot(
        self,
        forecast_error_id: str,
        region_code: str,
        time_window_start: datetime,
        time_window_end: datetime,
    ) -> Optional[ContextSnapshot]:
        """
        Create a context snapshot for a forecast error.
        
        Gathers weather, grid, and event context for the specified time window.
        Creates embedding and stores in database.
        
        Args:
            forecast_error_id: UUID of the forecast error
            region_code: Region code
            time_window_start: Start of context window
            time_window_end: End of context window
            
        Returns:
            Created ContextSnapshot or None if failed
        """
        try:
            # Gather context from various sources
            weather_context = await self._get_weather_context(region_code, time_window_start)
            grid_notices = await self._get_grid_notices(region_code, time_window_start, time_window_end)
            event_context = self._get_event_context(time_window_start, time_window_end)
            
            # Create snapshot
            snapshot = ContextSnapshot(
                forecast_error_id=forecast_error_id,
                region_code=region_code,
                time_window_start=time_window_start,
                time_window_end=time_window_end,
                weather_context=weather_context,
                grid_notices=grid_notices,
                event_context=event_context,
            )
            
            # Generate summary
            snapshot.context_summary = self._generate_summary(snapshot)
            
            # Create embedding
            embedding = await self._create_embedding(snapshot.to_text())
            if embedding:
                snapshot.embedding = embedding
            
            # Store in database
            if self._supabase:
                self._store_snapshot(snapshot)
            
            logger.info(f"Created context snapshot for error {forecast_error_id}")
            return snapshot
            
        except Exception as e:
            logger.error(f"Failed to create context snapshot: {e}")
            return None
    
    async def _get_weather_context(
        self,
        region_code: str,
        timestamp: datetime,
    ) -> Dict[str, Any]:
        """Fetch weather context from external API or history."""
        try:
            from app.services.external_apis import get_weather_service
            
            # Get coordinates for region (simplified mapping)
            region_coords = {
                "SWISS_GRID": (47.3769, 8.5417),  # Zurich
                "SOUTH_TN_TNEB": (13.0827, 80.2707),  # Chennai
                "DEFAULT": (47.3769, 8.5417),
            }
            lat, lon = region_coords.get(region_code, region_coords["DEFAULT"])
            
            weather_service = get_weather_service()
            weather = await weather_service.get_current_weather(lat, lon)
            
            # Extract relevant fields
            return {
                "temperature": weather.get("temperature"),
                "humidity": weather.get("humidity"),
                "wind_speed": weather.get("wind_speed"),
                "cloud_cover": weather.get("cloud_cover"),
                "condition": self._classify_weather_condition(weather),
                "irradiance": weather.get("irradiance"),
            }
        except Exception as e:
            logger.warning(f"Could not fetch weather context: {e}")
            return {}
    
    def _classify_weather_condition(self, weather: Dict[str, Any]) -> str:
        """Classify weather into simple condition string."""
        temp = weather.get("temperature", 20)
        clouds = weather.get("cloud_cover", 50)
        wind = weather.get("wind_speed", 5)
        
        conditions = []
        
        if temp and temp > 35:
            conditions.append("heatwave")
        elif temp and temp < 5:
            conditions.append("cold_snap")
        
        if clouds and clouds < 20:
            conditions.append("clear_sky")
        elif clouds and clouds > 80:
            conditions.append("overcast")
        
        if wind and wind > 15:
            conditions.append("windy")
        
        return ", ".join(conditions) if conditions else "normal"
    
    async def _get_grid_notices(
        self,
        region_code: str,
        start_time: datetime,
        end_time: datetime,
    ) -> List[Dict[str, Any]]:
        """Fetch grid notices for the time window."""
        # For now, return empty (grid notices would come from operator input or API)
        # In production, this would query a grid notices database
        return []
    
    def _get_event_context(
        self,
        start_time: datetime,
        end_time: datetime,
    ) -> Dict[str, Any]:
        """Get event context (holidays, special events)."""
        events = {
            "is_weekend": start_time.weekday() >= 5,
            "day_of_week": start_time.strftime("%A"),
            "hour_of_day": start_time.hour,
            "holidays": [],
            "special_events": [],
        }
        
        # Simple holiday detection (would be enhanced with proper calendar)
        month_day = (start_time.month, start_time.day)
        holidays_map = {
            (1, 1): "New Year",
            (8, 15): "Independence Day (India)",
            (12, 25): "Christmas",
        }
        if month_day in holidays_map:
            events["holidays"].append(holidays_map[month_day])
        
        return events
    
    def _generate_summary(self, snapshot: ContextSnapshot) -> str:
        """Generate human-readable summary of context."""
        parts = []
        
        if snapshot.weather_context:
            weather = snapshot.weather_context
            parts.append(f"Weather: {weather.get('condition', 'normal')} "
                        f"({weather.get('temperature', 'N/A')}°C)")
        
        if snapshot.event_context:
            events = snapshot.event_context
            if events.get("is_weekend"):
                parts.append("Weekend")
            else:
                parts.append(events.get("day_of_week", ""))
        
        if snapshot.grid_notices:
            parts.append(f"{len(snapshot.grid_notices)} grid notices")
        
        return ", ".join(parts) if parts else "No significant context"
    
    async def _create_embedding(self, text: str) -> Optional[List[float]]:
        """Create embedding vector using Gemini."""
        if not self._genai:
            logger.warning("Gemini not available for embedding creation")
            return None
        
        try:
            result = self._genai.embed_content(
                model=GEMINI_EMBEDDING_MODEL,
                content=text,
            )
            embedding = result["embedding"]
            logger.debug(f"Created embedding with {len(embedding)} dimensions")
            return embedding
        except Exception as e:
            logger.error(f"Failed to create embedding: {e}")
            return None
    
    def _store_snapshot(self, snapshot: ContextSnapshot):
        """Store context snapshot in database."""
        try:
            data = snapshot.to_db_dict()
            # Convert embedding list to proper format for pgvector
            if data.get("embedding"):
                data["embedding"] = data["embedding"]  # pgvector handles list
            
            self._supabase.table("context_snapshots").insert(data).execute()
        except Exception as e:
            logger.error(f"Failed to store context snapshot: {e}")
    
    async def find_similar_contexts(
        self,
        query_text: str,
        region_code: str,
        limit: int = 5,
        similarity_threshold: float = 0.7,
    ) -> List[SimilarContext]:
        """
        Find similar historical contexts using vector similarity.
        
        Args:
            query_text: Text describing current context
            region_code: Region to search within
            limit: Maximum results to return
            similarity_threshold: Minimum similarity score
            
        Returns:
            List of similar contexts with lessons
        """
        # Create embedding for query
        query_embedding = await self._create_embedding(query_text)
        if not query_embedding:
            return []
        
        if not self._supabase:
            return []
        
        try:
            # Use the database function for similarity search
            result = self._supabase.rpc(
                "find_similar_contexts",
                {
                    "query_embedding": query_embedding,
                    "match_region": region_code,
                    "match_count": limit,
                    "similarity_threshold": similarity_threshold,
                }
            ).execute()
            
            similar = []
            for row in result.data or []:
                similar.append(SimilarContext(
                    snapshot_id=row["snapshot_id"],
                    lesson_id=row.get("lesson_id"),
                    failure_cause=row.get("failure_cause"),
                    context_signature=row.get("context_signature"),
                    generalized_rule=row.get("generalized_rule"),
                    similarity=row["similarity"],
                    llm_confidence=row.get("llm_confidence"),
                ))
            
            return similar
            
        except Exception as e:
            logger.error(f"Failed to find similar contexts: {e}")
            return []
    
    async def find_applicable_lessons(
        self,
        weather_context: Dict[str, Any],
        region_code: str,
        event_context: Optional[Dict[str, Any]] = None,
    ) -> List[SimilarContext]:
        """
        Find lessons that might apply to current forecast context.
        
        This is called BEFORE generating a forecast to find applicable rules.
        
        Args:
            weather_context: Current weather conditions
            region_code: Region being forecasted
            event_context: Optional event/holiday context
            
        Returns:
            List of applicable lessons with similarity scores
        """
        # Build context text
        parts = [f"Region: {region_code}"]
        
        if weather_context:
            condition = self._classify_weather_condition(weather_context)
            parts.append(f"Weather: {condition}")
            if weather_context.get("temperature"):
                parts.append(f"Temperature: {weather_context['temperature']}°C")
        
        if event_context:
            if event_context.get("is_weekend"):
                parts.append("Weekend")
            if event_context.get("holidays"):
                parts.append(f"Holidays: {', '.join(event_context['holidays'])}")
        
        query_text = ". ".join(parts)
        
        return await self.find_similar_contexts(
            query_text,
            region_code,
            limit=3,
            similarity_threshold=0.6,
        )
    
    def health_check(self) -> Dict[str, Any]:
        """Check context engine health."""
        return {
            "supabase_connected": self._supabase is not None,
            "gemini_configured": self._genai is not None,
            "embedding_model": GEMINI_EMBEDDING_MODEL,
            "status": "healthy" if (self._supabase and self._genai) else "degraded",
        }


# =============================================================================
# GLOBAL INSTANCE
# =============================================================================

_context_engine: Optional[ContextEngine] = None


def get_context_engine() -> ContextEngine:
    """Get or create the context engine singleton."""
    global _context_engine
    if _context_engine is None:
        _context_engine = ContextEngine()
    return _context_engine
