"""
Powercast AI - Supabase Client
Database client for Supabase with fallback for development
"""

from typing import Optional, Dict, Any, List
from supabase import create_client, Client
from functools import lru_cache
import logging

from app.core.config import settings

logger = logging.getLogger(__name__)


class SupabaseClient:
    """Wrapper for Supabase client with lazy initialization"""

    _instance: Optional[Client] = None
    _admin_instance: Optional[Client] = None

    @classmethod
    def get_client(cls) -> Optional[Client]:
        """Get Supabase client (uses anon key - respects RLS)"""
        if not settings.use_supabase:
            logger.warning("Supabase not configured - using mock data")
            return None

        if cls._instance is None:
            cls._instance = create_client(
                settings.supabase_url, settings.supabase_anon_key
            )
            logger.info("Supabase client initialized")

        return cls._instance

    @classmethod
    def get_admin_client(cls) -> Optional[Client]:
        """Get Supabase admin client (uses service role key - bypasses RLS)"""
        if not settings.use_supabase_admin:
            logger.warning("Supabase admin not configured")
            return None

        if cls._admin_instance is None:
            cls._admin_instance = create_client(
                settings.supabase_url, settings.supabase_service_role_key
            )
            logger.info("Supabase admin client initialized")

        return cls._admin_instance


# Dependency injection helpers
def get_supabase() -> Optional[Client]:
    """FastAPI dependency for Supabase client"""
    return SupabaseClient.get_client()


def get_supabase_admin() -> Optional[Client]:
    """FastAPI dependency for Supabase admin client"""
    return SupabaseClient.get_admin_client()


class MockDatabase:
    """Mock database for development when Supabase is not configured"""

    # In-memory mock data
    _plants: Dict[str, Dict[str, Any]] = {}
    _forecasts: Dict[str, List[Dict[str, Any]]] = {}
    _uploads: Dict[str, Dict[str, Any]] = {}
    _suggestions: Dict[str, Dict[str, Any]] = {}

    @classmethod
    def seed_demo_data(cls, user_id: str = "demo-user"):
        """Seed demo data for development"""
        from datetime import datetime, timedelta
        import uuid
        import random

        # Demo plants
        plant_types = ["solar", "hydro", "nuclear", "wind", "thermal"]
        plant_names = [
            ("Solar Farm Alpha", "solar", 500, "Zurich, CH"),
            ("Hydro Station Beta", "hydro", 800, "Lucerne, CH"),
            ("Nuclear Plant Gamma", "nuclear", 1000, "Bern, CH"),
            ("Wind Farm Delta", "wind", 300, "Basel, CH"),
            ("Thermal Plant Epsilon", "thermal", 600, "Geneva, CH"),
        ]

        for name, plant_type, capacity, location in plant_names:
            plant_id = str(uuid.uuid4())
            current_output = capacity * random.uniform(0.5, 0.95)

            cls._plants[plant_id] = {
                "id": plant_id,
                "user_id": user_id,
                "name": name,
                "type": plant_type,
                "capacity_mw": capacity,
                "current_output_mw": round(current_output, 2),
                "status": "online",
                "location": location,
                "efficiency_pct": round((current_output / capacity) * 100, 2),
                "metadata": {},
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat(),
            }

            # Generate forecast data for each plant
            cls._forecasts[plant_id] = []
            base_time = datetime.utcnow()
            for i in range(96):  # 24 hours of 15-min intervals
                timestamp = base_time + timedelta(minutes=15 * i)
                # Simulate a realistic pattern
                hour_factor = 1.0 + 0.3 * (1 - abs(12 - timestamp.hour) / 12)
                output = current_output * hour_factor * random.uniform(0.9, 1.1)

                cls._forecasts[plant_id].append(
                    {
                        "id": str(uuid.uuid4()),
                        "plant_id": plant_id,
                        "timestamp": timestamp.isoformat(),
                        "output_mw": round(output, 2),
                        "temperature": round(20 + random.uniform(-5, 10), 1),
                        "humidity": round(random.uniform(40, 80), 1),
                        "wind_speed": round(random.uniform(0, 15), 1),
                        "cloud_cover": round(random.uniform(0, 100), 1),
                    }
                )

        logger.info(f"Seeded {len(cls._plants)} demo plants for user {user_id}")

    @classmethod
    def get_plants(cls, user_id: str) -> List[Dict[str, Any]]:
        """Get all plants for a user"""
        return [p for p in cls._plants.values() if p["user_id"] == user_id]

    @classmethod
    def get_plant(cls, plant_id: str) -> Optional[Dict[str, Any]]:
        """Get a single plant by ID"""
        return cls._plants.get(plant_id)

    @classmethod
    def create_plant(cls, data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new plant"""
        import uuid
        from datetime import datetime

        plant_id = str(uuid.uuid4())
        plant = {
            "id": plant_id,
            **data,
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
        }
        cls._plants[plant_id] = plant
        return plant

    @classmethod
    def update_plant(
        cls, plant_id: str, data: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """Update an existing plant"""
        from datetime import datetime

        if plant_id not in cls._plants:
            return None

        cls._plants[plant_id].update(
            {
                **data,
                "updated_at": datetime.utcnow().isoformat(),
            }
        )
        return cls._plants[plant_id]

    @classmethod
    def delete_plant(cls, plant_id: str) -> bool:
        """Delete a plant"""
        if plant_id in cls._plants:
            del cls._plants[plant_id]
            # Also delete associated forecasts
            if plant_id in cls._forecasts:
                del cls._forecasts[plant_id]
            return True
        return False

    @classmethod
    def get_forecasts(cls, plant_id: str) -> List[Dict[str, Any]]:
        """Get forecasts for a plant"""
        return cls._forecasts.get(plant_id, [])


# Initialize mock data for development
if not settings.use_supabase:
    MockDatabase.seed_demo_data()
