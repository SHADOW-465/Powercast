"""
Powercast AI - External API Services
Weather and grid data with automatic fallback to simulated data
"""

from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta
from dataclasses import dataclass
import logging
import random
import math
import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


# =========================================
# Data Models
# =========================================


@dataclass
class WeatherData:
    """Weather data point"""

    timestamp: str
    temperature: float  # Celsius
    humidity: float  # Percentage
    wind_speed: float  # m/s
    wind_direction: float  # Degrees
    cloud_cover: float  # Percentage
    pressure: float  # hPa
    irradiance: float  # W/m² (solar radiation)
    precipitation: float  # mm

    def to_dict(self) -> Dict[str, Any]:
        return {
            "timestamp": self.timestamp,
            "temperature": self.temperature,
            "humidity": self.humidity,
            "wind_speed": self.wind_speed,
            "wind_direction": self.wind_direction,
            "cloud_cover": self.cloud_cover,
            "pressure": self.pressure,
            "irradiance": self.irradiance,
            "precipitation": self.precipitation,
        }


@dataclass
class GridPriceData:
    """Grid electricity price data"""

    timestamp: str
    price: float  # EUR/MWh or CHF/MWh
    currency: str
    area: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "timestamp": self.timestamp,
            "price": self.price,
            "currency": self.currency,
            "area": self.area,
        }


# =========================================
# Weather API Service
# =========================================


class WeatherService:
    """OpenWeather API with fallback to simulated data"""

    def __init__(self):
        self.api_key = settings.openweather_api_key
        self.base_url = settings.openweather_base_url
        self.use_real_api = settings.use_real_weather_api

    async def get_current_weather(self, lat: float, lon: float) -> Dict[str, Any]:
        """Get current weather for a location"""
        if self.use_real_api:
            return await self._fetch_real_weather(lat, lon)
        else:
            return self._generate_mock_weather(lat, lon)

    async def get_weather_forecast(
        self, lat: float, lon: float, hours: int = 48
    ) -> List[Dict[str, Any]]:
        """Get weather forecast for a location"""
        if self.use_real_api:
            return await self._fetch_real_forecast(lat, lon, hours)
        else:
            return self._generate_mock_forecast(lat, lon, hours)

    async def _fetch_real_weather(self, lat: float, lon: float) -> Dict[str, Any]:
        """Fetch real weather data from OpenWeather API"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}/onecall",
                    params={
                        "lat": lat,
                        "lon": lon,
                        "appid": self.api_key,
                        "units": "metric",
                        "exclude": "minutely,alerts",
                    },
                    timeout=10.0,
                )
                response.raise_for_status()
                data = response.json()

                current = data.get("current", {})

                return WeatherData(
                    timestamp=datetime.utcnow().isoformat(),
                    temperature=current.get("temp", 20.0),
                    humidity=current.get("humidity", 50.0),
                    wind_speed=current.get("wind_speed", 5.0),
                    wind_direction=current.get("wind_deg", 180),
                    cloud_cover=current.get("clouds", 30.0),
                    pressure=current.get("pressure", 1013.0),
                    irradiance=current.get("uvi", 5.0) * 100,  # Approximate
                    precipitation=current.get("rain", {}).get("1h", 0.0),
                ).to_dict()

        except Exception as e:
            logger.warning(
                f"OpenWeather API error: {e}. Falling back to simulated data."
            )
            return self._generate_mock_weather(lat, lon)

    async def _fetch_real_forecast(
        self, lat: float, lon: float, hours: int
    ) -> List[Dict[str, Any]]:
        """Fetch real forecast data from OpenWeather API"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}/onecall",
                    params={
                        "lat": lat,
                        "lon": lon,
                        "appid": self.api_key,
                        "units": "metric",
                        "exclude": "minutely,alerts",
                    },
                    timeout=10.0,
                )
                response.raise_for_status()
                data = response.json()

                hourly = data.get("hourly", [])[:hours]

                return [
                    WeatherData(
                        timestamp=datetime.utcfromtimestamp(h.get("dt", 0)).isoformat(),
                        temperature=h.get("temp", 20.0),
                        humidity=h.get("humidity", 50.0),
                        wind_speed=h.get("wind_speed", 5.0),
                        wind_direction=h.get("wind_deg", 180),
                        cloud_cover=h.get("clouds", 30.0),
                        pressure=h.get("pressure", 1013.0),
                        irradiance=h.get("uvi", 5.0) * 100,
                        precipitation=h.get("rain", {}).get("1h", 0.0),
                    ).to_dict()
                    for h in hourly
                ]

        except Exception as e:
            logger.warning(
                f"OpenWeather API forecast error: {e}. Falling back to simulated data."
            )
            return self._generate_mock_forecast(lat, lon, hours)

    def _generate_mock_weather(self, lat: float, lon: float) -> Dict[str, Any]:
        """Generate realistic mock weather data"""
        now = datetime.utcnow()
        hour = now.hour

        # Simulate daily temperature cycle
        base_temp = 15 + (lat / 10)  # Adjust for latitude
        temp_cycle = 8 * math.sin((hour - 6) * math.pi / 12)  # Peak at 14:00
        temperature = base_temp + temp_cycle + random.uniform(-2, 2)

        # Simulate cloud cover affecting irradiance
        cloud_cover = random.uniform(10, 80)

        # Solar irradiance (simplified - peaks at noon)
        if 6 <= hour <= 20:
            max_irradiance = 1000 * (1 - cloud_cover / 100)
            irradiance = max_irradiance * math.sin((hour - 6) * math.pi / 14)
        else:
            irradiance = 0

        return WeatherData(
            timestamp=now.isoformat(),
            temperature=round(temperature, 1),
            humidity=round(random.uniform(30, 80), 1),
            wind_speed=round(random.uniform(0, 15), 1),
            wind_direction=round(random.uniform(0, 360), 0),
            cloud_cover=round(cloud_cover, 1),
            pressure=round(random.uniform(990, 1030), 1),
            irradiance=round(max(0, irradiance), 1),
            precipitation=round(random.uniform(0, 2) if cloud_cover > 70 else 0, 1),
        ).to_dict()

    def _generate_mock_forecast(
        self, lat: float, lon: float, hours: int
    ) -> List[Dict[str, Any]]:
        """Generate realistic mock weather forecast"""
        now = datetime.utcnow()
        forecasts = []

        # Base conditions with some continuity
        base_temp = 15 + (lat / 10)
        base_cloud = random.uniform(20, 50)

        for i in range(hours):
            forecast_time = now + timedelta(hours=i)
            hour = forecast_time.hour

            # Add some variation but maintain continuity
            temp_cycle = 8 * math.sin((hour - 6) * math.pi / 12)
            temperature = base_temp + temp_cycle + random.uniform(-1, 1)

            # Cloud cover with some persistence
            cloud_cover = base_cloud + random.uniform(-10, 10)
            cloud_cover = max(0, min(100, cloud_cover))
            base_cloud = cloud_cover * 0.9 + base_cloud * 0.1  # Smooth changes

            # Solar irradiance
            if 6 <= hour <= 20:
                max_irradiance = 1000 * (1 - cloud_cover / 100)
                irradiance = max_irradiance * math.sin((hour - 6) * math.pi / 14)
            else:
                irradiance = 0

            forecasts.append(
                WeatherData(
                    timestamp=forecast_time.isoformat(),
                    temperature=round(temperature, 1),
                    humidity=round(random.uniform(30, 80), 1),
                    wind_speed=round(random.uniform(0, 15), 1),
                    wind_direction=round(random.uniform(0, 360), 0),
                    cloud_cover=round(cloud_cover, 1),
                    pressure=round(random.uniform(1005, 1020), 1),
                    irradiance=round(max(0, irradiance), 1),
                    precipitation=round(
                        random.uniform(0, 2) if cloud_cover > 70 else 0, 1
                    ),
                ).to_dict()
            )

        return forecasts


# =========================================
# Grid API Service (ENTSO-E)
# =========================================


class GridService:
    """ENTSO-E API with fallback to simulated data"""

    def __init__(self):
        self.api_key = settings.entsoe_api_key
        self.base_url = settings.entsoe_base_url
        self.use_real_api = settings.use_real_grid_api

    async def get_day_ahead_prices(
        self, area: str = "CH", hours: int = 24
    ) -> List[Dict[str, Any]]:
        """Get day-ahead electricity prices"""
        if self.use_real_api:
            return await self._fetch_real_prices(area, hours)
        else:
            return self._generate_mock_prices(area, hours)

    async def get_grid_load(self, area: str = "CH") -> Dict[str, Any]:
        """Get current grid load"""
        if self.use_real_api:
            return await self._fetch_real_load(area)
        else:
            return self._generate_mock_load(area)

    async def _fetch_real_prices(self, area: str, hours: int) -> List[Dict[str, Any]]:
        """Fetch real prices from ENTSO-E"""
        # ENTSO-E API is complex - this is a simplified implementation
        # In production, you'd use the entsoe-py library
        try:
            logger.info("ENTSO-E API not fully implemented - using mock data")
            return self._generate_mock_prices(area, hours)

        except Exception as e:
            logger.warning(f"ENTSO-E API error: {e}. Falling back to simulated data.")
            return self._generate_mock_prices(area, hours)

    async def _fetch_real_load(self, area: str) -> Dict[str, Any]:
        """Fetch real grid load from ENTSO-E"""
        try:
            logger.info("ENTSO-E API not fully implemented - using mock data")
            return self._generate_mock_load(area)

        except Exception as e:
            logger.warning(f"ENTSO-E API error: {e}. Falling back to simulated data.")
            return self._generate_mock_load(area)

    def _generate_mock_prices(self, area: str, hours: int) -> List[Dict[str, Any]]:
        """Generate realistic mock electricity prices"""
        now = datetime.utcnow()
        prices = []

        # Swiss market typical price range
        base_price = 85  # CHF/MWh

        for i in range(hours):
            price_time = now + timedelta(hours=i)
            hour = price_time.hour

            # Price pattern: higher during peak hours
            if 7 <= hour <= 9:
                # Morning peak
                multiplier = 1.3 + random.uniform(-0.1, 0.1)
            elif 17 <= hour <= 20:
                # Evening peak
                multiplier = 1.5 + random.uniform(-0.1, 0.1)
            elif 1 <= hour <= 5:
                # Night valley
                multiplier = 0.6 + random.uniform(-0.05, 0.05)
            else:
                # Normal hours
                multiplier = 1.0 + random.uniform(-0.15, 0.15)

            price = base_price * multiplier

            prices.append(
                GridPriceData(
                    timestamp=price_time.isoformat(),
                    price=round(price, 2),
                    currency="CHF",
                    area=area,
                ).to_dict()
            )

        return prices

    def _generate_mock_load(self, area: str) -> Dict[str, Any]:
        """Generate realistic mock grid load data"""
        now = datetime.utcnow()
        hour = now.hour

        # Swiss grid typical load (MW)
        base_load = 8000  # MW

        # Load pattern
        if 7 <= hour <= 9:
            multiplier = 1.2
        elif 17 <= hour <= 20:
            multiplier = 1.3
        elif 1 <= hour <= 5:
            multiplier = 0.7
        else:
            multiplier = 1.0

        current_load = base_load * multiplier * random.uniform(0.95, 1.05)
        capacity = 12000  # Total Swiss grid capacity

        return {
            "timestamp": now.isoformat(),
            "area": area,
            "current_load_mw": round(current_load, 0),
            "capacity_mw": capacity,
            "utilization_pct": round((current_load / capacity) * 100, 1),
            "renewable_pct": round(random.uniform(35, 55), 1),
            "import_export_mw": round(random.uniform(-500, 500), 0),
        }


# =========================================
# Service Instances
# =========================================


def get_weather_service() -> WeatherService:
    """Get weather service instance"""
    return WeatherService()


def get_grid_service() -> GridService:
    """Get grid service instance"""
    return GridService()
