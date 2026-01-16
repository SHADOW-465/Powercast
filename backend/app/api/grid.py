"""
Powercast AI - Grid Status API Routes
"""

from fastapi import APIRouter
from datetime import datetime

from app.services.data_service import DataServiceSingleton

router = APIRouter()


@router.get("/status")
async def get_grid_status():
    """
    Get current grid status including load, generation, frequency
    """
    grid_data = DataServiceSingleton.get_grid_status()

    return {
        "timestamp": grid_data["timestamp"],
        "frequency_hz": grid_data["frequency_hz"],
        "total_load_mw": grid_data["total_load_mw"],
        "renewable_generation_mw": grid_data["generation"]["solar_mw"]
        + grid_data["generation"]["wind_mw"],
        "solar_generation_mw": grid_data["generation"]["solar_mw"],
        "wind_generation_mw": grid_data["generation"]["wind_mw"],
        "hydro_generation_mw": grid_data["generation"]["hydro_mw"],
        "nuclear_generation_mw": grid_data["generation"]["nuclear_mw"],
        "net_load_mw": grid_data["net_import_mw"],
        "reserve_margin_mw": 500,
        "imports_mw": grid_data["net_import_mw"]
        if grid_data["net_import_mw"] > 0
        else 0,
        "exports_mw": -grid_data["net_import_mw"]
        if grid_data["net_import_mw"] < 0
        else 0,
        "regional_load": {"north": 2500, "south": 2200, "east": 1800, "west": 2100},
    }


@router.get("/reserves")
async def get_reserves():
    """
    Get operating reserves status
    """
    grid_data = DataServiceSingleton.get_grid_status()
    reserve_margin = 500
    total_load = grid_data["total_load_mw"]

    return {
        "timestamp": datetime.now().isoformat(),
        "reserve_margin_mw": reserve_margin,
        "reserve_margin_pct": round(reserve_margin / total_load * 100, 1),
        "primary_reserve": {
            "required_mw": 200,
            "available_mw": 250,
            "status": "Adequate",
        },
        "secondary_reserve": {
            "required_mw": 400,
            "available_mw": 480,
            "status": "Adequate",
        },
        "tertiary_reserve": {
            "required_mw": 600,
            "available_mw": 750,
            "status": "Adequate",
        },
    }


@router.get("/uncertainty")
async def get_uncertainty():
    """
    Get renewable forecast uncertainty indicators
    """
    return {
        "timestamp": datetime.now().isoformat(),
        "solar": {
            "risk_level": "Medium",
            "confidence": 0.72,
            "factors": ["Cloud variability", "Afternoon thunderstorms possible"],
        },
        "wind": {
            "risk_level": "Low",
            "confidence": 0.85,
            "factors": ["Stable conditions expected"],
        },
        "overall": {"risk_level": "Medium", "confidence": 0.78},
    }


@router.get("/optimization")
async def get_optimization_status():
    """
    Get optimization engine status
    """
    return {
        "timestamp": datetime.now().isoformat(),
        "status": "ACTIVE",
        "last_run": datetime.now().isoformat(),
        "objective_value": 1234567.89,
        "execution_time_ms": 3240,
        "constraints_satisfied": True,
        "recommendations_pending": 3,
    }
