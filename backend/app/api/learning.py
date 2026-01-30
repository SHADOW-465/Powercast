"""
Powercast AI - Learning System API Routes
Endpoints for monitoring and managing the closed-loop learning system.

This module provides:
- Health checks for all learning components
- Active rules/lessons overview
- Error history and analysis triggers
- Manual evaluation endpoints
"""
from fastapi import APIRouter, Query, HTTPException
from typing import Optional, List, Dict, Any
from datetime import datetime
import logging

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/health")
async def learning_system_health():
    """
    Get health status of all learning system components.
    
    Returns status of:
    - Forecast Logger
    - Error Observer
    - Context Engine
    - LLM Reasoning
    - Rule Engine
    - Forecast Adjuster
    """
    components = {}
    overall_status = "healthy"
    
    try:
        from app.services.forecast_logger import get_forecast_logger
        components["forecast_logger"] = get_forecast_logger().health_check()
    except Exception as e:
        components["forecast_logger"] = {"status": "error", "error": str(e)}
        overall_status = "degraded"
    
    try:
        from app.services.error_observer import get_error_observer
        # ErrorObserver doesn't have health_check, just verify it initializes
        get_error_observer()
        components["error_observer"] = {"status": "healthy"}
    except Exception as e:
        components["error_observer"] = {"status": "error", "error": str(e)}
        overall_status = "degraded"
    
    try:
        from app.services.context_engine import get_context_engine
        components["context_engine"] = get_context_engine().health_check()
        if components["context_engine"].get("status") == "degraded":
            overall_status = "degraded"
    except Exception as e:
        components["context_engine"] = {"status": "error", "error": str(e)}
        overall_status = "degraded"
    
    try:
        from app.services.llm_reasoning import get_llm_reasoning_service
        components["llm_reasoning"] = get_llm_reasoning_service().health_check()
        if components["llm_reasoning"].get("status") == "degraded":
            overall_status = "degraded"
    except Exception as e:
        components["llm_reasoning"] = {"status": "error", "error": str(e)}
        overall_status = "degraded"
    
    try:
        from app.services.rule_engine import get_rule_engine
        # RuleEngine doesn't have health_check, just verify it initializes
        get_rule_engine()
        components["rule_engine"] = {"status": "healthy"}
    except Exception as e:
        components["rule_engine"] = {"status": "error", "error": str(e)}
        overall_status = "degraded"
    
    try:
        from app.services.forecast_adjuster import get_forecast_adjuster
        components["forecast_adjuster"] = get_forecast_adjuster().health_check()
        if components["forecast_adjuster"].get("status") == "degraded":
            overall_status = "degraded"
    except Exception as e:
        components["forecast_adjuster"] = {"status": "error", "error": str(e)}
        overall_status = "degraded"
    
    return {
        "status": overall_status,
        "components": components,
        "timestamp": datetime.utcnow().isoformat(),
    }


@router.get("/rules")
async def get_active_rules(
    region_code: str = Query("SWISS_GRID", description="Region code"),
):
    """
    Get summary of active learned rules for a region.
    
    Returns rules sorted by application count and success rate.
    """
    try:
        from app.services.rule_engine import get_rule_engine
        rule_engine = get_rule_engine()
        return rule_engine.get_active_rules_summary(region_code)
    except Exception as e:
        logger.error(f"Failed to get active rules: {e}")
        return {
            "rules_count": 0,
            "rules": [],
            "error": str(e),
        }


@router.get("/errors")
async def get_recent_errors(
    region_code: str = Query("SWISS_GRID", description="Region code"),
    limit: int = Query(10, ge=1, le=50, description="Maximum errors to return"),
    severity: Optional[str] = Query(None, description="Filter by severity: low, medium, high, critical"),
):
    """
    Get recent forecast errors for a region.
    
    Returns errors sorted by observation time (most recent first).
    """
    try:
        from app.core.supabase import get_supabase_admin
        supabase = get_supabase_admin()
        
        if not supabase:
            return {"errors": [], "message": "Database not configured"}
        
        query = (
            supabase.table("forecast_errors")
            .select("*, forecast_events!inner(region_code, forecast_start)")
            .eq("forecast_events.region_code", region_code)
            .order("observed_at", desc=True)
            .limit(limit)
        )
        
        if severity:
            query = query.eq("severity", severity)
        
        result = query.execute()
        
        return {
            "errors": result.data or [],
            "count": len(result.data or []),
        }
    except Exception as e:
        logger.error(f"Failed to get errors: {e}")
        return {"errors": [], "error": str(e)}


@router.get("/forecasts")
async def get_recent_forecasts(
    region_code: str = Query("SWISS_GRID", description="Region code"),
    limit: int = Query(10, ge=1, le=50, description="Maximum forecasts to return"),
):
    """
    Get recent forecast events for a region.
    
    Returns logged forecasts with their adjustment metadata.
    """
    try:
        from app.services.forecast_logger import get_forecast_logger
        forecast_logger = get_forecast_logger()
        forecasts = forecast_logger.get_recent_forecasts(region_code, limit)
        
        return {
            "forecasts": forecasts,
            "count": len(forecasts),
        }
    except Exception as e:
        logger.error(f"Failed to get forecasts: {e}")
        return {"forecasts": [], "error": str(e)}


@router.get("/pending-analysis")
async def get_pending_analysis(
    limit: int = Query(10, ge=1, le=50, description="Maximum items to return"),
):
    """
    Get forecast errors that are awaiting LLM analysis.
    
    These are errors with analysis_triggered=true but no completion time.
    """
    try:
        from app.services.error_observer import get_error_observer
        observer = get_error_observer()
        pending = observer.get_pending_analysis(limit)
        
        return {
            "pending_count": len(pending),
            "items": pending,
        }
    except Exception as e:
        logger.error(f"Failed to get pending analysis: {e}")
        return {"pending_count": 0, "items": [], "error": str(e)}


@router.post("/analyze-error/{error_id}")
async def trigger_error_analysis(error_id: str):
    """
    Manually trigger LLM analysis for a specific error.
    
    This creates a context snapshot and generates a lesson.
    """
    try:
        from app.core.supabase import get_supabase_admin
        from app.services.context_engine import get_context_engine
        from app.services.llm_reasoning import get_llm_reasoning_service
        
        supabase = get_supabase_admin()
        if not supabase:
            raise HTTPException(status_code=500, detail="Database not configured")
        
        # Fetch error details
        error_result = (
            supabase.table("forecast_errors")
            .select("*, forecast_events(*)")
            .eq("id", error_id)
            .single()
            .execute()
        )
        
        if not error_result.data:
            raise HTTPException(status_code=404, detail="Error not found")
        
        error = error_result.data
        forecast_event = error.get("forecast_events", {})
        
        # Create context snapshot
        context_engine = get_context_engine()
        snapshot = await context_engine.create_context_snapshot(
            forecast_error_id=error_id,
            region_code=forecast_event.get("region_code", "SWISS_GRID"),
            time_window_start=datetime.fromisoformat(forecast_event.get("forecast_start", datetime.utcnow().isoformat())),
            time_window_end=datetime.utcnow(),
        )
        
        if not snapshot:
            raise HTTPException(status_code=500, detail="Failed to create context snapshot")
        
        # Run LLM analysis
        llm_service = get_llm_reasoning_service()
        analysis = await llm_service.analyze_error(
            error_type=error.get("error_type"),
            severity=error.get("severity"),
            region_code=forecast_event.get("region_code", "SWISS_GRID"),
            error_time=datetime.utcnow(),
            mape=error.get("mape"),
            peak_error_mw=error.get("peak_error_mw"),
            ramp_error=error.get("ramp_error_mw_per_hour"),
            context_summary=snapshot.context_summary,
            weather_context=snapshot.weather_context,
            event_context=snapshot.event_context,
        )
        
        if not analysis:
            raise HTTPException(status_code=500, detail="LLM analysis failed")
        
        # Store as lesson
        lesson_id = await llm_service.store_lesson(
            context_snapshot_id=str(snapshot.forecast_error_id),  # Use error_id as snapshot reference
            analysis=analysis,
        )
        
        # Mark analysis as complete
        supabase.table("forecast_errors").update({
            "analysis_completed_at": datetime.utcnow().isoformat(),
        }).eq("id", error_id).execute()
        
        return {
            "success": True,
            "lesson_id": lesson_id,
            "analysis": analysis.to_db_dict() if analysis else None,
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error analysis failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/explain/{forecast_id}")
async def explain_forecast(forecast_id: str):
    """
    Get detailed explanation of adjustments applied to a forecast.
    
    Returns the rules that were matched and applied with their reasoning.
    """
    try:
        from app.core.supabase import get_supabase_admin
        supabase = get_supabase_admin()
        
        if not supabase:
            raise HTTPException(status_code=500, detail="Database not configured")
        
        # Get forecast event
        forecast_result = (
            supabase.table("forecast_events")
            .select("*")
            .eq("forecast_id", forecast_id)
            .single()
            .execute()
        )
        
        if not forecast_result.data:
            raise HTTPException(status_code=404, detail="Forecast not found")
        
        forecast = forecast_result.data
        
        # Get rule applications
        applications_result = (
            supabase.table("rule_applications")
            .select("*, generalized_lessons(*)")
            .eq("forecast_event_id", forecast["id"])
            .execute()
        )
        
        applications = applications_result.data or []
        
        return {
            "forecast_id": forecast_id,
            "region_code": forecast.get("region_code"),
            "created_at": forecast.get("created_at"),
            "adjustments_applied": len(applications) > 0,
            "rules_applied": [
                {
                    "lesson_id": app.get("lesson_id"),
                    "explanation": app.get("explanation"),
                    "adjustment_factor": app.get("adjustment_factor"),
                    "match_confidence": app.get("match_confidence"),
                    "lesson": app.get("generalized_lessons", {}),
                }
                for app in applications
            ],
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to explain forecast: {e}")
        raise HTTPException(status_code=500, detail=str(e))
