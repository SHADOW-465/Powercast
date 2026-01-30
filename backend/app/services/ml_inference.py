"""
Powercast AI - ML Inference Service (XGBoost)
Multi-region inference service with context-aware feature engineering.

Features:
- Region-aware model loading via ModelRegistry
- Timezone-aware feature engineering
- Conformal prediction intervals
- Thread-safe predictions
"""

import numpy as np
import json
from pathlib import Path
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
import logging
from zoneinfo import ZoneInfo

from app.services.model_registry import (
    get_model_registry,
    ModelRegistry,
    REGION_TIMEZONES,
    REGION_PEAK_HOURS,
)

logger = logging.getLogger(__name__)


class MLInferenceService:
    """
    Multi-region ML inference service for XGBoost forecasting.

    Features:
    - Region-aware model loading
    - Timezone-aligned feature engineering
    - Conformal prediction intervals
    - Thread-safe predictions
    """

    def __init__(self, region_code: str = "SWISS_GRID"):
        """
        Initialize inference service for a specific region.
        
        Args:
            region_code: Region code (e.g., 'SWISS_GRID', 'SOUTH_TN_TNEB')
        """
        self.region_code = region_code
        self.registry = get_model_registry()
        
        # Get region-specific config
        self.timezone = self.registry.get_timezone(region_code)
        self.peak_hours = self.registry.get_peak_hours(region_code)
        
        # Lazy model loading
        self._model_data: Optional[Dict[str, Any]] = None
        self._model_loaded = False
    
    @property
    def model_data(self) -> Optional[Dict[str, Any]]:
        """Lazy load model on first access"""
        if not self._model_loaded:
            self._model_data = self.registry.get_model(self.region_code)
            self._model_loaded = True
        return self._model_data
    
    @property
    def model_loaded(self) -> bool:
        """Check if model is available"""
        return self.model_data is not None
    
    def predict(
        self,
        features: np.ndarray,
        plant_type: str = "mixed",
        include_intervals: bool = True,
    ) -> Dict:
        """
        Generate load forecast with prediction intervals.

        Args:
            features: Input features (1, 21) or (21,)
            plant_type: Power plant type (for metadata)
            include_intervals: Whether to include q10/q90 intervals

        Returns:
            Dictionary with predictions, timestamps, and metadata
        """
        if not self.model_loaded:
            return self._model_not_found_response()

        try:
            # Ensure features is 2D
            if features.ndim == 1:
                features = features.reshape(1, -1)

            # Extract model components
            models = self.model_data["models"]  # List of 96 XGBoost models
            feature_means = self.model_data["feature_means"]
            feature_stds = self.model_data["feature_stds"]
            conformal_margins = self.model_data.get("conformal_margins", {})

            # Normalize features
            X_norm = (features - feature_means) / feature_stds

            # Predict using all 96 horizon models
            point_forecast = np.column_stack([m.predict(X_norm) for m in models])[0]

            # Apply conformal intervals (90% confidence by default)
            if include_intervals and conformal_margins:
                margin_q90 = conformal_margins.get("q90", point_forecast * 0.1)
                q10 = point_forecast - margin_q90
                q90 = point_forecast + margin_q90
            else:
                q10 = point_forecast * 0.9
                q90 = point_forecast * 1.1

            # Generate timestamps in local timezone
            tz = ZoneInfo(self.timezone)
            now = datetime.now(tz)
            timestamps = [
                (now + timedelta(minutes=15 * i)).isoformat()
                for i in range(len(point_forecast))
            ]

            # Format response
            predictions = []
            for i in range(len(timestamps)):
                predictions.append(
                    {
                        "timestamp": timestamps[i],
                        "point": float(point_forecast[i]),
                        "q10": float(q10[i]),
                        "q90": float(q90[i]),
                    }
                )

            # Get model metadata
            metadata_obj = self.registry.get_metadata(self.region_code)
            metrics = metadata_obj.metrics if metadata_obj else {}

            return {
                "predictions": predictions,
                "metadata": {
                    "model_type": "xgboost",
                    "region_code": self.region_code,
                    "timezone": self.timezone,
                    "horizon_hours": 24,
                    "interval_minutes": 15,
                    "plant_type": plant_type,
                    "generated_at": now.isoformat(),
                    "confidence": 0.90,
                    "test_mape": metrics.get("test_mape"),
                    "trained_at": metadata_obj.trained_at.isoformat() if metadata_obj and metadata_obj.trained_at else None,
                },
            }

        except Exception as e:
            logger.error(f"Prediction error for {self.region_code}: {e}")
            raise RuntimeError(f"Model prediction failed for {self.region_code}: {e}")

    def predict_from_history(
        self, 
        load_history: List[float], 
        forecast_start: Optional[datetime] = None
    ) -> Dict:
        """
        Generate forecast from historical load data.

        Args:
            load_history: Recent load values (at least 672 values = 1 week)
            forecast_start: Timestamp for forecast start (default: now in UTC)
                           Will be converted to local timezone for feature engineering.

        Returns:
            Forecast dictionary
        """
        if len(load_history) < 672:
            raise ValueError(
                f"Need at least 672 historical values, got {len(load_history)}"
            )

        try:
            import pandas as pd

            # Use UTC as standard, feature engineering will convert to local
            if forecast_start is None:
                # Use current time in UTC (will be converted to local in features)
                forecast_start = datetime.now(ZoneInfo('UTC'))
            elif forecast_start.tzinfo is None:
                # Naive timestamp - assume it's UTC
                forecast_start = forecast_start.replace(tzinfo=ZoneInfo('UTC'))
            # If already timezone-aware, use as-is (feature engineering will convert)

            timestamps = [
                forecast_start - timedelta(minutes=15 * (672 - i)) for i in range(672)
            ]
            load_series = pd.Series(load_history[-672:], index=timestamps)

            # Create features with timezone-aware engineering
            features = self._create_features_from_history(load_series, forecast_start)

            return self.predict(features, include_intervals=True)

        except Exception as e:
            logger.error(f"Error creating features from history: {e}")
            raise RuntimeError(f"Feature engineering failed: {e}")

    def _create_features_from_history(
        self, load_series, forecast_start: datetime
    ) -> np.ndarray:
        """
        Create feature vector from historical load data.
        Timezone-aware feature engineering for local grid behavior.
        
        CRITICAL: Time is CONVERTED to local timezone, not just labeled!
        Example: 18:30 UTC → 00:00 IST (midnight), not 18:30 IST
        """
        features = []

        # Get last 672 samples (1 week)
        recent_load = load_series.values

        # Lags (1h=4, 6h=24, 24h=96, 168h=672 steps)
        features.extend([
            recent_load[-4],
            recent_load[-24],
            recent_load[-96],
            recent_load[-672],
        ])

        # Rolling statistics (last 24h and 168h)
        w24 = recent_load[-96:]
        w168 = recent_load[-672:]
        features.extend([
            w24.mean(),
            w24.std(),
            w168.mean(),
            w168.std(),
        ])

        # Calendar features - TIMEZONE CONVERSION (not just labeling!)
        # CRITICAL: We must CONVERT the time, not just label it
        local_tz = ZoneInfo(self.timezone)
        
        if forecast_start.tzinfo is None:
            # Naive timestamp - assume it's UTC, then convert to local
            utc_dt = forecast_start.replace(tzinfo=ZoneInfo('UTC'))
            local_dt = utc_dt.astimezone(local_tz)
        elif str(forecast_start.tzinfo) == self.timezone:
            # Already in correct timezone
            local_dt = forecast_start
        else:
            # Different timezone - convert to local
            local_dt = forecast_start.astimezone(local_tz)
        
        # Now extract LOCAL hour (18:30 UTC → 00:00 IST for India)
        hour = local_dt.hour + local_dt.minute / 60
        day_of_week = local_dt.weekday()
        month = local_dt.month
        
        features.extend([
            np.sin(2 * np.pi * hour / 24),
            np.cos(2 * np.pi * hour / 24),
            np.sin(2 * np.pi * day_of_week / 7),
            np.cos(2 * np.pi * day_of_week / 7),
            np.sin(2 * np.pi * month / 12),
            np.cos(2 * np.pi * month / 12),
            1.0 if day_of_week >= 5 else 0.0,  # is_weekend
            1.0 if local_dt.hour in self.peak_hours else 0.0,  # is_peak_hour (region-specific!)
        ])

        # Weather defaults (temperature, humidity, cloud_cover, wind_speed, temp_x_humidity)
        features.extend([15.0, 50.0, 30.0, 5.0, 7.5])

        return np.array(features)

    def _model_not_found_response(self) -> Dict:
        """Response when model is not found for region"""
        return {
            "status": "training_required",
            "region_code": self.region_code,
            "message": f"No model found for region '{self.region_code}'. Training required.",
            "training_endpoint": "/api/train",
            "predictions": None,
            "metadata": {
                "model_type": None,
                "region_code": self.region_code,
                "timezone": self.timezone,
                "training_required": True,
                "generated_at": datetime.now(ZoneInfo(self.timezone)).isoformat(),
            },
        }

    def _mock_prediction(self, plant_type: str = "mixed") -> Dict:
        """
        Fallback mock prediction when model prediction fails.
        Generates realistic patterns based on region.
        """
        logger.warning(f"Using mock predictions for {self.region_code}")

        tz = ZoneInfo(self.timezone)
        now = datetime.now(tz)
        horizon = 96  # 24 hours

        # Region-specific base load scaling
        if self.region_code == "SWISS_GRID":
            base_load = 8500  # Swiss grid scale
            variation = 2000
        else:
            # Indian grids typically smaller
            base_load = 2500
            variation = 800

        predictions = []
        for i in range(horizon):
            timestamp = now + timedelta(minutes=15 * i)
            hour = timestamp.hour + timestamp.minute / 60

            # Daily pattern with regional peaks
            if self.region_code == "SWISS_GRID":
                # Swiss: peaks at 12:00 and 19:00
                daily_variation = variation * np.sin(2 * np.pi * (hour - 4) / 24)
            else:
                # India: peak at 19:00-21:00 (evening)
                daily_variation = variation * np.sin(2 * np.pi * (hour - 7) / 24)
            
            noise = np.random.normal(0, variation * 0.05)
            point = base_load + daily_variation + noise
            margin = variation * 0.25

            predictions.append({
                "timestamp": timestamp.isoformat(),
                "point": float(point),
                "q10": float(point - margin),
                "q90": float(point + margin),
            })

        return {
            "predictions": predictions,
            "metadata": {
                "model_type": "mock",
                "region_code": self.region_code,
                "timezone": self.timezone,
                "horizon_hours": horizon / 4,
                "interval_minutes": 15,
                "plant_type": plant_type,
                "generated_at": now.isoformat(),
                "confidence": 0.90,
                "warning": f"Using mock data - XGBoost model not loaded for {self.region_code}",
            },
        }

    def health_check(self) -> Dict:
        """Check model health and readiness"""
        status = self.registry.get_status(self.region_code)
        
        return {
            "status": "healthy" if self.model_loaded else "degraded",
            "region_code": self.region_code,
            "timezone": self.timezone,
            "model_loaded": self.model_loaded,
            "model_status": status.get("status"),
            "trained_at": status.get("trained_at"),
            "metrics": status.get("metrics"),
            "training_required": status.get("training_required", False),
        }


# =============================================================================
# SERVICE FACTORY
# =============================================================================

# Cache of inference services per region
_inference_services: Dict[str, MLInferenceService] = {}

def get_ml_service(region_code: str = "SWISS_GRID") -> MLInferenceService:
    """
    Get or create ML inference service for a region.
    
    Args:
        region_code: Region code (default: SWISS_GRID for backwards compatibility)
    
    Returns:
        MLInferenceService instance for the region
    """
    global _inference_services
    
    if region_code not in _inference_services:
        _inference_services[region_code] = MLInferenceService(region_code)
    
    return _inference_services[region_code]


def get_available_regions() -> List[str]:
    """Get list of regions with available models"""
    return get_model_registry().list_available_regions()


def get_region_status(region_code: str) -> Dict[str, Any]:
    """Get status for a specific region"""
    return get_model_registry().get_status(region_code)
