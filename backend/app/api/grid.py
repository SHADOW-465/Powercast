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
    state = DataServiceSingleton.get_current_state()
    scada = state['scada']
    weather = state['weather']
    
    return {
        "timestamp": datetime.now().isoformat(),
        "frequency_hz": scada['frequency_hz'],
        "total_load_mw": scada['total_load_mw'],
        "renewable_generation_mw": scada['renewable_generation_mw'],
        "solar_generation_mw": scada['solar_generation_mw'],
        "wind_generation_mw": scada['wind_generation_mw'],
        "hydro_generation_mw": scada['hydro_generation_mw'],
        "nuclear_generation_mw": scada['nuclear_generation_mw'],
        "net_load_mw": scada['net_load_mw'],
        "reserve_margin_mw": scada['reserve_margin_mw'],
        "imports_mw": scada['imports_mw'],
        "exports_mw": scada['exports_mw'],
        "regional_load": scada['regional_load'],
        "weather": weather
    }


@router.get("/reserves")
async def get_reserves():
    """
    Get operating reserves status
    """
    state = DataServiceSingleton.get_current_state()
    reserve_margin = state['scada']['reserve_margin_mw']
    total_load = state['scada']['total_load_mw']
    
    return {
        "timestamp": datetime.now().isoformat(),
        "reserve_margin_mw": reserve_margin,
        "reserve_margin_pct": round(reserve_margin / total_load * 100, 1),
        "primary_reserve": {
            "required_mw": 200,
            "available_mw": 250,
            "status": "Adequate"
        },
        "secondary_reserve": {
            "required_mw": 400,
            "available_mw": 480,
            "status": "Adequate"
        },
        "tertiary_reserve": {
            "required_mw": 600,
            "available_mw": 750,
            "status": "Adequate"
        }
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
            "factors": ["Cloud variability", "Afternoon thunderstorms possible"]
        },
        "wind": {
            "risk_level": "Low",
            "confidence": 0.85,
            "factors": ["Stable conditions expected"]
        },
        "overall": {
            "risk_level": "Medium",
            "confidence": 0.78
        }
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
        "recommendations_pending": 3
    }
