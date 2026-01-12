"""
Powercast AI - Assets API Routes
"""
from fastapi import APIRouter, Query
from typing import Optional, List

from app.services.data_service import DataServiceSingleton

router = APIRouter()


@router.get("")
async def get_assets(
    asset_type: Optional[str] = Query(None, description="Filter by type: hydro, solar, wind, nuclear"),
    status: Optional[str] = Query(None, description="Filter by status: online, offline"),
    region: Optional[str] = Query(None, description="Filter by region")
):
    """
    Get all grid assets with optional filtering
    """
    state = DataServiceSingleton.get_current_state()
    assets = state['assets']
    
    # Apply filters
    if asset_type:
        assets = [a for a in assets if a['type'] == asset_type]
    
    if status:
        is_online = status.lower() == 'online'
        assets = [a for a in assets if a['online'] == is_online]
    
    if region:
        assets = [a for a in assets if a['region'] == region]
    
    return {
        "count": len(assets),
        "assets": assets
    }


@router.get("/{asset_id}")
async def get_asset(asset_id: str):
    """
    Get specific asset details
    """
    state = DataServiceSingleton.get_current_state()
    assets = state['assets']
    
    asset = next((a for a in assets if a['id'] == asset_id), None)
    
    if asset is None:
        return {"error": "Asset not found"}
    
    return asset


@router.get("/{asset_id}/forecast")
async def get_asset_forecast(asset_id: str, horizon_hours: int = 24):
    """
    Get forecast for specific asset
    """
    state = DataServiceSingleton.get_current_state()
    assets = state['assets']
    
    asset = next((a for a in assets if a['id'] == asset_id), None)
    
    if asset is None:
        return {"error": "Asset not found"}
    
    # Generate asset-specific forecast based on type
    if asset['type'] == 'solar':
        forecast = DataServiceSingleton.get_forecast('solar', horizon_hours)
        # Scale to asset capacity
        scale = asset['capacity_mw'] / 5000
        for f in forecast['forecasts']:
            f['point'] = round(f['point'] * scale, 1)
            f['q10'] = round(f['q10'] * scale, 1)
            f['q50'] = round(f['q50'] * scale, 1)
            f['q90'] = round(f['q90'] * scale, 1)
    elif asset['type'] == 'wind':
        forecast = DataServiceSingleton.get_forecast('wind', horizon_hours)
        scale = asset['capacity_mw'] / 300
        for f in forecast['forecasts']:
            f['point'] = round(f['point'] * scale, 1)
    else:
        # Hydro/Nuclear - relatively stable output forecast
        forecast = {
            "message": f"Stable output forecast for {asset['type']} asset",
            "expected_output_mw": asset['current_output_mw']
        }
    
    return {
        "asset_id": asset_id,
        "asset_name": asset['name'],
        "forecast": forecast
    }


@router.get("/summary/by-type")
async def get_assets_summary():
    """
    Get summary of assets grouped by type
    """
    state = DataServiceSingleton.get_current_state()
    assets = state['assets']
    
    summary = {}
    for asset in assets:
        asset_type = asset['type']
        if asset_type not in summary:
            summary[asset_type] = {
                'count': 0,
                'total_capacity_mw': 0,
                'total_output_mw': 0,
                'online_count': 0
            }
        
        summary[asset_type]['count'] += 1
        summary[asset_type]['total_capacity_mw'] += asset['capacity_mw']
        summary[asset_type]['total_output_mw'] += asset['current_output_mw']
        if asset['online']:
            summary[asset_type]['online_count'] += 1
    
    return summary
