"""
Powercast AI - Error Observer Engine
Detects and classifies forecast errors by comparing predictions to actuals.

Error Types:
- MAPE Spike: Mean Absolute Percentage Error exceeds threshold
- Peak Miss: Predicted peak timing/magnitude differs significantly
- Ramp Error: Rate of change (slope) prediction is off
- Bias: Systematic over/under-prediction
- Variance: Prediction intervals don't capture reality

This module triggers contextual analysis ONLY on significant failures.
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List, Tuple
from dataclasses import dataclass
from enum import Enum
import numpy as np

logger = logging.getLogger(__name__)


# =============================================================================
# ERROR TYPES AND SEVERITY
# =============================================================================

class ErrorType(str, Enum):
    MAPE_SPIKE = "mape_spike"
    PEAK_MISS = "peak_miss"
    RAMP_ERROR = "ramp_error"
    BIAS = "bias"
    VARIANCE = "variance"


class ErrorSeverity(str, Enum):
    LOW = "low"           # Minor deviation, no action needed
    MEDIUM = "medium"     # Notable deviation, log for analysis
    HIGH = "high"         # Significant error, trigger analysis
    CRITICAL = "critical" # Major failure, immediate attention


@dataclass
class ForecastError:
    """Detected forecast error record."""
    forecast_event_id: str
    error_type: ErrorType
    severity: ErrorSeverity
    mape: Optional[float] = None
    mae: Optional[float] = None
    peak_error_mw: Optional[float] = None
    ramp_error_mw_per_hour: Optional[float] = None
    actual_values: Optional[Dict[str, Any]] = None
    analysis_triggered: bool = False
    notes: Optional[str] = None
    
    def to_db_dict(self) -> Dict[str, Any]:
        """Convert to database-ready dictionary."""
        return {
            "forecast_event_id": self.forecast_event_id,
            "error_type": self.error_type.value,
            "severity": self.severity.value,
            "mape": self.mape,
            "mae": self.mae,
            "peak_error_mw": self.peak_error_mw,
            "ramp_error_mw_per_hour": self.ramp_error_mw_per_hour,
            "actual_values": self.actual_values,
            "analysis_triggered": self.analysis_triggered,
            "notes": self.notes,
        }


# =============================================================================
# CONFIGURATION
# =============================================================================

@dataclass
class ErrorThresholds:
    """Configurable thresholds for error detection."""
    # MAPE thresholds (percentage)
    mape_low: float = 5.0
    mape_medium: float = 10.0
    mape_high: float = 15.0
    mape_critical: float = 25.0
    
    # Peak error thresholds (MW)
    peak_low: float = 100.0
    peak_medium: float = 200.0
    peak_high: float = 400.0
    peak_critical: float = 800.0
    
    # Ramp error thresholds (MW/hour)
    ramp_low: float = 50.0
    ramp_medium: float = 100.0
    ramp_high: float = 200.0
    ramp_critical: float = 400.0
    
    # Minimum error to trigger LLM analysis
    analysis_trigger_severity: ErrorSeverity = ErrorSeverity.HIGH


# =============================================================================
# ERROR OBSERVER SERVICE
# =============================================================================

class ErrorObserver:
    """
    Service for detecting and classifying forecast errors.
    
    Compares forecast predictions against actual values when they become
    available, classifies error types and severity, and triggers context
    analysis for significant failures.
    """
    
    _instance = None
    _initialized = False
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self, thresholds: Optional[ErrorThresholds] = None):
        if self._initialized:
            return
        
        self.thresholds = thresholds or ErrorThresholds()
        self._supabase = None
        self._initialized = True
        
        self._init_database()
    
    def _init_database(self):
        """Initialize Supabase connection."""
        try:
            from app.core.supabase import get_supabase_admin
            self._supabase = get_supabase_admin()
            if self._supabase:
                logger.info("ErrorObserver: Connected to Supabase")
        except Exception as e:
            logger.warning(f"ErrorObserver: Could not connect to database: {e}")
    
    def analyze_forecast(
        self,
        forecast_event_id: str,
        predictions: Dict[str, Any],
        actuals: Dict[str, Any],
    ) -> List[ForecastError]:
        """
        Analyze a forecast against actual values.
        
        Args:
            forecast_event_id: UUID of the forecast event
            predictions: Dict with timestamps, point, q10, q90 arrays
            actuals: Dict with timestamps and actual values
            
        Returns:
            List of detected errors
        """
        errors: List[ForecastError] = []
        
        try:
            # Extract arrays
            pred_point = np.array(predictions.get("point", []))
            pred_timestamps = predictions.get("timestamps", [])
            pred_q10 = np.array(predictions.get("q10", pred_point * 0.9))
            pred_q90 = np.array(predictions.get("q90", pred_point * 1.1))
            
            actual_values = np.array(actuals.get("values", []))
            
            # Align lengths
            min_len = min(len(pred_point), len(actual_values))
            if min_len == 0:
                logger.warning(f"No data to analyze for forecast {forecast_event_id}")
                return errors
            
            pred_point = pred_point[:min_len]
            actual_values = actual_values[:min_len]
            pred_q10 = pred_q10[:min_len]
            pred_q90 = pred_q90[:min_len]
            
            # 1. Check MAPE
            mape_error = self._check_mape(forecast_event_id, pred_point, actual_values, actuals)
            if mape_error:
                errors.append(mape_error)
            
            # 2. Check Peak Miss
            peak_error = self._check_peak_miss(forecast_event_id, pred_point, actual_values, actuals)
            if peak_error:
                errors.append(peak_error)
            
            # 3. Check Ramp Error
            ramp_error = self._check_ramp_error(forecast_event_id, pred_point, actual_values, actuals)
            if ramp_error:
                errors.append(ramp_error)
            
            # 4. Check Variance (interval coverage)
            variance_error = self._check_variance(forecast_event_id, pred_q10, pred_q90, actual_values, actuals)
            if variance_error:
                errors.append(variance_error)
            
            # Store errors in database
            for error in errors:
                self._store_error(error)
                
                # Trigger analysis for significant errors
                if error.severity in [ErrorSeverity.HIGH, ErrorSeverity.CRITICAL]:
                    self._trigger_analysis(error)
            
            logger.info(f"Analyzed forecast {forecast_event_id}: {len(errors)} errors detected")
            
        except Exception as e:
            logger.error(f"Error analyzing forecast {forecast_event_id}: {e}")
        
        return errors
    
    def _check_mape(
        self,
        forecast_event_id: str,
        predictions: np.ndarray,
        actuals: np.ndarray,
        actual_dict: Dict[str, Any],
    ) -> Optional[ForecastError]:
        """Check Mean Absolute Percentage Error."""
        # Avoid division by zero
        mask = actuals != 0
        if not mask.any():
            return None
        
        mape = np.mean(np.abs((actuals[mask] - predictions[mask]) / actuals[mask])) * 100
        mae = np.mean(np.abs(actuals - predictions))
        
        severity = self._get_mape_severity(mape)
        if severity == ErrorSeverity.LOW:
            return None  # Don't log low errors
        
        return ForecastError(
            forecast_event_id=forecast_event_id,
            error_type=ErrorType.MAPE_SPIKE,
            severity=severity,
            mape=float(mape),
            mae=float(mae),
            actual_values=actual_dict,
            notes=f"MAPE: {mape:.2f}%, MAE: {mae:.2f} MW",
        )
    
    def _check_peak_miss(
        self,
        forecast_event_id: str,
        predictions: np.ndarray,
        actuals: np.ndarray,
        actual_dict: Dict[str, Any],
    ) -> Optional[ForecastError]:
        """Check peak timing and magnitude errors."""
        pred_peak_idx = np.argmax(predictions)
        actual_peak_idx = np.argmax(actuals)
        
        pred_peak_val = predictions[pred_peak_idx]
        actual_peak_val = actuals[actual_peak_idx]
        
        # Peak magnitude error
        peak_error_mw = abs(pred_peak_val - actual_peak_val)
        
        # Peak timing error (in intervals, assuming 15-min)
        timing_error_intervals = abs(pred_peak_idx - actual_peak_idx)
        
        # Combined severity based on magnitude
        severity = self._get_peak_severity(peak_error_mw)
        
        # Increase severity if timing is also off (more than 2 hours)
        if timing_error_intervals > 8:  # 8 * 15min = 2 hours
            severity = min(ErrorSeverity.CRITICAL, ErrorSeverity(
                ["low", "medium", "high", "critical"][
                    min(3, ["low", "medium", "high", "critical"].index(severity.value) + 1)
                ]
            ))
        
        if severity == ErrorSeverity.LOW:
            return None
        
        return ForecastError(
            forecast_event_id=forecast_event_id,
            error_type=ErrorType.PEAK_MISS,
            severity=severity,
            peak_error_mw=float(peak_error_mw),
            actual_values=actual_dict,
            notes=f"Peak error: {peak_error_mw:.0f} MW, timing off by {timing_error_intervals * 15} minutes",
        )
    
    def _check_ramp_error(
        self,
        forecast_event_id: str,
        predictions: np.ndarray,
        actuals: np.ndarray,
        actual_dict: Dict[str, Any],
    ) -> Optional[ForecastError]:
        """Check ramp rate (slope) errors."""
        if len(predictions) < 2:
            return None
        
        # Calculate ramps (MW per interval, at 15-min = 4 per hour)
        pred_ramps = np.diff(predictions)
        actual_ramps = np.diff(actuals)
        
        # Find max ramp error
        ramp_errors = np.abs(pred_ramps - actual_ramps)
        max_ramp_error = np.max(ramp_errors)
        
        # Convert to MW/hour (multiply by 4 for 15-min intervals)
        ramp_error_per_hour = float(max_ramp_error * 4)
        
        severity = self._get_ramp_severity(ramp_error_per_hour)
        if severity == ErrorSeverity.LOW:
            return None
        
        return ForecastError(
            forecast_event_id=forecast_event_id,
            error_type=ErrorType.RAMP_ERROR,
            severity=severity,
            ramp_error_mw_per_hour=ramp_error_per_hour,
            actual_values=actual_dict,
            notes=f"Max ramp error: {ramp_error_per_hour:.0f} MW/hour",
        )
    
    def _check_variance(
        self,
        forecast_event_id: str,
        q10: np.ndarray,
        q90: np.ndarray,
        actuals: np.ndarray,
        actual_dict: Dict[str, Any],
    ) -> Optional[ForecastError]:
        """Check if prediction intervals capture actual values."""
        # Calculate coverage (what % of actuals fall within q10-q90)
        in_interval = (actuals >= q10) & (actuals <= q90)
        coverage = np.mean(in_interval) * 100
        
        # Expected coverage for 80% interval is ~80%
        # Flag if significantly below
        if coverage < 50:
            severity = ErrorSeverity.HIGH
        elif coverage < 65:
            severity = ErrorSeverity.MEDIUM
        else:
            return None  # Coverage is acceptable
        
        return ForecastError(
            forecast_event_id=forecast_event_id,
            error_type=ErrorType.VARIANCE,
            severity=severity,
            actual_values=actual_dict,
            notes=f"Interval coverage: {coverage:.1f}% (expected ~80%)",
        )
    
    def _get_mape_severity(self, mape: float) -> ErrorSeverity:
        """Map MAPE to severity level."""
        if mape >= self.thresholds.mape_critical:
            return ErrorSeverity.CRITICAL
        elif mape >= self.thresholds.mape_high:
            return ErrorSeverity.HIGH
        elif mape >= self.thresholds.mape_medium:
            return ErrorSeverity.MEDIUM
        else:
            return ErrorSeverity.LOW
    
    def _get_peak_severity(self, peak_error_mw: float) -> ErrorSeverity:
        """Map peak error to severity level."""
        if peak_error_mw >= self.thresholds.peak_critical:
            return ErrorSeverity.CRITICAL
        elif peak_error_mw >= self.thresholds.peak_high:
            return ErrorSeverity.HIGH
        elif peak_error_mw >= self.thresholds.peak_medium:
            return ErrorSeverity.MEDIUM
        else:
            return ErrorSeverity.LOW
    
    def _get_ramp_severity(self, ramp_error: float) -> ErrorSeverity:
        """Map ramp error to severity level."""
        if ramp_error >= self.thresholds.ramp_critical:
            return ErrorSeverity.CRITICAL
        elif ramp_error >= self.thresholds.ramp_high:
            return ErrorSeverity.HIGH
        elif ramp_error >= self.thresholds.ramp_medium:
            return ErrorSeverity.MEDIUM
        else:
            return ErrorSeverity.LOW
    
    def _store_error(self, error: ForecastError):
        """Store error in database."""
        if not self._supabase:
            logger.info(f"[FALLBACK] Error detected: {error.error_type.value} - {error.severity.value}")
            return
        
        try:
            self._supabase.table("forecast_errors").insert(error.to_db_dict()).execute()
        except Exception as e:
            logger.error(f"Failed to store error: {e}")
    
    def _trigger_analysis(self, error: ForecastError):
        """
        Trigger context analysis for significant errors.
        
        This is called asynchronously after detecting HIGH or CRITICAL errors.
        It marks the error for analysis and initiates the learning pipeline.
        """
        error.analysis_triggered = True
        logger.info(f"Analysis triggered for {error.error_type.value} error: {error.notes}")
        
        # Update database
        if self._supabase:
            try:
                self._supabase.table("forecast_errors").update(
                    {"analysis_triggered": True}
                ).eq(
                    "forecast_event_id", error.forecast_event_id
                ).eq(
                    "error_type", error.error_type.value
                ).execute()
            except Exception as e:
                logger.error(f"Failed to update analysis trigger: {e}")
    
    def get_pending_analysis(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Get errors that need context analysis."""
        if not self._supabase:
            return []
        
        try:
            result = (
                self._supabase.table("forecast_errors")
                .select("*, forecast_events(*)")
                .eq("analysis_triggered", True)
                .is_("analysis_completed_at", "null")
                .order("observed_at", desc=True)
                .limit(limit)
                .execute()
            )
            return result.data or []
        except Exception as e:
            logger.error(f"Failed to get pending analysis: {e}")
            return []


# =============================================================================
# GLOBAL INSTANCE
# =============================================================================

_error_observer: Optional[ErrorObserver] = None


def get_error_observer() -> ErrorObserver:
    """Get or create the error observer singleton."""
    global _error_observer
    if _error_observer is None:
        _error_observer = ErrorObserver()
    return _error_observer
