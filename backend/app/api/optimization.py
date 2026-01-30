"""
Powercast AI - Optimization API
AI-powered optimization suggestions for power grid operations
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from enum import Enum
from datetime import datetime
import logging
import random
import uuid

from app.core.config import settings
from app.core.supabase import get_supabase, MockDatabase

logger = logging.getLogger(__name__)
router = APIRouter()


# =========================================
# Enums & Models
# =========================================


class SuggestionType(str, Enum):
    dispatch = "dispatch"
    maintenance = "maintenance"
    cost = "cost"
    efficiency = "efficiency"


class SuggestionPriority(str, Enum):
    high = "high"
    medium = "medium"
    low = "low"


class SuggestionStatus(str, Enum):
    pending = "pending"
    applied = "applied"
    dismissed = "dismissed"


class SuggestionCreate(BaseModel):
    """Request model for creating a suggestion"""

    type: SuggestionType
    priority: SuggestionPriority
    title: str = Field(..., min_length=1, max_length=255)
    description: str
    impact_metric: Optional[str] = None
    impact_value: Optional[str] = None
    confidence: float = Field(..., ge=0, le=100)
    affected_plant_ids: List[str] = []


class SuggestionUpdate(BaseModel):
    """Request model for updating a suggestion status"""

    status: SuggestionStatus


class SuggestionResponse(BaseModel):
    """Response model for a suggestion"""

    id: str
    user_id: str
    type: SuggestionType
    priority: SuggestionPriority
    title: str
    description: str
    impact_metric: Optional[str] = None
    impact_value: Optional[str] = None
    confidence: float
    affected_plant_ids: List[str] = []
    status: SuggestionStatus
    metadata: Dict[str, Any] = {}
    created_at: str
    applied_at: Optional[str] = None
    dismissed_at: Optional[str] = None


class SuggestionListResponse(BaseModel):
    """Response model for suggestion list"""

    suggestions: List[SuggestionResponse]
    total: int


class OptimizationSummary(BaseModel):
    """Summary of optimization opportunities"""

    total_suggestions: int
    pending_count: int
    applied_count: int
    dismissed_count: int
    high_priority_count: int
    estimated_savings: str
    efficiency_gain: str


# =========================================
# AI Suggestion Generator
# =========================================

# Template suggestions for generating AI recommendations
SUGGESTION_TEMPLATES = [
    {
        "type": "dispatch",
        "priority": "high",
        "title": "Optimize Solar Farm Output During Peak Hours",
        "description": "Based on weather forecasts, increase Solar Farm Alpha output by 15% between 10:00-14:00 to capitalize on optimal irradiance conditions.",
        "impact_metric": "Revenue Increase",
        "impact_value": "+CHF 12,500/day",
        "confidence": 92.5,
    },
    {
        "type": "maintenance",
        "priority": "medium",
        "title": "Schedule Preventive Maintenance for Hydro Station",
        "description": "Efficiency degradation detected in Hydro Station Beta turbines. Schedule maintenance during low-demand period (02:00-05:00) to minimize production loss.",
        "impact_metric": "Efficiency Recovery",
        "impact_value": "+8.3%",
        "confidence": 87.0,
    },
    {
        "type": "cost",
        "priority": "high",
        "title": "Shift Load to Off-Peak Grid Pricing",
        "description": "Grid prices expected to drop 23% between 22:00-06:00. Consider shifting flexible loads and storage charging to this window.",
        "impact_metric": "Cost Savings",
        "impact_value": "-CHF 8,200/week",
        "confidence": 95.0,
    },
    {
        "type": "efficiency",
        "priority": "medium",
        "title": "Adjust Wind Farm Blade Pitch Angles",
        "description": "Wind pattern analysis suggests adjusting blade pitch by 2.3° on Wind Farm Delta turbines 5-8 for optimal energy capture.",
        "impact_metric": "Output Increase",
        "impact_value": "+42 MWh/day",
        "confidence": 84.5,
    },
    {
        "type": "dispatch",
        "priority": "low",
        "title": "Coordinate Nuclear Plant Ramping",
        "description": "Forecasted demand dip at 03:00. Consider reducing Nuclear Plant Gamma output by 5% to maintain grid stability and reduce wear.",
        "impact_metric": "Fuel Savings",
        "impact_value": "-0.3% fuel/month",
        "confidence": 78.0,
    },
    {
        "type": "efficiency",
        "priority": "high",
        "title": "Enable Advanced Grid Balancing Mode",
        "description": "ML model predicts 15% imbalance risk in next 4 hours. Activating advanced balancing across all plants can prevent frequency deviations.",
        "impact_metric": "Stability Index",
        "impact_value": "+12 points",
        "confidence": 91.0,
    },
]


def generate_ai_suggestions(user_id: str, count: int = 6) -> List[Dict[str, Any]]:
    """Generate AI-powered optimization suggestions"""
    now = datetime.utcnow()
    suggestions = []

    templates = random.sample(
        SUGGESTION_TEMPLATES, min(count, len(SUGGESTION_TEMPLATES))
    )

    for template in templates:
        suggestion = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            **template,
            "affected_plant_ids": [],  # Would be populated based on actual analysis
            "status": "pending",
            "metadata": {
                "generated_by": "ai",
                "model_version": "1.0.0",
                "analysis_timestamp": now.isoformat(),
            },
            "created_at": now.isoformat(),
            "applied_at": None,
            "dismissed_at": None,
        }
        suggestions.append(suggestion)

    return suggestions


# =========================================
# Helper Functions
# =========================================


def get_user_id(authorization: Optional[str] = None) -> str:
    """Extract user ID from authorization header"""
    return "demo-user"


# =========================================
# Routes
# =========================================


@router.get("", response_model=SuggestionListResponse)
async def list_suggestions(
    user_id: str = Depends(get_user_id),
    type: Optional[SuggestionType] = None,
    priority: Optional[SuggestionPriority] = None,
    status: Optional[SuggestionStatus] = None,
    limit: int = 50,
    offset: int = 0,
):
    """List all optimization suggestions for the current user"""
    supabase = get_supabase()

    if supabase:
        try:
            query = (
                supabase.table("optimization_suggestions")
                .select("*")
                .eq("user_id", user_id)
            )

            if type:
                query = query.eq("type", type.value)
            if priority:
                query = query.eq("priority", priority.value)
            if status:
                query = query.eq("status", status.value)

            query = query.order("created_at", desc=True).range(
                offset, offset + limit - 1
            )

            result = query.execute()
            suggestions = [SuggestionResponse(**s) for s in result.data]

            count_result = (
                supabase.table("optimization_suggestions")
                .select("*", count="exact")
                .eq("user_id", user_id)
                .execute()
            )
            total = count_result.count or len(suggestions)

            return SuggestionListResponse(suggestions=suggestions, total=total)

        except Exception as e:
            logger.error(f"Supabase error: {e}")
            raise HTTPException(status_code=500, detail="Database error")

    else:
        # Use or generate mock suggestions
        if not MockDatabase._suggestions:
            # Generate initial suggestions
            for s in generate_ai_suggestions(user_id):
                MockDatabase._suggestions[s["id"]] = s

        suggestions = list(MockDatabase._suggestions.values())
        suggestions = [s for s in suggestions if s.get("user_id") == user_id]

        if type:
            suggestions = [s for s in suggestions if s["type"] == type.value]
        if priority:
            suggestions = [s for s in suggestions if s["priority"] == priority.value]
        if status:
            suggestions = [s for s in suggestions if s["status"] == status.value]

        # Sort by created_at descending
        suggestions.sort(key=lambda x: x["created_at"], reverse=True)

        total = len(suggestions)
        suggestions = suggestions[offset : offset + limit]

        return SuggestionListResponse(
            suggestions=[SuggestionResponse(**s) for s in suggestions], total=total
        )


@router.get("/summary", response_model=OptimizationSummary)
async def get_optimization_summary(user_id: str = Depends(get_user_id)):
    """Get summary of optimization opportunities"""
    supabase = get_supabase()

    if supabase:
        try:
            result = (
                supabase.table("optimization_suggestions")
                .select("*")
                .eq("user_id", user_id)
                .execute()
            )
            suggestions = result.data
        except Exception as e:
            logger.error(f"Supabase error: {e}")
            suggestions = []
    else:
        suggestions = [
            s for s in MockDatabase._suggestions.values() if s.get("user_id") == user_id
        ]

    # Calculate summary
    pending = [s for s in suggestions if s["status"] == "pending"]
    applied = [s for s in suggestions if s["status"] == "applied"]
    dismissed = [s for s in suggestions if s["status"] == "dismissed"]
    high_priority = [s for s in pending if s["priority"] == "high"]

    return OptimizationSummary(
        total_suggestions=len(suggestions),
        pending_count=len(pending),
        applied_count=len(applied),
        dismissed_count=len(dismissed),
        high_priority_count=len(high_priority),
        estimated_savings="CHF 45,200/month",  # Would be calculated from actual data
        efficiency_gain="+7.3%",  # Would be calculated from actual data
    )


@router.post("/generate")
async def generate_suggestions(
    user_id: str = Depends(get_user_id),
    count: int = 6,
):
    """Generate new AI-powered optimization suggestions"""
    supabase = get_supabase()

    new_suggestions = generate_ai_suggestions(user_id, count)

    if supabase:
        try:
            # Insert new suggestions
            result = (
                supabase.table("optimization_suggestions")
                .insert(new_suggestions)
                .execute()
            )

            return {
                "message": f"Generated {len(result.data)} new suggestions",
                "suggestions": [SuggestionResponse(**s) for s in result.data],
            }

        except Exception as e:
            logger.error(f"Supabase error: {e}")
            raise HTTPException(status_code=500, detail="Database error")

    else:
        # Store in mock database
        for s in new_suggestions:
            MockDatabase._suggestions[s["id"]] = s

        return {
            "message": f"Generated {len(new_suggestions)} new suggestions",
            "suggestions": [SuggestionResponse(**s) for s in new_suggestions],
        }


@router.get("/{suggestion_id}", response_model=SuggestionResponse)
async def get_suggestion(suggestion_id: str, user_id: str = Depends(get_user_id)):
    """Get a single suggestion by ID"""
    supabase = get_supabase()

    if supabase:
        try:
            result = (
                supabase.table("optimization_suggestions")
                .select("*")
                .eq("id", suggestion_id)
                .eq("user_id", user_id)
                .single()
                .execute()
            )

            if not result.data:
                raise HTTPException(status_code=404, detail="Suggestion not found")

            return SuggestionResponse(**result.data)

        except Exception as e:
            if "404" in str(e):
                raise HTTPException(status_code=404, detail="Suggestion not found")
            logger.error(f"Supabase error: {e}")
            raise HTTPException(status_code=500, detail="Database error")

    else:
        suggestion = MockDatabase._suggestions.get(suggestion_id)
        if not suggestion:
            raise HTTPException(status_code=404, detail="Suggestion not found")
        if suggestion.get("user_id") != user_id:
            raise HTTPException(status_code=403, detail="Access denied")

        return SuggestionResponse(**suggestion)


@router.patch("/{suggestion_id}/apply", response_model=SuggestionResponse)
async def apply_suggestion(suggestion_id: str, user_id: str = Depends(get_user_id)):
    """Apply an optimization suggestion"""
    supabase = get_supabase()
    now = datetime.utcnow()

    if supabase:
        try:
            # Check ownership
            check = (
                supabase.table("optimization_suggestions")
                .select("*")
                .eq("id", suggestion_id)
                .eq("user_id", user_id)
                .single()
                .execute()
            )

            if not check.data:
                raise HTTPException(status_code=404, detail="Suggestion not found")

            result = (
                supabase.table("optimization_suggestions")
                .update(
                    {
                        "status": "applied",
                        "applied_at": now.isoformat(),
                    }
                )
                .eq("id", suggestion_id)
                .execute()
            )

            return SuggestionResponse(**result.data[0])

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Supabase error: {e}")
            raise HTTPException(status_code=500, detail="Database error")

    else:
        suggestion = MockDatabase._suggestions.get(suggestion_id)
        if not suggestion:
            raise HTTPException(status_code=404, detail="Suggestion not found")
        if suggestion.get("user_id") != user_id:
            raise HTTPException(status_code=403, detail="Access denied")

        suggestion["status"] = "applied"
        suggestion["applied_at"] = now.isoformat()

        return SuggestionResponse(**suggestion)


@router.patch("/{suggestion_id}/dismiss", response_model=SuggestionResponse)
async def dismiss_suggestion(suggestion_id: str, user_id: str = Depends(get_user_id)):
    """Dismiss an optimization suggestion"""
    supabase = get_supabase()
    now = datetime.utcnow()

    if supabase:
        try:
            check = (
                supabase.table("optimization_suggestions")
                .select("*")
                .eq("id", suggestion_id)
                .eq("user_id", user_id)
                .single()
                .execute()
            )

            if not check.data:
                raise HTTPException(status_code=404, detail="Suggestion not found")

            result = (
                supabase.table("optimization_suggestions")
                .update(
                    {
                        "status": "dismissed",
                        "dismissed_at": now.isoformat(),
                    }
                )
                .eq("id", suggestion_id)
                .execute()
            )

            return SuggestionResponse(**result.data[0])

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Supabase error: {e}")
            raise HTTPException(status_code=500, detail="Database error")

    else:
        suggestion = MockDatabase._suggestions.get(suggestion_id)
        if not suggestion:
            raise HTTPException(status_code=404, detail="Suggestion not found")
        if suggestion.get("user_id") != user_id:
            raise HTTPException(status_code=403, detail="Access denied")

        suggestion["status"] = "dismissed"
        suggestion["dismissed_at"] = now.isoformat()

        return SuggestionResponse(**suggestion)


@router.delete("/{suggestion_id}", status_code=204)
async def delete_suggestion(suggestion_id: str, user_id: str = Depends(get_user_id)):
    """Delete a suggestion"""
    supabase = get_supabase()

    if supabase:
        try:
            check = (
                supabase.table("optimization_suggestions")
                .select("id")
                .eq("id", suggestion_id)
                .eq("user_id", user_id)
                .execute()
            )

            if not check.data:
                raise HTTPException(status_code=404, detail="Suggestion not found")

            supabase.table("optimization_suggestions").delete().eq(
                "id", suggestion_id
            ).execute()
            return None

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Supabase error: {e}")
            raise HTTPException(status_code=500, detail="Database error")

    else:
        suggestion = MockDatabase._suggestions.get(suggestion_id)
        if not suggestion:
            raise HTTPException(status_code=404, detail="Suggestion not found")
        if suggestion.get("user_id") != user_id:
            raise HTTPException(status_code=403, detail="Access denied")

        del MockDatabase._suggestions[suggestion_id]
        return None
