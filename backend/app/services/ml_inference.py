"""
Powercast AI - ML Inference Service (XGBoost)
Lightweight inference service that runs directly on Vercel serverless
"""

import numpy as np
import joblib
import json
from pathlib import Path
from typing import Dict, List, Optional
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

# Model artifacts paths
ML_DIR = Path(__file__).parent.parent.parent.parent / "ml" / "outputs"
MODEL_PATH = ML_DIR / "xgboost_model.joblib"
CONFIG_PATH = ML_DIR / "training_config.json"


class MLInferenceService:
    """
    Singleton ML inference service for XGBoost forecasting.

    Features:
    - Fast loading (~50ms)
    - Lightweight memory footprint (<100MB)
    - Thread-safe predictions
    - Conformal prediction intervals
    """

    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return

        self.model_data = None
        self.config: Optional[Dict] = None
        self.model_loaded = False

        self._load_model()
        self._initialized = True

    def _load_model(self):
        """Load XGBoost model artifacts"""
        logger.info("Loading XGBoost model...")

        try:
            # Load training config
            if CONFIG_PATH.exists():
                with open(CONFIG_PATH) as f:
                    self.config = json.load(f)
                logger.info(
                    f"Config loaded: Test MAPE = {self.config.get('test_mape', 'N/A')}%"
                )
            else:
                self.config = {
                    "output_horizon": 96,
                    "n_features": 21,
                    "model_type": "xgboost",
                }
                logger.warning("Config not found, using defaults")

            # Load model
            if MODEL_PATH.exists():
                self.model_data = joblib.load(MODEL_PATH)
                self.model_loaded = True
                logger.info("✓ XGBoost model loaded successfully")
            else:
                logger.error(f"Model not found at {MODEL_PATH}")
                self.model_loaded = False

        except Exception as e:
            logger.error(f"Failed to load model: {e}")
            self.model_loaded = False

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
            return self._mock_prediction(plant_type)

        try:
            # Ensure features is 2D
            if features.ndim == 1:
                features = features.reshape(1, -1)

            # Extract model components (NEW FORMAT from Colab script)
            models = self.model_data["models"]  # List of 96 XGBoost models
            feature_means = self.model_data["feature_means"]
            feature_stds = self.model_data["feature_stds"]
            conformal_margins = self.model_data[
                "conformal_margins"
            ]  # Dict: q80, q90, q95

            # Normalize features
            X_norm = (features - feature_means) / feature_stds

            # Predict using all 96 horizon models
            point_forecast = np.column_stack([m.predict(X_norm) for m in models])[0]

            # Apply conformal intervals (90% confidence by default)
            if include_intervals:
                margin_q90 = conformal_margins["q90"]
                q10 = point_forecast - margin_q90
                q90 = point_forecast + margin_q90
            else:
                q10 = point_forecast
                q90 = point_forecast

            # Generate timestamps (15-minute intervals)
            now = datetime.now()
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

            return {
                "predictions": predictions,
                "metadata": {
                    "model_type": "xgboost",
                    "horizon_hours": 24,
                    "interval_minutes": 15,
                    "plant_type": plant_type,
                    "generated_at": now.isoformat(),
                    "confidence": 0.90,
                    "test_mape": self.config.get("metrics", {}).get("test_mape", None),
                },
            }

        except Exception as e:
            logger.error(f"Prediction error: {e}")
            return self._mock_prediction(plant_type)

    def predict_from_history(
        self, load_history: List[float], forecast_start: Optional[datetime] = None
    ) -> Dict:
        """
        Generate forecast from historical load data.

        Args:
            load_history: Recent load values (at least 672 values = 1 week)
            forecast_start: Timestamp for forecast start (default: now)

        Returns:
            Forecast dictionary
        """
        if len(load_history) < 672:
            raise ValueError(
                f"Need at least 672 historical values, got {len(load_history)}"
            )

        # Use inference feature creation from ML module
        try:
            import pandas as pd
            import numpy as np

            # Convert to pandas Series with datetime index
            if forecast_start is None:
                forecast_start = datetime.now()

            timestamps = [
                forecast_start - timedelta(minutes=15 * (672 - i)) for i in range(672)
            ]
            load_series = pd.Series(load_history[-672:], index=timestamps)

            # Create features (21 features)
            features = self._create_features_from_history(load_series, forecast_start)

            # Predict
            return self.predict(features, include_intervals=True)

        except Exception as e:
            logger.error(f"Error creating features from history: {e}")
            return self._mock_prediction("mixed")

    def _create_features_from_history(
        self, load_series: pd.Series, forecast_start: datetime
    ) -> np.ndarray:
        """
        Create feature vector from historical load data for inference.
        Matches the feature engineering in training script.
        """
        features = []

        # Get last 672 samples (1 week)
        recent_load = load_series.values

        # Lags (1h=4, 6h=24, 24h=96, 168h=672 steps)
        features.extend(
            [
                recent_load[-4],
                recent_load[-24],
                recent_load[-96],
                recent_load[-672],
            ]
        )

        # Rolling statistics (last 24h and 168h)
        w24 = recent_load[-96:]
        w168 = recent_load[-672:]
        features.extend(
            [
                w24.mean(),
                w24.std(),
                w168.mean(),
                w168.std(),
            ]
        )

        # Calendar features from forecast start
        hour = forecast_start.hour + forecast_start.minute / 60
        features.extend(
            [
                np.sin(2 * np.pi * hour / 24),
                np.cos(2 * np.pi * hour / 24),
                np.sin(2 * np.pi * forecast_start.weekday() / 7),
                np.cos(2 * np.pi * forecast_start.weekday() / 7),
                np.sin(2 * np.pi * forecast_start.month / 12),
                np.cos(2 * np.pi * forecast_start.month / 12),
                1.0 if forecast_start.weekday() >= 5 else 0.0,  # is_weekend
                1.0 if 7 <= forecast_start.hour <= 21 else 0.0,  # is_peak_hour
            ]
        )

        # Weather defaults (temperature, humidity, cloud_cover, wind_speed, temp_x_humidity)
        features.extend([15.0, 50.0, 30.0, 5.0, 7.5])

        return np.array(features)

    def _mock_prediction(self, plant_type: str = "mixed") -> Dict:
        """
        Fallback mock prediction when model isn't loaded.
        Generates realistic Swiss grid patterns.
        """
        logger.warning("Using mock predictions - model not loaded")

        now = datetime.now()
        horizon = self.config.get("output_horizon", 96) if self.config else 96

        predictions = []
        for i in range(horizon):
            timestamp = now + timedelta(minutes=15 * i)
            hour = timestamp.hour + timestamp.minute / 60

            # Swiss grid daily pattern: ~6000-11000 MW
            # Peak at 12:00 and 19:00, valley at 04:00
            base_load = 8500
            daily_variation = 2000 * np.sin(2 * np.pi * (hour - 4) / 24)
            noise = np.random.normal(0, 150)

            point = base_load + daily_variation + noise
            margin = 500

            predictions.append(
                {
                    "timestamp": timestamp.isoformat(),
                    "point": float(point),
                    "q10": float(point - margin),
                    "q90": float(point + margin),
                }
            )

        return {
            "predictions": predictions,
            "metadata": {
                "model_type": "mock",
                "horizon_hours": horizon / 4,
                "interval_minutes": 15,
                "plant_type": plant_type,
                "generated_at": now.isoformat(),
                "confidence": 0.90,
                "warning": "Using mock data - XGBoost model not loaded",
            },
        }

    def health_check(self) -> Dict:
        """Check model health and readiness"""
        metrics = self.config.get("metrics", {}) if self.config else {}

        return {
            "status": "healthy" if self.model_loaded else "degraded",
            "model_loaded": self.model_loaded,
            "model_type": self.config.get("model_type", "unknown")
            if self.config
            else "unknown",
            "test_mape": metrics.get("test_mape") if metrics else None,
            "test_mae": metrics.get("test_mae") if metrics else None,
            "coverage_90": metrics.get("coverage_90") if metrics else None,
            "inference_time_ms": metrics.get("inference_time_ms") if metrics else None,
            "model_path": str(MODEL_PATH),
            "model_exists": MODEL_PATH.exists(),
            "horizon_mape": self.config.get("horizon_mape") if self.config else None,
        }


# Global singleton instance
_ml_service = None


def get_ml_service() -> MLInferenceService:
    """Get or create ML inference service singleton"""
    global _ml_service
    if _ml_service is None:
        _ml_service = MLInferenceService()
    return _ml_service
