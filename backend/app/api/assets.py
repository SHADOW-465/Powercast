"""
Powercast AI - Assets API Routes
"""

from fastapi import APIRouter, Query
from typing import Optional, List

from app.services.data_service import DataServiceSingleton

router = APIRouter()


@router.get("")
async def get_assets(
    asset_type: Optional[str] = Query(
        None, description="Filter by type: hydro, solar, wind, nuclear"
    ),
    status: Optional[str] = Query(
        None, description="Filter by status: online, offline"
    ),
    region: Optional[str] = Query(None, description="Filter by region"),
):
    """
    Get all grid assets with optional filtering
    """
    assets_data = DataServiceSingleton.get_assets()

    # Convert to list format
    assets = [
        {
            "id": key,
            "name": value["name"],
            "type": key.lower(),
            "capacity_mw": value["capacity_mw"],
            "current_output_mw": value["current_output_mw"],
            "availability": value["availability"],
            "status": value["status"],
            "online": value["status"] == "operational",
            "region": "switzerland",
        }
        for key, value in assets_data.items()
    ]

    # Apply filters
    if asset_type:
        assets = [a for a in assets if a["type"] == asset_type.lower()]

    if status:
        is_online = status.lower() == "online"
        assets = [a for a in assets if a["online"] == is_online]

    if region:
        assets = [a for a in assets if a["region"] == region]

    return {"count": len(assets), "assets": assets}


@router.get("/{asset_id}")
async def get_asset(asset_id: str):
    """
    Get specific asset details
    """
    assets_data = DataServiceSingleton.get_assets()

    if asset_id.lower() not in assets_data:
        return {"error": "Asset not found"}

    asset = assets_data[asset_id.lower()]

    return {
        "id": asset_id,
        "name": asset["name"],
        "type": asset_id.lower(),
        "capacity_mw": asset["capacity_mw"],
        "current_output_mw": asset["current_output_mw"],
        "availability": asset["availability"],
        "status": asset["status"],
        "online": asset["status"] == "operational",
        "region": "switzerland",
    }


@router.get("/{asset_id}/forecast")
async def get_asset_forecast(asset_id: str, horizon_hours: int = 24):
    """
    Get forecast for specific asset
    """
    assets_data = DataServiceSingleton.get_assets()

    if asset_id.lower() not in assets_data:
        return {"error": "Asset not found"}

    asset = assets_data[asset_id.lower()]

    # Generate asset-specific forecast based on type
    if asset_id.lower() == "solar":
        forecast = DataServiceSingleton.get_forecast("solar", horizon_hours)
        # Scale to asset capacity
        scale = asset["capacity_mw"] / 5000
        for f in forecast["predictions"]:
            f["point"] = round(f["point"] * scale, 1)
            f["q10"] = round(f["q10"] * scale, 1)
            f["q90"] = round(f["q90"] * scale, 1)
    elif asset_id.lower() == "wind":
        forecast = DataServiceSingleton.get_forecast("wind", horizon_hours)
        scale = asset["capacity_mw"] / 300
        for f in forecast["predictions"]:
            f["point"] = round(f["point"] * scale, 1)
    else:
        # Hydro/Nuclear - relatively stable output forecast
        forecast = {
            "message": f"Stable output forecast for {asset_id.lower()} asset",
            "expected_output_mw": asset["current_output_mw"],
        }

    return {"asset_id": asset_id, "asset_name": asset["name"], "forecast": forecast}

    return {"asset_id": asset_id, "asset_name": asset["name"], "forecast": forecast}


@router.get("/summary/by-type")
async def get_assets_summary():
    """
    Get summary of assets grouped by type
    """
    assets_data = DataServiceSingleton.get_assets()

    summary = {}
    for asset_type, asset_info in assets_data.items():
        summary[asset_type] = {
            "count": 1,
            "total_capacity_mw": asset_info["capacity_mw"],
            "total_output_mw": asset_info["current_output_mw"],
            "online_count": 1 if asset_info["status"] == "operational" else 0,
        }

    return summary
