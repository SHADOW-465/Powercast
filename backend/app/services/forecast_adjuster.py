"""
Powercast AI - Forecast Adjuster
Post-forecast adjustment layer for context-aware corrections.

This module is inserted AFTER base ML forecast and BEFORE API response.
It orchestrates the learning memory system to apply learned rules.

Flow:
1. Base ML model generates forecast (ml_inference.py)
2. Forecast is logged (forecast_logger.py)
3. Context engine finds applicable lessons (context_engine.py)
4. Rule engine applies safe adjustments (rule_engine.py)
5. Adjusted forecast returned with full explanation

CRITICAL: This layer is additive and can be disabled via feature flag.
"""

import logging
from datetime import datetime
from typing import Dict, Any, Optional, List
from dataclasses import dataclass, asdict
import os

logger = logging.getLogger(__name__)


# =============================================================================
# CONFIGURATION
# =============================================================================

# Feature flag to enable/disable adjustments
ENABLE_ADJUSTMENTS = os.getenv("ENABLE_ADJUSTMENTS", "true").lower() == "true"

# Feature flag to enable learning (error observation)
ENABLE_LEARNING = os.getenv("ENABLE_LEARNING", "true").lower() == "true"


# =============================================================================
# DATA MODELS
# =============================================================================

@dataclass
class AdjustmentMetadata:
    """Metadata about adjustments applied to a forecast."""
    adjusted: bool
    original_predictions: Optional[List[float]] = None
    total_adjustment_pct: float = 0.0
    applied_rules_count: int = 0
    applied_rules: Optional[List[Dict[str, Any]]] = None
    explanation: str = ""
    adjustment_confidence: float = 1.0
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to API-friendly dictionary."""
        return {
            "adjusted": self.adjusted,
            "total_adjustment_pct": self.total_adjustment_pct,
            "applied_rules_count": self.applied_rules_count,
            "explanation": self.explanation,
            "adjustment_confidence": self.adjustment_confidence,
            "applied_rules": self.applied_rules or [],
        }


# =============================================================================
# FORECAST ADJUSTER SERVICE
# =============================================================================

class ForecastAdjuster:
    """
    Orchestrator for the closed-loop learning and adjustment system.
    
    Integrates:
    - ForecastLogger: Logs every forecast for learning
    - ContextEngine: Finds applicable lessons
    - RuleEngine: Applies safe adjustments
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
        
        self._forecast_logger = None
        self._context_engine = None
        self._rule_engine = None
        self._initialized = True
        
        self._init_services()
    
    def _init_services(self):
        """Initialize dependent services."""
        try:
            from app.services.forecast_logger import get_forecast_logger
            from app.services.context_engine import get_context_engine
            from app.services.rule_engine import get_rule_engine
            
            self._forecast_logger = get_forecast_logger()
            self._context_engine = get_context_engine()
            self._rule_engine = get_rule_engine()
            
            logger.info(f"ForecastAdjuster initialized (adjustments={ENABLE_ADJUSTMENTS}, learning={ENABLE_LEARNING})")
        except Exception as e:
            logger.error(f"ForecastAdjuster: Failed to initialize services: {e}")
    
    async def adjust_forecast(
        self,
        forecast: Dict[str, Any],
        region_code: str,
        model_version: str = "1.0.0",
    ) -> Dict[str, Any]:
        """
        Process a forecast through the adjustment pipeline.
        
        Args:
            forecast: Base forecast from ML model
            region_code: Region code for context lookup
            model_version: Version of the ML model
            
        Returns:
            Enhanced forecast with adjustment metadata
        """
        # Extract predictions
        predictions = forecast.get("predictions", [])
        if not predictions:
            return self._add_metadata(forecast, AdjustmentMetadata(adjusted=False))
        
        # Extract point predictions
        point_predictions = []
        for pred in predictions:
            if isinstance(pred, dict):
                point_predictions.append(pred.get("point", pred.get("value", 0)))
            else:
                point_predictions.append(float(pred))
        
        if not point_predictions:
            return self._add_metadata(forecast, AdjustmentMetadata(adjusted=False))
        
        # Step 1: Log the forecast
        forecast_id = await self._log_forecast(forecast, region_code, model_version)
        
        # Step 2: Find applicable rules (if adjustments enabled)
        if not ENABLE_ADJUSTMENTS:
            logger.debug("Adjustments disabled, returning base forecast")
            return self._add_metadata(
                forecast,
                AdjustmentMetadata(
                    adjusted=False,
                    explanation="Adjustments disabled by feature flag",
                ),
            )
        
        # Step 3: Get current context and find similar lessons
        applicable_rules = await self._find_applicable_rules(region_code)
        
        if not applicable_rules:
            return self._add_metadata(
                forecast,
                AdjustmentMetadata(
                    adjusted=False,
                    explanation="No applicable rules found for current context",
                ),
            )
        
        # Step 4: Apply rules
        adjustment_result = self._rule_engine.apply_rules(
            predictions=point_predictions,
            applicable_rules=applicable_rules,
            forecast_event_id=forecast_id,
            current_context=await self._get_current_context(region_code),
        )
        
        # Step 5: Update forecast with adjusted predictions
        adjusted_forecast = self._apply_adjustments(forecast, adjustment_result)
        
        # Step 6: Add metadata
        metadata = AdjustmentMetadata(
            adjusted=True,
            original_predictions=adjustment_result.original_predictions,
            total_adjustment_pct=adjustment_result.total_adjustment_pct,
            applied_rules_count=len(adjustment_result.applied_rules),
            applied_rules=[
                {
                    "lesson_id": app.lesson_id,
                    "explanation": app.explanation,
                    "adjustment_factor": app.adjustment_factor,
                    "confidence": app.match_confidence,
                }
                for app in adjustment_result.applied_rules[:5]  # Limit for API
            ],
            explanation=adjustment_result.explanation,
            adjustment_confidence=adjustment_result.confidence,
        )
        
        return self._add_metadata(adjusted_forecast, metadata)
    
    async def _log_forecast(
        self,
        forecast: Dict[str, Any],
        region_code: str,
        model_version: str,
    ) -> str:
        """Log forecast to learning memory."""
        if not self._forecast_logger:
            return "unknown"
        
        try:
            metadata = forecast.get("metadata", {})
            predictions = forecast.get("predictions", [])
            
            # Extract timestamps and values
            timestamps = []
            point_values = []
            q10_values = []
            q90_values = []
            
            for pred in predictions:
                if isinstance(pred, dict):
                    timestamps.append(pred.get("timestamp", ""))
                    point_values.append(pred.get("point", 0))
                    q10_values.append(pred.get("q10", 0))
                    q90_values.append(pred.get("q90", 0))
            
            forecast_id = self._forecast_logger.log_forecast(
                region_code=region_code,
                model_version=model_version,
                forecast_start=datetime.utcnow(),
                horizon_hours=metadata.get("horizon_hours", 24),
                predictions={
                    "timestamps": timestamps,
                    "point": point_values,
                    "q10": q10_values,
                    "q90": q90_values,
                },
                metadata=metadata,
            )
            
            return forecast_id
            
        except Exception as e:
            logger.error(f"Failed to log forecast: {e}")
            return "log_failed"
    
    async def _find_applicable_rules(self, region_code: str) -> List[Any]:
        """Find rules that apply to current context."""
        if not self._context_engine:
            return []
        
        try:
            # Get current context
            context = await self._get_current_context(region_code)
            
            # Find similar lessons
            similar = await self._context_engine.find_applicable_lessons(
                weather_context=context.get("weather", {}),
                region_code=region_code,
                event_context=context.get("events", {}),
            )
            
            if not similar:
                return []
            
            # Convert to ApplicableRule objects via rule engine
            return self._rule_engine.match_rules(context, similar)
            
        except Exception as e:
            logger.error(f"Failed to find applicable rules: {e}")
            return []
    
    async def _get_current_context(self, region_code: str) -> Dict[str, Any]:
        """Get current weather and event context."""
        context = {
            "region_code": region_code,
            "timestamp": datetime.utcnow().isoformat(),
        }
        
        try:
            from app.services.external_apis import get_weather_service
            
            # Get coordinates for region
            region_coords = {
                "SWISS_GRID": (47.3769, 8.5417),
                "SOUTH_TN_TNEB": (13.0827, 80.2707),
            }
            lat, lon = region_coords.get(region_code, (47.3769, 8.5417))
            
            weather_service = get_weather_service()
            weather = await weather_service.get_current_weather(lat, lon)
            context["weather"] = weather
            
        except Exception as e:
            logger.warning(f"Could not fetch weather context: {e}")
        
        # Add event context
        now = datetime.utcnow()
        context["events"] = {
            "is_weekend": now.weekday() >= 5,
            "day_of_week": now.strftime("%A"),
            "hour_of_day": now.hour,
        }
        
        return context
    
    def _apply_adjustments(
        self,
        forecast: Dict[str, Any],
        adjustment_result: Any,
    ) -> Dict[str, Any]:
        """Apply adjustments to forecast predictions."""
        adjusted = forecast.copy()
        predictions = adjusted.get("predictions", [])
        adjusted_preds = adjustment_result.adjusted_predictions
        
        if len(predictions) != len(adjusted_preds):
            logger.warning("Prediction count mismatch during adjustment")
            return adjusted
        
        new_predictions = []
        for i, pred in enumerate(predictions):
            if isinstance(pred, dict):
                new_pred = pred.copy()
                ratio = adjusted_preds[i] / adjustment_result.original_predictions[i] if adjustment_result.original_predictions[i] != 0 else 1.0
                new_pred["point"] = adjusted_preds[i]
                # Adjust intervals proportionally
                if "q10" in new_pred:
                    new_pred["q10"] = new_pred["q10"] * ratio
                if "q90" in new_pred:
                    new_pred["q90"] = new_pred["q90"] * ratio
                new_predictions.append(new_pred)
            else:
                new_predictions.append(adjusted_preds[i])
        
        adjusted["predictions"] = new_predictions
        return adjusted
    
    def _add_metadata(
        self,
        forecast: Dict[str, Any],
        adjustment_metadata: AdjustmentMetadata,
    ) -> Dict[str, Any]:
        """Add adjustment metadata to forecast response."""
        enhanced = forecast.copy()
        
        # Add adjustment metadata
        enhanced["adjustment_metadata"] = adjustment_metadata.to_dict()
        
        # Update main metadata if present
        if "metadata" in enhanced:
            enhanced["metadata"]["context_adjusted"] = adjustment_metadata.adjusted
            if adjustment_metadata.adjusted:
                enhanced["metadata"]["adjustment_pct"] = adjustment_metadata.total_adjustment_pct
        
        return enhanced
    
    def health_check(self) -> Dict[str, Any]:
        """Check adjuster health status."""
        return {
            "adjustments_enabled": ENABLE_ADJUSTMENTS,
            "learning_enabled": ENABLE_LEARNING,
            "forecast_logger": self._forecast_logger is not None,
            "context_engine": self._context_engine is not None,
            "rule_engine": self._rule_engine is not None,
            "status": "healthy" if all([
                self._forecast_logger,
                self._context_engine,
                self._rule_engine,
            ]) else "degraded",
        }


# =============================================================================
# GLOBAL INSTANCE
# =============================================================================

_adjuster: Optional[ForecastAdjuster] = None


def get_forecast_adjuster() -> ForecastAdjuster:
    """Get or create the forecast adjuster singleton."""
    global _adjuster
    if _adjuster is None:
        _adjuster = ForecastAdjuster()
    return _adjuster
