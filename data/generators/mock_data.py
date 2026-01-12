"""
Powercast AI - Mock Data Generators
Generates realistic Swiss power grid data for simulation
"""
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from typing import Optional, Dict, List
import json


class SCADAGenerator:
    """
    Generates realistic SCADA data (load, generation, frequency)
    Based on Swiss grid patterns from Technical Blueprint
    """
    
    def __init__(self, seed: int = 42):
        np.random.seed(seed)
        self.base_load = 8000  # MW - Swiss average
        self.load_std = 500
        
        # Swiss generation mix (typical)
        self.nuclear_capacity = 3000  # MW (Gösgen + Leibstadt)
        self.hydro_capacity = 15000  # MW total
        self.solar_capacity = 5000  # MW installed
        self.wind_capacity = 300  # MW (limited in Switzerland)
        
        # Regions
        self.regions = ['CH_North', 'CH_South', 'CH_East', 'CH_West']
        self.region_weights = [0.35, 0.25, 0.20, 0.20]  # Load distribution
        
    def _daily_load_pattern(self, hour: float) -> float:
        """
        Swiss load curve: morning peak ~9-10, lunch dip, afternoon peak ~18-19
        """
        # Morning ramp (6-10)
        morning_peak = np.exp(-((hour - 9.5) ** 2) / 8) * 0.3
        # Evening peak (17-20)
        evening_peak = np.exp(-((hour - 18.5) ** 2) / 6) * 0.4
        # Base pattern
        base = 0.7 + morning_peak + evening_peak
        # Night drop (0-5)
        if hour < 5:
            base *= 0.75
        return base
    
    def _seasonal_factor(self, month: int) -> Dict[str, float]:
        """
        Seasonal adjustments for load and renewables
        """
        # Load: higher in winter (heating), lower in summer
        load_seasonal = {
            12: 1.15, 1: 1.20, 2: 1.15,  # Winter
            3: 1.05, 4: 0.95, 5: 0.90,   # Spring
            6: 0.85, 7: 0.80, 8: 0.85,   # Summer (AC adds some)
            9: 0.90, 10: 0.95, 11: 1.05  # Fall
        }
        
        # Solar: higher in summer, lower in winter
        solar_seasonal = {
            12: 0.3, 1: 0.25, 2: 0.4,
            3: 0.6, 4: 0.75, 5: 0.85,
            6: 1.0, 7: 1.0, 8: 0.9,
            9: 0.7, 10: 0.5, 11: 0.35
        }
        
        return {
            'load': load_seasonal.get(month, 1.0),
            'solar': solar_seasonal.get(month, 0.5)
        }
    
    def _solar_generation(self, hour: float, month: int, cloud_cover: float = 0.3) -> float:
        """
        Solar generation based on time of day, season, and clouds
        """
        # Sunrise/sunset varies by month (simplified)
        sunrise = 7 - (6 - abs(month - 6)) * 0.3  # Earlier in summer
        sunset = 17 + (6 - abs(month - 6)) * 0.5  # Later in summer
        
        if hour < sunrise or hour > sunset:
            return 0.0
        
        # Solar curve (peak at noon)
        day_length = sunset - sunrise
        day_position = (hour - sunrise) / day_length
        solar_curve = np.sin(day_position * np.pi)
        
        # Apply cloud cover (0 = clear, 1 = overcast)
        cloud_factor = 1 - (cloud_cover * 0.8)
        
        # Seasonal factor
        seasonal = self._seasonal_factor(month)['solar']
        
        return self.solar_capacity * solar_curve * cloud_factor * seasonal
    
    def generate_snapshot(self, timestamp: datetime, weather: Optional[Dict] = None) -> Dict:
        """
        Generate a single SCADA snapshot for given timestamp
        """
        hour = timestamp.hour + timestamp.minute / 60
        month = timestamp.month
        is_weekend = timestamp.weekday() >= 5
        
        # Apply patterns
        daily_factor = self._daily_load_pattern(hour)
        seasonal = self._seasonal_factor(month)
        weekend_factor = 0.85 if is_weekend else 1.0
        
        # Total load with noise
        total_load = (
            self.base_load 
            * daily_factor 
            * seasonal['load'] 
            * weekend_factor
            + np.random.normal(0, self.load_std * 0.1)
        )
        
        # Weather effects
        cloud_cover = weather.get('cloud_cover', 0.3) if weather else 0.3
        temperature = weather.get('temperature', 15) if weather else 15
        
        # Temperature effect on load (AC in summer, heating in winter)
        if temperature > 25:
            total_load += (temperature - 25) * 50  # AC load
        elif temperature < 5:
            total_load += (5 - temperature) * 30   # Heating load
        
        # Solar generation
        solar_gen = self._solar_generation(hour, month, cloud_cover)
        
        # Hydro generation (fills the gap, with reservoir limits)
        hydro_available = self.hydro_capacity * (0.5 + np.random.uniform(0, 0.3))
        
        # Nuclear (baseload, constant with small variations)
        nuclear_gen = self.nuclear_capacity * (0.9 + np.random.uniform(0, 0.05))
        
        # Wind (highly variable)
        wind_speed = weather.get('wind_speed', 5) if weather else 5
        wind_gen = min(
            self.wind_capacity * (wind_speed / 15) ** 2,
            self.wind_capacity
        ) * np.random.uniform(0.7, 1.0)
        
        # Calculate net load and required hydro
        renewable_gen = solar_gen + wind_gen
        net_load = total_load - nuclear_gen - renewable_gen
        hydro_gen = min(max(net_load, 0), hydro_available)
        
        # Imports/exports to balance
        imports = max(0, total_load - nuclear_gen - renewable_gen - hydro_gen)
        exports = max(0, nuclear_gen + renewable_gen + hydro_gen - total_load)
        
        # Grid frequency (50 Hz ± small deviations)
        frequency = 50.0 + np.random.normal(0, 0.02)
        
        # Regional breakdown
        regional_load = {}
        for i, region in enumerate(self.regions):
            regional_load[region] = total_load * self.region_weights[i] * (1 + np.random.normal(0, 0.05))
        
        return {
            'timestamp': timestamp.isoformat(),
            'total_load_mw': round(total_load, 1),
            'renewable_generation_mw': round(renewable_gen, 1),
            'solar_generation_mw': round(solar_gen, 1),
            'wind_generation_mw': round(wind_gen, 1),
            'hydro_generation_mw': round(hydro_gen, 1),
            'nuclear_generation_mw': round(nuclear_gen, 1),
            'net_load_mw': round(net_load, 1),
            'imports_mw': round(imports, 1),
            'exports_mw': round(exports, 1),
            'frequency_hz': round(frequency, 3),
            'regional_load': {k: round(v, 1) for k, v in regional_load.items()},
            'reserve_margin_mw': round(hydro_available - hydro_gen + 500, 1)
        }
    
    def generate_timeseries(
        self, 
        start: datetime, 
        end: datetime, 
        interval_minutes: int = 15
    ) -> pd.DataFrame:
        """
        Generate time series of SCADA data
        """
        timestamps = pd.date_range(start, end, freq=f'{interval_minutes}T')
        weather_gen = WeatherGenerator()
        
        records = []
        for ts in timestamps:
            weather = weather_gen.generate_snapshot(ts.to_pydatetime())
            scada = self.generate_snapshot(ts.to_pydatetime(), weather)
            scada['weather'] = weather
            records.append(scada)
        
        return pd.DataFrame(records)


class WeatherGenerator:
    """
    Generates realistic weather data for Swiss regions
    """
    
    def __init__(self, seed: int = 42):
        np.random.seed(seed)
        
    def _base_temperature(self, hour: float, month: int) -> float:
        """
        Base temperature by time of day and season
        """
        # Monthly average temperatures (Zurich-like)
        monthly_avg = {
            1: 0, 2: 2, 3: 6, 4: 10, 5: 15, 6: 18,
            7: 20, 8: 19, 9: 15, 10: 10, 11: 5, 12: 1
        }
        base = monthly_avg.get(month, 10)
        
        # Daily variation (coldest at ~5am, warmest at ~2pm)
        daily_variation = 5 * np.sin((hour - 5) * np.pi / 12)
        
        return base + daily_variation
    
    def generate_snapshot(self, timestamp: datetime) -> Dict:
        """
        Generate weather snapshot for given timestamp
        """
        hour = timestamp.hour + timestamp.minute / 60
        month = timestamp.month
        
        # Temperature with noise
        temp = self._base_temperature(hour, month) + np.random.normal(0, 2)
        
        # Cloud cover (0-1)
        # More clouds in winter, less in summer
        base_cloud = 0.4 + 0.2 * np.cos((month - 6) * np.pi / 6)
        cloud_cover = np.clip(base_cloud + np.random.normal(0, 0.2), 0, 1)
        
        # Humidity
        humidity = 60 + 20 * cloud_cover + np.random.normal(0, 10)
        humidity = np.clip(humidity, 20, 100)
        
        # Wind speed (m/s)
        wind_speed = max(0, 5 + np.random.exponential(3))
        
        # Solar irradiance (W/m²)
        if timestamp.hour < 6 or timestamp.hour > 20:
            irradiance = 0
        else:
            max_irradiance = 1000 * (1 - 0.3 * np.cos((month - 6) * np.pi / 6))
            solar_angle = np.sin((hour - 6) * np.pi / 14)
            irradiance = max_irradiance * solar_angle * (1 - cloud_cover * 0.7)
            irradiance = max(0, irradiance)
        
        return {
            'timestamp': timestamp.isoformat(),
            'temperature_c': round(temp, 1),
            'humidity_pct': round(humidity, 1),
            'cloud_cover': round(cloud_cover, 2),
            'wind_speed_ms': round(wind_speed, 1),
            'irradiance_wm2': round(irradiance, 1),
            'pressure_hpa': round(1013 + np.random.normal(0, 10), 1)
        }


class MarketGenerator:
    """
    Generates realistic electricity market data (EPEX SPOT style)
    """
    
    def __init__(self, seed: int = 42):
        np.random.seed(seed)
        self.base_price = 80  # EUR/MWh (2024-2026 range)
        
    def generate_snapshot(self, timestamp: datetime, load: float = 8000) -> Dict:
        """
        Generate market data for given timestamp
        """
        hour = timestamp.hour
        month = timestamp.month
        is_weekend = timestamp.weekday() >= 5
        
        # Base price with daily pattern
        # Higher during peak hours
        if 7 <= hour <= 10 or 17 <= hour <= 20:
            peak_factor = 1.3
        elif 0 <= hour <= 5:
            peak_factor = 0.7
        else:
            peak_factor = 1.0
            
        # Seasonal (higher in winter)
        seasonal = 1 + 0.15 * np.cos((month - 1) * np.pi / 6)
        
        # Weekend discount
        weekend_factor = 0.85 if is_weekend else 1.0
        
        # Load correlation
        load_factor = (load / 8000) ** 0.3
        
        # Day-ahead price
        day_ahead = self.base_price * peak_factor * seasonal * weekend_factor * load_factor
        day_ahead += np.random.normal(0, 10)
        
        # Intraday spread
        intraday = day_ahead + np.random.normal(0, 15)
        
        return {
            'timestamp': timestamp.isoformat(),
            'day_ahead_price_eur': round(max(20, day_ahead), 2),
            'intraday_price_eur': round(max(20, intraday), 2),
            'cross_border_de_mw': round(np.random.normal(500, 200), 0),
            'cross_border_fr_mw': round(np.random.normal(-200, 150), 0),
            'cross_border_it_mw': round(np.random.normal(300, 100), 0),
            'cross_border_at_mw': round(np.random.normal(100, 80), 0)
        }


class AssetGenerator:
    """
    Generates asset data for Swiss power plants
    """
    
    ASSETS = [
        # Hydro - Run of River
        {'id': 'HYDRO_A', 'name': 'Linth-Limmern', 'type': 'hydro', 'subtype': 'pumped_storage', 'capacity_mw': 1000, 'region': 'CH_East'},
        {'id': 'HYDRO_B', 'name': 'Grande Dixence', 'type': 'hydro', 'subtype': 'reservoir', 'capacity_mw': 2000, 'region': 'CH_South'},
        {'id': 'HYDRO_C', 'name': 'Mauvoisin', 'type': 'hydro', 'subtype': 'reservoir', 'capacity_mw': 900, 'region': 'CH_South'},
        {'id': 'HYDRO_D', 'name': 'Grimsel', 'type': 'hydro', 'subtype': 'pumped_storage', 'capacity_mw': 350, 'region': 'CH_South'},
        {'id': 'HYDRO_E', 'name': 'Oberhasli', 'type': 'hydro', 'subtype': 'run_of_river', 'capacity_mw': 500, 'region': 'CH_East'},
        
        # Solar
        {'id': 'SOLAR_PV_1', 'name': 'Mont-Soleil', 'type': 'solar', 'subtype': 'utility', 'capacity_mw': 150, 'region': 'CH_West'},
        {'id': 'SOLAR_PV_2', 'name': 'Plateau Solar', 'type': 'solar', 'subtype': 'distributed', 'capacity_mw': 800, 'region': 'CH_North'},
        {'id': 'SOLAR_PV_3', 'name': 'Alpine Solar', 'type': 'solar', 'subtype': 'alpine', 'capacity_mw': 200, 'region': 'CH_South'},
        
        # Wind
        {'id': 'WIND_FARM_1', 'name': 'Jura Wind', 'type': 'wind', 'subtype': 'onshore', 'capacity_mw': 120, 'region': 'CH_West'},
        {'id': 'WIND_FARM_2', 'name': 'Gotthard Wind', 'type': 'wind', 'subtype': 'alpine', 'capacity_mw': 80, 'region': 'CH_South'},
        
        # Nuclear
        {'id': 'NUCLEAR_1', 'name': 'Gösgen', 'type': 'nuclear', 'subtype': 'pwr', 'capacity_mw': 1010, 'region': 'CH_North'},
        {'id': 'NUCLEAR_2', 'name': 'Leibstadt', 'type': 'nuclear', 'subtype': 'bwr', 'capacity_mw': 1220, 'region': 'CH_North'},
    ]
    
    def __init__(self, seed: int = 42):
        np.random.seed(seed)
        
    def generate_asset_status(self, timestamp: datetime, weather: Dict = None) -> List[Dict]:
        """
        Generate current status for all assets
        """
        hour = timestamp.hour + timestamp.minute / 60
        month = timestamp.month
        
        assets_status = []
        
        for asset in self.ASSETS:
            # Base availability
            health = 95 + np.random.uniform(-5, 5)
            online = np.random.random() > 0.05  # 95% chance online
            
            if asset['type'] == 'solar':
                # Solar depends on time and weather
                if weather and hour >= 6 and hour <= 20:
                    cloud = weather.get('cloud_cover', 0.3)
                    irr = weather.get('irradiance_wm2', 500)
                    output_factor = (irr / 1000) * (1 - cloud * 0.3)
                else:
                    output_factor = 0
                current_output = asset['capacity_mw'] * output_factor * np.random.uniform(0.9, 1.0)
                
            elif asset['type'] == 'wind':
                # Wind depends on wind speed
                wind_speed = weather.get('wind_speed_ms', 5) if weather else 5
                # Cut-in at 3 m/s, rated at 12 m/s, cut-out at 25 m/s
                if wind_speed < 3 or wind_speed > 25:
                    output_factor = 0
                elif wind_speed < 12:
                    output_factor = ((wind_speed - 3) / 9) ** 2
                else:
                    output_factor = 1.0
                current_output = asset['capacity_mw'] * output_factor * np.random.uniform(0.85, 1.0)
                
            elif asset['type'] == 'nuclear':
                # Nuclear runs near capacity
                online = True
                current_output = asset['capacity_mw'] * np.random.uniform(0.88, 0.95)
                
            elif asset['type'] == 'hydro':
                # Hydro dispatched based on demand
                if asset['subtype'] == 'run_of_river':
                    current_output = asset['capacity_mw'] * np.random.uniform(0.4, 0.8)
                else:
                    # Reservoir/pumped storage follows demand
                    peak_factor = 0.8 if 7 <= hour <= 20 else 0.3
                    current_output = asset['capacity_mw'] * peak_factor * np.random.uniform(0.7, 1.0)
            
            else:
                current_output = 0
                
            # Reservoir level for hydro
            reservoir_level = None
            if asset['type'] == 'hydro' and asset['subtype'] in ['reservoir', 'pumped_storage']:
                # Lower in late winter, higher in late summer/fall
                seasonal_level = 0.5 + 0.3 * np.sin((month - 3) * np.pi / 6)
                reservoir_level = seasonal_level * 100 + np.random.uniform(-10, 10)
                reservoir_level = np.clip(reservoir_level, 20, 100)
            
            assets_status.append({
                'id': asset['id'],
                'name': asset['name'],
                'type': asset['type'],
                'subtype': asset['subtype'],
                'region': asset['region'],
                'capacity_mw': asset['capacity_mw'],
                'current_output_mw': round(current_output, 1) if online else 0,
                'health_pct': round(health, 1),
                'online': online,
                'reservoir_level_pct': round(reservoir_level, 1) if reservoir_level else None,
                'timestamp': timestamp.isoformat()
            })
            
        return assets_status


class PatternGenerator:
    """
    Generates adaptive learning patterns (detected anomalies and corrections)
    """
    
    PATTERN_TEMPLATES = [
        {
            'id': 'RAPID_MORNING_RAMP',
            'name': 'Rapid Morning Ramp',
            'description': 'Unusual {magnitude} GW load increase between 06:00-07:00 due to {cause}',
            'causes': ['cold front', 'industrial restart', 'early shift', 'EV charging spike'],
            'magnitude_range': (0.8, 1.5),
            'confidence_range': (0.7, 0.95)
        },
        {
            'id': 'HIGH_SOLAR_VARIABILITY',
            'name': 'High Solar Variability',
            'description': 'Cloud cover causing {magnitude} MW fluctuation in solar output in {region}',
            'regions': ['CH-West', 'CH-North', 'CH-South', 'CH-East'],
            'magnitude_range': (200, 500),
            'confidence_range': (0.5, 0.85)
        },
        {
            'id': 'WEEKEND_LIKE_DEMAND',
            'name': 'Weekend-like Demand',
            'description': 'Lower than expected demand for a {weekday}, resembling a weekend pattern',
            'weekdays': ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
            'confidence_range': (0.4, 0.75)
        },
        {
            'id': 'FOEHN_WIND_EFFECT',
            'name': 'Föhn Wind Effect',
            'description': 'Warm Föhn wind causing temperature spike of {magnitude}°C above forecast',
            'magnitude_range': (3, 8),
            'confidence_range': (0.75, 0.95)
        },
        {
            'id': 'EVENING_PEAK_SHIFT',
            'name': 'Evening Peak Shift',
            'description': 'Peak demand shifted {direction} by {minutes} minutes compared to historical',
            'directions': ['earlier', 'later'],
            'minutes_range': (15, 45),
            'confidence_range': (0.6, 0.9)
        }
    ]
    
    def __init__(self, seed: int = 42):
        np.random.seed(seed)
        
    def generate_patterns(self, n: int = 5, timestamp: datetime = None) -> List[Dict]:
        """
        Generate n random patterns detected today
        """
        if timestamp is None:
            timestamp = datetime.now()
            
        patterns = []
        selected = np.random.choice(len(self.PATTERN_TEMPLATES), size=min(n, len(self.PATTERN_TEMPLATES)), replace=False)
        
        for idx in selected:
            template = self.PATTERN_TEMPLATES[idx]
            
            # Generate description with random values
            desc = template['description']
            
            if 'magnitude_range' in template:
                mag = np.random.uniform(*template['magnitude_range'])
                desc = desc.replace('{magnitude}', f'{mag:.1f}')
                
            if 'causes' in template:
                cause = np.random.choice(template['causes'])
                desc = desc.replace('{cause}', cause)
                
            if 'regions' in template:
                region = np.random.choice(template['regions'])
                desc = desc.replace('{region}', region)
                
            if 'weekdays' in template:
                weekday = np.random.choice(template['weekdays'])
                desc = desc.replace('{weekday}', weekday)
                
            if 'directions' in template:
                direction = np.random.choice(template['directions'])
                desc = desc.replace('{direction}', direction)
                
            if 'minutes_range' in template:
                mins = np.random.randint(*template['minutes_range'])
                desc = desc.replace('{minutes}', str(mins))
            
            # Generate confidence
            conf = np.random.uniform(*template['confidence_range'])
            if conf >= 0.8:
                conf_label = 'High'
            elif conf >= 0.6:
                conf_label = 'Medium'
            else:
                conf_label = 'Low'
            
            patterns.append({
                'id': template['id'],
                'name': template['name'],
                'description': desc,
                'confidence': round(conf, 2),
                'confidence_label': conf_label,
                'detected_at': timestamp.isoformat(),
                'applied': np.random.random() > 0.3  # 70% have been applied
            })
            
        return patterns


# Main data service
class DataService:
    """
    Unified data service for all generators
    """
    
    def __init__(self, seed: int = 42):
        self.scada = SCADAGenerator(seed)
        self.weather = WeatherGenerator(seed)
        self.market = MarketGenerator(seed)
        self.assets = AssetGenerator(seed)
        self.patterns = PatternGenerator(seed)
        
    def get_current_state(self, timestamp: datetime = None) -> Dict:
        """
        Get complete current grid state
        """
        if timestamp is None:
            timestamp = datetime.now()
            
        weather = self.weather.generate_snapshot(timestamp)
        scada = self.scada.generate_snapshot(timestamp, weather)
        market = self.market.generate_snapshot(timestamp, scada['total_load_mw'])
        assets = self.assets.generate_asset_status(timestamp, weather)
        patterns = self.patterns.generate_patterns(4, timestamp)
        
        return {
            'timestamp': timestamp.isoformat(),
            'scada': scada,
            'weather': weather,
            'market': market,
            'assets': assets,
            'patterns': patterns
        }
    
    def generate_historical_data(
        self, 
        days: int = 7, 
        interval_minutes: int = 15
    ) -> pd.DataFrame:
        """
        Generate historical data for training
        """
        end = datetime.now()
        start = end - timedelta(days=days)
        return self.scada.generate_timeseries(start, end, interval_minutes)


if __name__ == "__main__":
    # Test data generation
    service = DataService()
    state = service.get_current_state()
    print(json.dumps(state, indent=2, default=str))
