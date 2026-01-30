"""
Powercast AI - Forecast Event Logger
Immutable logging of all forecast events for the learning memory system.

This module instruments the ML inference pipeline to capture:
- Every forecast generated
- Input features used
- Model metadata
- Timestamps and region context

CRITICAL: This is READ-ONLY logging. It does NOT modify forecast outputs.
"""

import uuid
import logging
from datetime import datetime
from typing import Dict, Any, Optional, List
from dataclasses import dataclass, asdict
import json

logger = logging.getLogger(__name__)


# =============================================================================
# DATA MODELS
# =============================================================================

@dataclass
class ForecastEvent:
    """Immutable record of a forecast generation event."""
    forecast_id: str
    region_code: str
    model_version: str
    forecast_start: datetime
    horizon_hours: int
    predictions: Dict[str, Any]  # {timestamps, point, q10, q90}
    input_features: Optional[Dict[str, Any]] = None
    metadata: Optional[Dict[str, Any]] = None
    created_at: Optional[datetime] = None
    
    def to_db_dict(self) -> Dict[str, Any]:
        """Convert to database-ready dictionary."""
        return {
            "forecast_id": self.forecast_id,
            "region_code": self.region_code,
            "model_version": self.model_version,
            "forecast_start": self.forecast_start.isoformat() if self.forecast_start else None,
            "horizon_hours": self.horizon_hours,
            "predictions": self.predictions,
            "input_features": self.input_features,
            "metadata": self.metadata or {},
        }


# =============================================================================
# FORECAST LOGGER SERVICE
# =============================================================================

class ForecastLogger:
    """
    Service for logging forecast events to the learning memory database.
    
    Thread-safe, non-blocking logging that does not impact forecast latency.
    Falls back to local logging if database is unavailable.
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
        self._fallback_logs: List[ForecastEvent] = []
        self._max_fallback_logs = 1000
        self._initialized = True
        
        # Try to initialize Supabase connection
        self._init_database()
    
    def _init_database(self):
        """Initialize Supabase connection."""
        try:
            from app.core.supabase import get_supabase_admin
            self._supabase = get_supabase_admin()
            if self._supabase:
                logger.info("ForecastLogger: Connected to Supabase")
            else:
                logger.warning("ForecastLogger: Supabase not configured, using fallback logging")
        except Exception as e:
            logger.warning(f"ForecastLogger: Could not connect to database: {e}")
    
    def log_forecast(
        self,
        region_code: str,
        model_version: str,
        forecast_start: datetime,
        horizon_hours: int,
        predictions: Dict[str, Any],
        input_features: Optional[Dict[str, Any]] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> str:
        """
        Log a forecast event.
        
        Args:
            region_code: Region code (e.g., 'SWISS_GRID', 'SOUTH_TN_TNEB')
            model_version: Version identifier of the model used
            forecast_start: Start timestamp of the forecast
            horizon_hours: Forecast horizon in hours
            predictions: Dict with timestamps, point, q10, q90 arrays
            input_features: Optional feature vector used for prediction
            metadata: Optional additional metadata
            
        Returns:
            Unique forecast_id for this event
        """
        # Generate unique forecast ID
        forecast_id = f"fc_{region_code}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}"
        
        event = ForecastEvent(
            forecast_id=forecast_id,
            region_code=region_code,
            model_version=model_version,
            forecast_start=forecast_start,
            horizon_hours=horizon_hours,
            predictions=predictions,
            input_features=input_features,
            metadata=metadata,
            created_at=datetime.utcnow(),
        )
        
        # Try to log to database
        if self._supabase:
            try:
                self._log_to_database(event)
                logger.debug(f"Logged forecast event: {forecast_id}")
            except Exception as e:
                logger.error(f"Failed to log to database: {e}")
                self._log_fallback(event)
        else:
            self._log_fallback(event)
        
        return forecast_id
    
    def _log_to_database(self, event: ForecastEvent):
        """Insert event into Supabase."""
        self._supabase.table("forecast_events").insert(event.to_db_dict()).execute()
    
    def _log_fallback(self, event: ForecastEvent):
        """Store event in local fallback list."""
        self._fallback_logs.append(event)
        
        # Trim if too many logs accumulated
        if len(self._fallback_logs) > self._max_fallback_logs:
            self._fallback_logs = self._fallback_logs[-self._max_fallback_logs:]
        
        # Also log to standard logger for debugging
        logger.info(f"[FALLBACK] Forecast event: {event.forecast_id} for {event.region_code}")
    
    def get_recent_forecasts(
        self,
        region_code: str,
        limit: int = 10,
        hours_back: int = 24,
    ) -> List[Dict[str, Any]]:
        """
        Retrieve recent forecast events for a region.
        
        Args:
            region_code: Filter by region
            limit: Maximum number of events to return
            hours_back: How far back to look (in hours)
            
        Returns:
            List of forecast event dictionaries
        """
        if not self._supabase:
            # Return from fallback logs
            return [
                asdict(e) for e in self._fallback_logs[-limit:]
                if e.region_code == region_code
            ]
        
        try:
            cutoff = datetime.utcnow().replace(microsecond=0).isoformat()
            result = (
                self._supabase.table("forecast_events")
                .select("*")
                .eq("region_code", region_code)
                .order("created_at", desc=True)
                .limit(limit)
                .execute()
            )
            return result.data or []
        except Exception as e:
            logger.error(f"Failed to query forecast events: {e}")
            return []
    
    def get_forecast_by_id(self, forecast_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve a specific forecast event by ID."""
        if not self._supabase:
            for event in self._fallback_logs:
                if event.forecast_id == forecast_id:
                    return asdict(event)
            return None
        
        try:
            result = (
                self._supabase.table("forecast_events")
                .select("*")
                .eq("forecast_id", forecast_id)
                .single()
                .execute()
            )
            return result.data
        except Exception as e:
            logger.error(f"Failed to get forecast {forecast_id}: {e}")
            return None
    
    def flush_fallback_logs(self) -> int:
        """
        Attempt to flush fallback logs to database.
        
        Returns:
            Number of events successfully flushed
        """
        if not self._supabase or not self._fallback_logs:
            return 0
        
        flushed = 0
        remaining = []
        
        for event in self._fallback_logs:
            try:
                self._log_to_database(event)
                flushed += 1
            except Exception:
                remaining.append(event)
        
        self._fallback_logs = remaining
        logger.info(f"Flushed {flushed} fallback logs to database")
        return flushed
    
    def health_check(self) -> Dict[str, Any]:
        """Check logger health status."""
        return {
            "database_connected": self._supabase is not None,
            "fallback_log_count": len(self._fallback_logs),
            "status": "healthy" if self._supabase else "degraded",
        }


# =============================================================================
# GLOBAL INSTANCE
# =============================================================================

_forecast_logger: Optional[ForecastLogger] = None


def get_forecast_logger() -> ForecastLogger:
    """Get or create the forecast logger singleton."""
    global _forecast_logger
    if _forecast_logger is None:
        _forecast_logger = ForecastLogger()
    return _forecast_logger
