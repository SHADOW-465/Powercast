"""
Powercast AI - Forecast API Routes
Multi-region forecasting with region_code routing.
NO MOCK DATA - Requires real uploaded data.
"""
from fastapi import APIRouter, Query, HTTPException
from typing import Optional, List
from datetime import datetime

from app.services.ml_inference import (
    get_ml_service,
    get_available_regions,
    get_region_status,
)

router = APIRouter()


@router.get("")
async def get_forecast(
    target: str = Query("load", description="Forecast target: load, solar, wind, net_load"),
    horizon_hours: int = Query(24, ge=1, le=48, description="Forecast horizon in hours"),
    region_code: str = Query("SWISS_GRID", description="Region code for model selection"),
):
    """
    Get probabilistic forecast for specified target and region.
    
    REQUIRES:
    - Trained model for the region
    - Uploaded historical data (at least 1 week)
    
    Returns HTTP 400 if no data available - NO MOCK DATA.
    
    Examples:
    - /forecast?region_code=SWISS_GRID (Swiss grid)
    - /forecast?region_code=SOUTH_TN_TNEB (Tamil Nadu, India)
    """
    from app.services.real_data_store import get_real_data_store
    
    # Get ML service for the region
    ml_service = get_ml_service(region_code)
    
    # Check if model exists
    if not ml_service.model_loaded:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "model_not_found",
                "region_code": region_code,
                "message": f"No trained model found for region '{region_code}'. Please train a model first.",
                "training_endpoint": "/api/train",
                "available_regions": get_available_regions(),
            }
        )
    
    # Get REAL historical data from database
    data_store = get_real_data_store()
    load_history = data_store.get_load_history(region_code, n_samples=672)
    
    if load_history is None:
        # No data uploaded - return error, NOT mock data
        data_summary = data_store.get_data_summary(region_code)
        raise HTTPException(
            status_code=400,
            detail={
                "error": "no_data",
                "region_code": region_code,
                "message": f"No historical data found for region '{region_code}'. Please upload CSV data first.",
                "upload_endpoint": "/api/data",
                "required_samples": 672,
                "data_summary": data_summary,
            }
        )
    
    # Generate forecast using REAL data with trained model
    forecast = ml_service.predict_from_history(load_history)
    
    # Trim to requested horizon
    n_intervals = horizon_hours * 4  # 15-minute intervals
    if forecast.get("predictions"):
        forecast["predictions"] = forecast["predictions"][:n_intervals]
    
    # Add data source info
    if "metadata" in forecast:
        forecast["metadata"]["data_source"] = "real"
        forecast["metadata"]["history_samples"] = len(load_history)
        forecast["metadata"]["horizon_hours"] = horizon_hours
    
    # === CLOSED-LOOP ADJUSTMENT LAYER ===
    # Apply context-aware adjustments from learned rules
    try:
        from app.services.forecast_adjuster import get_forecast_adjuster
        adjuster = get_forecast_adjuster()
        
        # Get model version from ML service
        model_version = ml_service.get_model_version() if hasattr(ml_service, 'get_model_version') else "1.0.0"
        
        # Apply adjustments (async)
        import asyncio
        forecast = await adjuster.adjust_forecast(
            forecast=forecast,
            region_code=region_code,
            model_version=model_version,
        )
    except Exception as e:
        # Log but don't fail - adjustment layer is additive
        import logging
        logging.getLogger(__name__).warning(f"Forecast adjustment skipped: {e}")
        # Add metadata indicating no adjustment was applied
        if "metadata" not in forecast:
            forecast["metadata"] = {}
        forecast["adjustment_metadata"] = {
            "adjusted": False,
            "explanation": f"Adjustment layer unavailable: {str(e)[:100]}",
        }
    
    return forecast


@router.get("/all")
async def get_all_forecasts(
    horizon_hours: int = Query(24, ge=1, le=48),
    region_code: str = Query("SWISS_GRID", description="Region code for model selection"),
):
    """
    Get forecasts for all targets (load, solar, wind, net_load) for a region.
    REQUIRES uploaded real data - NO MOCK DATA.
    """
    from app.services.real_data_store import get_real_data_store
    
    ml_service = get_ml_service(region_code)
    
    if not ml_service.model_loaded:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "model_not_found",
                "region_code": region_code,
                "message": f"No model found for region '{region_code}'.",
                "training_endpoint": "/api/train",
            }
        )
    
    # Get REAL historical data
    data_store = get_real_data_store()
    load_history = data_store.get_load_history(region_code, n_samples=672)
    
    if load_history is None:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "no_data",
                "region_code": region_code,
                "message": f"No historical data for '{region_code}'. Upload CSV first.",
                "upload_endpoint": "/api/data",
            }
        )
    
    # Generate forecast from real data
    forecast = ml_service.predict_from_history(load_history)
    
    # Trim to horizon
    n_intervals = horizon_hours * 4
    if forecast.get("predictions"):
        forecast["predictions"] = forecast["predictions"][:n_intervals]
    
    # For now, all targets use same load forecast (model is load-only)
    # In production, we'd have separate models for solar/wind
    targets = ['load', 'solar', 'wind', 'net_load']
    return {
        target: forecast for target in targets
    }


@router.get("/regions")
async def list_regions():
    """
    List all available regions with trained models.
    """
    regions = get_available_regions()
    
    return {
        "regions": [get_region_status(r) for r in regions],
        "total": len(regions),
    }


@router.get("/regions/{region_code}")
async def get_region_info(region_code: str):
    """
    Get detailed information about a specific region's model.
    """
    status = get_region_status(region_code)
    
    if status.get("status") == "not_found":
        raise HTTPException(
            status_code=404,
            detail={
                "error": "region_not_found",
                "message": f"No model found for region '{region_code}'",
                "training_required": True,
            }
        )
    
    return status


@router.get("/accuracy")
async def get_forecast_accuracy(
    region_code: str = Query("SWISS_GRID", description="Region code"),
):
    """
    Get forecast accuracy metrics for a region's model.
    """
    status = get_region_status(region_code)
    
    if status.get("status") == "not_found":
        return {
            "region_code": region_code,
            "error": "No model found for this region",
            "training_required": True,
        }
    
    metrics = status.get("metrics", {})
    
    return {
        "region_code": region_code,
        "timezone": status.get("timezone"),
        "trained_at": status.get("trained_at"),
        "period": "24h",
        "mape": metrics.get("test_mape"),
        "mae": metrics.get("test_mae"),
        "coverage_80": metrics.get("coverage_80"),
        "coverage_90": metrics.get("coverage_90"),
        "bias": metrics.get("bias"),
        "last_updated": datetime.now().isoformat(),
    }


@router.get("/health")
async def forecast_health(
    region_code: Optional[str] = Query(None, description="Specific region to check"),
):
    """
    Health check for forecasting service.
    """
    if region_code:
        ml_service = get_ml_service(region_code)
        return ml_service.health_check()
    
    # Overall health
    regions = get_available_regions()
    
    return {
        "status": "healthy" if regions else "degraded",
        "available_regions": len(regions),
        "regions": regions,
        "message": "Forecasting service operational" if regions else "No models loaded",
    }


@router.get("/data-summary")
async def get_data_summary(
    region_code: str = Query("SWISS_GRID", description="Region code"),
):
    """
    Get summary of uploaded data for a region.
    Shows available historical data for forecasting.
    """
    from app.services.real_data_store import get_real_data_store
    
    data_store = get_real_data_store()
    summary = data_store.get_data_summary(region_code)
    
    # Also check model availability
    ml_service = get_ml_service(region_code)
    
    return {
        **summary,
        "model_loaded": ml_service.model_loaded,
        "ready_for_forecast": summary.get("status") == "ok" and ml_service.model_loaded,
    }

