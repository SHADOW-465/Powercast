"""
Powercast AI - Real Data Store
Stores and retrieves timeseries data for real-time forecasting.
NO MOCK DATA - uses Supabase for production data.
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Any
import logging
from zoneinfo import ZoneInfo

logger = logging.getLogger(__name__)


class RealDataStore:
    """
    Real data store for timeseries forecasting data.
    Uses Supabase for persistence - NO MOCK DATA.
    """
    
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if self._initialized:
            return
        
        from app.core.supabase import get_supabase
        self.supabase = get_supabase()
        self._initialized = True
        
        if not self.supabase:
            logger.warning("Supabase not configured - data store will not persist!")
    
    def store_csv_data(
        self,
        df: pd.DataFrame,
        region_code: str,
        upload_id: Optional[str] = None,
        plant_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Store uploaded CSV data in Supabase.
        
        Args:
            df: DataFrame with 'timestamp' and 'output_mw' columns
            region_code: Region code for this data
            upload_id: Optional upload ID for tracking
            plant_id: Optional plant ID
            
        Returns:
            Result containing rows_inserted count
        """
        if not self.supabase:
            raise RuntimeError("Supabase not configured. Cannot store data.")
        
        # Validate required columns
        if 'timestamp' not in df.columns or 'output_mw' not in df.columns:
            raise ValueError("DataFrame must have 'timestamp' and 'output_mw' columns")
        
        # Convert DataFrame to records
        records = []
        for _, row in df.iterrows():
            record = {
                'region_code': region_code,
                'timestamp': pd.to_datetime(row['timestamp']).isoformat(),
                'output_mw': float(row['output_mw']),
            }
            
            # Add optional fields
            if plant_id:
                record['plant_id'] = plant_id
            if upload_id:
                record['upload_id'] = upload_id
            if 'temperature' in df.columns and pd.notna(row.get('temperature')):
                record['temperature'] = float(row['temperature'])
            if 'humidity' in df.columns and pd.notna(row.get('humidity')):
                record['humidity'] = float(row['humidity'])
            if 'wind_speed' in df.columns and pd.notna(row.get('wind_speed')):
                record['wind_speed'] = float(row['wind_speed'])
            if 'cloud_cover' in df.columns and pd.notna(row.get('cloud_cover')):
                record['cloud_cover'] = float(row['cloud_cover'])
            
            records.append(record)
        
        # Insert in batches of 1000
        batch_size = 1000
        total_inserted = 0
        
        for i in range(0, len(records), batch_size):
            batch = records[i:i + batch_size]
            result = self.supabase.table('forecast_data').insert(batch).execute()
            total_inserted += len(batch)
            logger.info(f"Inserted batch {i // batch_size + 1}: {len(batch)} records")
        
        logger.info(f"Stored {total_inserted} records for region {region_code}")
        
        return {
            'rows_inserted': total_inserted,
            'region_code': region_code,
            'status': 'success',
        }
    
    def get_historical_data(
        self,
        region_code: str,
        hours: int = 168,  # 1 week default
        end_time: Optional[datetime] = None,
    ) -> Optional[pd.DataFrame]:
        """
        Fetch historical data for a region.
        
        Args:
            region_code: Region to fetch data for
            hours: Number of hours of history to fetch
            end_time: End time for data window (default: now)
            
        Returns:
            DataFrame with timestamp and output_mw, sorted ascending
        """
        if not self.supabase:
            logger.error("Supabase not configured. Cannot fetch data.")
            return None
        
        if end_time is None:
            end_time = datetime.now(ZoneInfo('UTC'))
        elif end_time.tzinfo is None:
            end_time = end_time.replace(tzinfo=ZoneInfo('UTC'))
        
        start_time = end_time - timedelta(hours=hours)
        
        try:
            result = (
                self.supabase.table('forecast_data')
                .select('timestamp, output_mw, temperature, humidity, wind_speed, cloud_cover')
                .eq('region_code', region_code)
                .gte('timestamp', start_time.isoformat())
                .lte('timestamp', end_time.isoformat())
                .order('timestamp', desc=False)
                .execute()
            )
            
            if not result.data:
                logger.warning(f"No data found for region {region_code}")
                return None
            
            df = pd.DataFrame(result.data)
            df['timestamp'] = pd.to_datetime(df['timestamp'])
            
            logger.info(f"Fetched {len(df)} records for region {region_code}")
            return df
            
        except Exception as e:
            logger.error(f"Error fetching data for {region_code}: {e}")
            return None
    
    def get_load_history(
        self,
        region_code: str,
        n_samples: int = 672,  # 1 week at 15-min intervals
    ) -> Optional[List[float]]:
        """
        Get load history as a list for model prediction.
        
        Args:
            region_code: Region code
            n_samples: Number of 15-minute samples needed
            
        Returns:
            List of output_mw values, or None if insufficient data
        """
        hours = (n_samples * 15) / 60 + 24  # Extra buffer
        df = self.get_historical_data(region_code, hours=int(hours))
        
        if df is None or len(df) < n_samples:
            logger.warning(
                f"Insufficient data for {region_code}: need {n_samples}, got {len(df) if df is not None else 0}"
            )
            return None
        
        # Take the last n_samples
        load_values = df['output_mw'].values[-n_samples:].tolist()
        return load_values
    
    def get_latest_timestamp(self, region_code: str) -> Optional[datetime]:
        """Get the most recent timestamp for a region."""
        if not self.supabase:
            return None
        
        try:
            result = (
                self.supabase.table('forecast_data')
                .select('timestamp')
                .eq('region_code', region_code)
                .order('timestamp', desc=True)
                .limit(1)
                .execute()
            )
            
            if result.data:
                return pd.to_datetime(result.data[0]['timestamp'])
            return None
            
        except Exception as e:
            logger.error(f"Error getting latest timestamp: {e}")
            return None
    
    def get_data_summary(self, region_code: str) -> Dict[str, Any]:
        """Get summary statistics for stored data."""
        if not self.supabase:
            return {'error': 'Supabase not configured'}
        
        try:
            result = (
                self.supabase.table('forecast_data')
                .select('timestamp, output_mw')
                .eq('region_code', region_code)
                .order('timestamp', desc=False)
                .execute()
            )
            
            if not result.data:
                return {
                    'region_code': region_code,
                    'status': 'no_data',
                    'message': 'No data found for this region',
                }
            
            df = pd.DataFrame(result.data)
            df['timestamp'] = pd.to_datetime(df['timestamp'])
            
            return {
                'region_code': region_code,
                'status': 'ok',
                'row_count': len(df),
                'date_range': {
                    'start': df['timestamp'].min().isoformat(),
                    'end': df['timestamp'].max().isoformat(),
                },
                'load_stats': {
                    'mean_mw': float(df['output_mw'].mean()),
                    'min_mw': float(df['output_mw'].min()),
                    'max_mw': float(df['output_mw'].max()),
                    'std_mw': float(df['output_mw'].std()),
                },
            }
            
        except Exception as e:
            logger.error(f"Error getting data summary: {e}")
            return {'error': str(e)}
    
    def delete_region_data(self, region_code: str) -> int:
        """Delete all data for a region. Returns count of deleted rows."""
        if not self.supabase:
            raise RuntimeError("Supabase not configured")
        
        try:
            result = (
                self.supabase.table('forecast_data')
                .delete()
                .eq('region_code', region_code)
                .execute()
            )
            
            count = len(result.data) if result.data else 0
            logger.info(f"Deleted {count} records for region {region_code}")
            return count
            
        except Exception as e:
            logger.error(f"Error deleting data: {e}")
            raise


# Singleton instance
_data_store: Optional[RealDataStore] = None


def get_real_data_store() -> RealDataStore:
    """Get or create the real data store singleton."""
    global _data_store
    if _data_store is None:
        _data_store = RealDataStore()
    return _data_store
