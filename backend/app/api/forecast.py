"""
Powercast AI - Forecast API Routes
"""
from fastapi import APIRouter, Query
from typing import Optional
from datetime import datetime

from app.services.data_service import DataServiceSingleton

router = APIRouter()


@router.get("")
async def get_forecast(
    target: str = Query("load", description="Forecast target: load, solar, wind, net_load"),
    horizon_hours: int = Query(24, ge=1, le=48, description="Forecast horizon in hours")
):
    """
    Get probabilistic forecast for specified target
    
    Returns point forecast with quantiles and confidence intervals
    """
    return DataServiceSingleton.get_forecast(target, horizon_hours)


@router.get("/all")
async def get_all_forecasts(
    horizon_hours: int = Query(24, ge=1, le=48)
):
    """
    Get forecasts for all targets (load, solar, wind, net_load)
    """
    targets = ['load', 'solar', 'wind', 'net_load']
    return {
        target: DataServiceSingleton.get_forecast(target, horizon_hours)
        for target in targets
    }


@router.get("/accuracy")
async def get_forecast_accuracy():
    """
    Get forecast accuracy metrics (MAPE, MAE, coverage)
    """
    # Mock accuracy metrics (would come from actual model evaluation)
    return {
        "period": "24h",
        "mape": 2.8,
        "mae": 156.3,
        "coverage_80": 82.5,
        "coverage_95": 94.8,
        "bias": -0.3,
        "last_updated": datetime.now().isoformat()
    }
