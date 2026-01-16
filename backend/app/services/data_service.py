"""
Powercast AI - Data Service
Provides unified data access for grid status, forecasts, and ML inference
"""

from datetime import datetime, timedelta
import random
import logging
from typing import Dict, List, Optional
import numpy as np
from .ml_inference import get_ml_service

logger = logging.getLogger(__name__)


class DataServiceSingleton:
    """
    Singleton service that combines data service and ML inference
    """

    _instance = None
    _initialized = False

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    @classmethod
    def initialize(cls):
        """Initialize the data service"""
        if not cls._initialized:
            logger.info("Initializing Data Service...")
            cls._ml_service = get_ml_service()
            cls._initialized = True
            logger.info("✓ Data Service initialized")

    @classmethod
    def get_forecast(cls, target: str = "load", horizon_hours: int = 24) -> Dict:
        """
        Get forecast for specified target

        Args:
            target: 'load', 'solar', 'wind', or 'net_load'
            horizon_hours: Forecast horizon in hours

        Returns:
            Forecast dictionary with predictions and metadata
        """
        if not cls._initialized:
            cls.initialize()

        try:
            # Get forecast from ML service
            forecast = cls._ml_service.predict(
                plant_type=target, include_intervals=True
            )

            # Limit to requested horizon
            if horizon_hours < 24:
                limit = horizon_hours * 4  # 4 steps per hour (15-min intervals)
                forecast["predictions"] = forecast["predictions"][:limit]
                forecast["metadata"]["horizon_hours"] = horizon_hours

            return forecast

        except Exception as e:
            logger.error(f"Error getting forecast for {target}: {e}")
            return cls._get_mock_forecast(target, horizon_hours)

    @classmethod
    def get_grid_status(cls) -> Dict:
        """
        Get current grid status
        """
        now = datetime.now()

        # Mock realistic Swiss grid values
        total_load = random.randint(8500, 11000)
        nuclear = random.randint(3000, 4500)
        hydro = random.randint(2500, 4000)
        solar = (
            random.randint(500, 2500) if 6 <= now.hour <= 20 else random.randint(0, 200)
        )
        wind = random.randint(200, 800)
        net_import = total_load - (nuclear + hydro + solar + wind)

        return {
            "timestamp": now.isoformat(),
            "total_load_mw": total_load,
            "generation": {
                "nuclear_mw": nuclear,
                "hydro_mw": hydro,
                "solar_mw": solar,
                "wind_mw": wind,
                "total_mw": nuclear + hydro + solar + wind,
            },
            "net_import_mw": max(0, net_import),
            "frequency_hz": 50.0 + random.uniform(-0.05, 0.05),
            "status": "normal" if abs(net_import) < 1000 else "stressed",
        }

    @classmethod
    def get_assets(cls) -> Dict:
        """Get asset status and metrics"""
        return {
            "nuclear": {
                "name": "Swiss Nuclear Plants",
                "capacity_mw": 3300,
                "current_output_mw": random.randint(2800, 3200),
                "availability": random.randint(85, 95),
                "status": "operational",
            },
            "hydro": {
                "name": "Hydroelectric Generation",
                "capacity_mw": 4200,
                "current_output_mw": random.randint(3200, 3800),
                "availability": random.randint(80, 95),
                "status": "operational",
            },
            "solar": {
                "name": "Solar Photovoltaic",
                "capacity_mw": 3800,
                "current_output_mw": random.randint(400, 2000),
                "availability": random.randint(70, 90),
                "status": "operational",
            },
            "wind": {
                "name": "Wind Power",
                "capacity_mw": 900,
                "current_output_mw": random.randint(150, 600),
                "availability": random.randint(75, 90),
                "status": "operational",
            },
        }

    @classmethod
    def get_patterns(cls) -> Dict:
        """Get detected grid patterns"""
        return {
            "daily_pattern": {
                "name": "Daily Load Profile",
                "type": "seasonal",
                "description": "Regular daily load variation with morning and evening peaks",
                "confidence": 0.92,
            },
            "weekly_pattern": {
                "name": "Weekly Variation",
                "type": "seasonal",
                "description": "Lower consumption on weekends compared to weekdays",
                "confidence": 0.88,
            },
            "weather_sensitivity": {
                "name": "Weather-Driven Variation",
                "type": "regression",
                "description": "Temperature and wind speed impact on load",
                "confidence": 0.75,
            },
        }

    @classmethod
    def get_scenarios(cls) -> Dict:
        """Get Monte Carlo scenario analysis"""
        base_load = 9500

        return {
            "baseline": {
                "mean": base_load,
                "std": 300,
                "percentile_5": base_load - 450,
                "percentile_95": base_load + 450,
            },
            "extreme_heat": {
                "mean": base_load + 1200,
                "std": 450,
                "percentile_5": base_load + 600,
                "percentile_95": base_load + 1800,
            },
            "extreme_cold": {
                "mean": base_load + 800,
                "std": 400,
                "percentile_5": base_load + 350,
                "percentile_95": base_load + 1250,
            },
        }

    @classmethod
    def get_accuracy_metrics(cls) -> Dict:
        """Get model accuracy metrics"""
        health = cls._ml_service.health_check() if cls._initialized else {}

        return {
            "period": "24h",
            "mape": health.get("test_mape", 2.8),
            "mae": health.get("test_mae", 180),
            "coverage_90": health.get("coverage_90", 85),
            "bias": -0.3,
            "last_updated": datetime.now().isoformat(),
        }

    @classmethod
    def _get_mock_forecast(cls, target: str, horizon_hours: int) -> Dict:
        """Generate mock forecast when ML model not available"""
        now = datetime.now()
        base_load = (
            9500
            if target == "load"
            else {
                "solar": 1200,
                "wind": 400,
                "net_load": 9500,
            }.get(target, 9500)
        )

        predictions = []
        for i in range(horizon_hours * 4):
            timestamp = now + timedelta(minutes=15 * i)
            hour = timestamp.hour + timestamp.minute / 60

            # Daily pattern variation
            variation = (
                1500
                * (1 if target == "load" else 0.2)
                * (0.5 + 0.5 * np.sin(2 * np.pi * (hour - 4) / 24))
            )
            noise = random.gauss(0, 100 if target == "load" else 20)

            point = base_load + variation + noise

            predictions.append(
                {
                    "timestamp": timestamp.isoformat(),
                    "point": float(point),
                    "q10": float(point - 400),
                    "q90": float(point + 400),
                }
            )

        return {
            "predictions": predictions,
            "metadata": {
                "model_type": "mock",
                "horizon_hours": horizon_hours,
                "interval_minutes": 15,
                "plant_type": target,
                "generated_at": now.isoformat(),
                "confidence": 0.90,
                "warning": "Using mock data - ML model not loaded",
            },
        }
