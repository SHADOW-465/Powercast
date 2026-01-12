"""
Powercast AI - Scenarios API Routes
"""
from fastapi import APIRouter, Query
from typing import Optional

from app.services.data_service import DataServiceSingleton

router = APIRouter()


@router.get("")
async def get_scenarios(
    n_scenarios: int = Query(1000, ge=100, le=5000, description="Number of scenarios")
):
    """
    Get Monte Carlo scenarios for optimization
    """
    return DataServiceSingleton.get_scenarios(n_scenarios)


@router.get("/heatmap")
async def get_scenario_heatmap():
    """
    Get probability distribution data for heatmap visualization
    """
    scenarios = DataServiceSingleton.get_scenarios(500)
    
    # Create heatmap data (simplified - would use actual density estimation)
    return {
        "generated_at": scenarios['generated_at'],
        "horizon_intervals": scenarios['horizon_intervals'],
        "power_range": {
            "min": 2000,
            "max": 10000,
            "bins": 50
        },
        "percentiles": scenarios['percentiles'],
        "statistics": scenarios['statistics']
    }


@router.get("/optimization-strategies")
async def get_optimization_strategies():
    """
    Get available optimization strategies
    """
    return {
        "strategies": [
            {
                "id": "expected_cost",
                "name": "Minimize Expected Cost",
                "description": "Weighted average optimization over all scenarios",
                "selected": True
            },
            {
                "id": "worst_case",
                "name": "Minimize Worst Case Regret",
                "description": "Robust optimization considering worst scenarios",
                "selected": False
            },
            {
                "id": "chance_constrained",
                "name": "Chance Constrained",
                "description": "Ensure feasibility with 95% probability",
                "selected": False
            }
        ]
    }
