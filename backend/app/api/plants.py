"""
Powercast AI - Plants API
CRUD operations for power plants with Supabase + mock fallback
"""

from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from enum import Enum
from datetime import datetime
import logging

from app.core.config import settings
from app.core.supabase import get_supabase, MockDatabase

logger = logging.getLogger(__name__)
router = APIRouter()


# =========================================
# Enums & Models
# =========================================


class PlantType(str, Enum):
    solar = "solar"
    hydro = "hydro"
    nuclear = "nuclear"
    wind = "wind"
    thermal = "thermal"


class PlantStatus(str, Enum):
    online = "online"
    offline = "offline"
    maintenance = "maintenance"


class PlantCreate(BaseModel):
    """Request model for creating a plant"""

    name: str = Field(..., min_length=1, max_length=255)
    type: PlantType
    capacity_mw: float = Field(..., gt=0)
    current_output_mw: float = Field(0, ge=0)
    status: PlantStatus = PlantStatus.online
    location: Optional[str] = None
    efficiency_pct: Optional[float] = Field(None, ge=0, le=100)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class PlantUpdate(BaseModel):
    """Request model for updating a plant"""

    name: Optional[str] = Field(None, min_length=1, max_length=255)
    type: Optional[PlantType] = None
    capacity_mw: Optional[float] = Field(None, gt=0)
    current_output_mw: Optional[float] = Field(None, ge=0)
    status: Optional[PlantStatus] = None
    location: Optional[str] = None
    efficiency_pct: Optional[float] = Field(None, ge=0, le=100)
    metadata: Optional[Dict[str, Any]] = None


class PlantResponse(BaseModel):
    """Response model for a plant"""

    id: str
    user_id: str
    name: str
    type: PlantType
    capacity_mw: float
    current_output_mw: float
    status: PlantStatus
    location: Optional[str] = None
    efficiency_pct: Optional[float] = None
    metadata: Dict[str, Any] = {}
    created_at: str
    updated_at: str


class PlantListResponse(BaseModel):
    """Response model for plant list"""

    plants: List[PlantResponse]
    total: int


# =========================================
# Helper Functions
# =========================================


def get_user_id(authorization: Optional[str] = Header(None)) -> str:
    """
    Extract user ID from authorization header.
    In production, this validates the Supabase JWT.
    For development, uses demo user.
    """
    if not authorization:
        # Development mode - use demo user
        return "demo-user"

    # In production, validate JWT and extract user ID
    # For now, return demo user
    # TODO: Implement proper JWT validation
    return "demo-user"


# =========================================
# Routes
# =========================================


@router.get("", response_model=PlantListResponse)
async def list_plants(
    user_id: str = Depends(get_user_id),
    type: Optional[PlantType] = None,
    status: Optional[PlantStatus] = None,
    limit: int = 50,
    offset: int = 0,
):
    """List all plants for the current user"""
    supabase = get_supabase()

    if supabase:
        # Production: Use Supabase
        try:
            query = supabase.table("plants").select("*").eq("user_id", user_id)

            if type:
                query = query.eq("type", type.value)
            if status:
                query = query.eq("status", status.value)

            query = query.order("created_at", desc=True).range(
                offset, offset + limit - 1
            )

            result = query.execute()
            plants = [PlantResponse(**p) for p in result.data]

            # Get total count
            count_result = (
                supabase.table("plants")
                .select("*", count="exact")
                .eq("user_id", user_id)
                .execute()
            )
            total = count_result.count or len(plants)

            return PlantListResponse(plants=plants, total=total)

        except Exception as e:
            logger.error(f"Supabase error: {e}")
            raise HTTPException(status_code=500, detail="Database error")

    else:
        # Development: Use mock database
        plants = MockDatabase.get_plants(user_id)

        # Apply filters
        if type:
            plants = [p for p in plants if p["type"] == type.value]
        if status:
            plants = [p for p in plants if p["status"] == status.value]

        total = len(plants)
        plants = plants[offset : offset + limit]

        return PlantListResponse(
            plants=[PlantResponse(**p) for p in plants], total=total
        )


@router.get("/{plant_id}", response_model=PlantResponse)
async def get_plant(plant_id: str, user_id: str = Depends(get_user_id)):
    """Get a single plant by ID"""
    supabase = get_supabase()

    if supabase:
        try:
            result = (
                supabase.table("plants")
                .select("*")
                .eq("id", plant_id)
                .eq("user_id", user_id)
                .single()
                .execute()
            )

            if not result.data:
                raise HTTPException(status_code=404, detail="Plant not found")

            return PlantResponse(**result.data)

        except Exception as e:
            if "404" in str(e):
                raise HTTPException(status_code=404, detail="Plant not found")
            logger.error(f"Supabase error: {e}")
            raise HTTPException(status_code=500, detail="Database error")

    else:
        plant = MockDatabase.get_plant(plant_id)
        if not plant:
            raise HTTPException(status_code=404, detail="Plant not found")
        if plant["user_id"] != user_id:
            raise HTTPException(status_code=403, detail="Access denied")

        return PlantResponse(**plant)


@router.post("", response_model=PlantResponse, status_code=201)
async def create_plant(plant: PlantCreate, user_id: str = Depends(get_user_id)):
    """Create a new plant"""
    supabase = get_supabase()

    plant_data = {
        "user_id": user_id,
        **plant.model_dump(),
    }

    # Convert enum to string
    plant_data["type"] = plant_data["type"].value
    plant_data["status"] = plant_data["status"].value

    if supabase:
        try:
            result = supabase.table("plants").insert(plant_data).execute()

            if not result.data:
                raise HTTPException(status_code=500, detail="Failed to create plant")

            return PlantResponse(**result.data[0])

        except Exception as e:
            logger.error(f"Supabase error: {e}")
            raise HTTPException(status_code=500, detail="Database error")

    else:
        new_plant = MockDatabase.create_plant(plant_data)
        return PlantResponse(**new_plant)


@router.patch("/{plant_id}", response_model=PlantResponse)
async def update_plant(
    plant_id: str, plant: PlantUpdate, user_id: str = Depends(get_user_id)
):
    """Update an existing plant"""
    supabase = get_supabase()

    # Filter out None values
    update_data = {k: v for k, v in plant.model_dump().items() if v is not None}

    # Convert enums to strings
    if "type" in update_data:
        update_data["type"] = update_data["type"].value
    if "status" in update_data:
        update_data["status"] = update_data["status"].value

    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    if supabase:
        try:
            # First check if plant exists and belongs to user
            check = (
                supabase.table("plants")
                .select("id")
                .eq("id", plant_id)
                .eq("user_id", user_id)
                .execute()
            )

            if not check.data:
                raise HTTPException(status_code=404, detail="Plant not found")

            result = (
                supabase.table("plants")
                .update(update_data)
                .eq("id", plant_id)
                .execute()
            )

            return PlantResponse(**result.data[0])

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Supabase error: {e}")
            raise HTTPException(status_code=500, detail="Database error")

    else:
        # Check ownership
        existing = MockDatabase.get_plant(plant_id)
        if not existing:
            raise HTTPException(status_code=404, detail="Plant not found")
        if existing["user_id"] != user_id:
            raise HTTPException(status_code=403, detail="Access denied")

        updated = MockDatabase.update_plant(plant_id, update_data)
        return PlantResponse(**updated)


@router.delete("/{plant_id}", status_code=204)
async def delete_plant(plant_id: str, user_id: str = Depends(get_user_id)):
    """Delete a plant"""
    supabase = get_supabase()

    if supabase:
        try:
            # Check ownership first
            check = (
                supabase.table("plants")
                .select("id")
                .eq("id", plant_id)
                .eq("user_id", user_id)
                .execute()
            )

            if not check.data:
                raise HTTPException(status_code=404, detail="Plant not found")

            supabase.table("plants").delete().eq("id", plant_id).execute()
            return None

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Supabase error: {e}")
            raise HTTPException(status_code=500, detail="Database error")

    else:
        existing = MockDatabase.get_plant(plant_id)
        if not existing:
            raise HTTPException(status_code=404, detail="Plant not found")
        if existing["user_id"] != user_id:
            raise HTTPException(status_code=403, detail="Access denied")

        MockDatabase.delete_plant(plant_id)
        return None


# =========================================
# Forecast Data Routes
# =========================================


@router.get("/{plant_id}/forecast")
async def get_plant_forecast(
    plant_id: str,
    user_id: str = Depends(get_user_id),
    hours: int = 24,
):
    """Get forecast data for a specific plant"""
    supabase = get_supabase()

    if supabase:
        try:
            # First verify access to the plant
            plant_check = (
                supabase.table("plants")
                .select("id")
                .eq("id", plant_id)
                .eq("user_id", user_id)
                .execute()
            )

            if not plant_check.data:
                raise HTTPException(status_code=404, detail="Plant not found")

            # Get forecast data
            result = (
                supabase.table("forecast_data")
                .select("*")
                .eq("plant_id", plant_id)
                .order("timestamp", desc=False)
                .limit(hours * 4)
                .execute()
            )

            return {"plant_id": plant_id, "forecasts": result.data}

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Supabase error: {e}")
            raise HTTPException(status_code=500, detail="Database error")

    else:
        # Check plant access
        plant = MockDatabase.get_plant(plant_id)
        if not plant:
            raise HTTPException(status_code=404, detail="Plant not found")
        if plant["user_id"] != user_id:
            raise HTTPException(status_code=403, detail="Access denied")

        forecasts = MockDatabase.get_forecasts(plant_id)
        return {"plant_id": plant_id, "forecasts": forecasts[: hours * 4]}


@router.get("/{plant_id}/metrics")
async def get_plant_metrics(
    plant_id: str,
    user_id: str = Depends(get_user_id),
):
    """Get real-time metrics for a plant"""
    supabase = get_supabase()

    if supabase:
        try:
            # Verify access
            plant_check = (
                supabase.table("plants")
                .select("*")
                .eq("id", plant_id)
                .eq("user_id", user_id)
                .single()
                .execute()
            )

            if not plant_check.data:
                raise HTTPException(status_code=404, detail="Plant not found")

            plant = plant_check.data

            # Get latest metrics
            metrics_result = (
                supabase.table("plant_metrics")
                .select("*")
                .eq("plant_id", plant_id)
                .order("timestamp", desc=True)
                .limit(1)
                .execute()
            )

            latest_metrics = metrics_result.data[0] if metrics_result.data else None

            return {
                "plant_id": plant_id,
                "name": plant["name"],
                "type": plant["type"],
                "current_output_mw": plant["current_output_mw"],
                "capacity_mw": plant["capacity_mw"],
                "efficiency_pct": plant.get("efficiency_pct"),
                "status": plant["status"],
                "latest_metrics": latest_metrics,
            }

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Supabase error: {e}")
            raise HTTPException(status_code=500, detail="Database error")

    else:
        plant = MockDatabase.get_plant(plant_id)
        if not plant:
            raise HTTPException(status_code=404, detail="Plant not found")
        if plant["user_id"] != user_id:
            raise HTTPException(status_code=403, detail="Access denied")

        return {
            "plant_id": plant_id,
            "name": plant["name"],
            "type": plant["type"],
            "current_output_mw": plant["current_output_mw"],
            "capacity_mw": plant["capacity_mw"],
            "efficiency_pct": plant.get("efficiency_pct"),
            "status": plant["status"],
            "latest_metrics": None,
        }
