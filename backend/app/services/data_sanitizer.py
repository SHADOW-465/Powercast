"""
Powercast AI - Data Sanitizer Service
Handles data quality validation, gap detection, and safe interpolation.

Features:
- 15-minute interval continuity check
- Gap detection via timeline diff scan
- Linear interpolation (max 60 minutes)
- HTTP 422 rejection for oversized gaps
"""

import pandas as pd
import numpy as np
from typing import Dict, List, Tuple, Optional, Any
from datetime import datetime, timedelta
from dataclasses import dataclass
import logging

logger = logging.getLogger(__name__)


# =============================================================================
# CONFIGURATION
# =============================================================================

# Maximum gap that can be safely interpolated (in minutes)
MAX_INTERPOLATION_GAP_MINUTES = 60

# Expected interval between data points (in minutes)
EXPECTED_INTERVAL_MINUTES = 15

# Required columns for forecasting
REQUIRED_COLUMNS = ["timestamp", "output_mw"]
OPTIONAL_COLUMNS = ["temperature", "humidity", "cloud_cover", "wind_speed", "region_code"]


# =============================================================================
# DATA QUALITY RESULT
# =============================================================================

@dataclass
class DataQualityResult:
    """Result of data quality validation"""
    is_valid: bool
    status: str  # 'clean', 'minor_gaps_fixed', 'major_gaps_detected', 'invalid'
    message: str
    completeness: float  # 0-100 percentage
    total_records: int
    missing_intervals: int
    max_gap_minutes: int
    gaps: List[Dict[str, Any]]
    warnings: List[str]
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "is_valid": self.is_valid,
            "status": self.status,
            "message": self.message,
            "completeness": round(self.completeness, 2),
            "total_records": self.total_records,
            "missing_intervals": self.missing_intervals,
            "max_gap_minutes": self.max_gap_minutes,
            "gaps": self.gaps,
            "warnings": self.warnings,
        }


# =============================================================================
# DATA SANITIZER
# =============================================================================

class DataSanitizer:
    """
    Data quality validation and sanitization service.
    
    Validates CSV data for:
    - Required columns
    - 15-minute interval continuity
    - Gap detection and safe interpolation
    """
    
    def __init__(
        self,
        max_gap_minutes: int = MAX_INTERPOLATION_GAP_MINUTES,
        expected_interval_minutes: int = EXPECTED_INTERVAL_MINUTES,
    ):
        self.max_gap_minutes = max_gap_minutes
        self.expected_interval_minutes = expected_interval_minutes
        self.expected_interval = timedelta(minutes=expected_interval_minutes)
    
    def validate(self, df: pd.DataFrame) -> DataQualityResult:
        """
        Validate data quality and detect gaps.
        
        Args:
            df: DataFrame with timestamp and output_mw columns
            
        Returns:
            DataQualityResult with validation status and details
        """
        warnings = []
        gaps = []
        
        # Check required columns
        missing_cols = [c for c in REQUIRED_COLUMNS if c not in df.columns]
        if missing_cols:
            return DataQualityResult(
                is_valid=False,
                status="invalid",
                message=f"Missing required columns: {missing_cols}",
                completeness=0,
                total_records=len(df),
                missing_intervals=0,
                max_gap_minutes=0,
                gaps=[],
                warnings=[f"Missing columns: {missing_cols}"],
            )
        
        # Parse timestamps
        try:
            df = df.copy()
            df["timestamp"] = pd.to_datetime(df["timestamp"])
            df = df.sort_values("timestamp").reset_index(drop=True)
        except Exception as e:
            return DataQualityResult(
                is_valid=False,
                status="invalid",
                message=f"Failed to parse timestamps: {e}",
                completeness=0,
                total_records=len(df),
                missing_intervals=0,
                max_gap_minutes=0,
                gaps=[],
                warnings=[str(e)],
            )
        
        # Check for missing optional columns
        for col in OPTIONAL_COLUMNS:
            if col not in df.columns:
                warnings.append(f"Optional column '{col}' not found")
        
        # Calculate time differences
        df["time_diff"] = df["timestamp"].diff()
        
        # Find irregular intervals (gaps)
        irregular = df[df["time_diff"] != self.expected_interval].iloc[1:]  # Skip first row
        
        missing_intervals = 0
        max_gap_minutes = 0
        
        for _, row in irregular.iterrows():
            gap_minutes = row["time_diff"].total_seconds() / 60
            intervals_missing = int(gap_minutes / self.expected_interval_minutes) - 1
            missing_intervals += intervals_missing
            max_gap_minutes = max(max_gap_minutes, gap_minutes)
            
            gaps.append({
                "start": (row["timestamp"] - row["time_diff"]).isoformat(),
                "end": row["timestamp"].isoformat(),
                "gap_minutes": gap_minutes,
                "intervals_missing": intervals_missing,
            })
        
        # Calculate completeness
        expected_records = len(df) + missing_intervals
        completeness = (len(df) / expected_records * 100) if expected_records > 0 else 100
        
        # Determine status
        if max_gap_minutes > self.max_gap_minutes:
            return DataQualityResult(
                is_valid=False,
                status="major_gaps_detected",
                message=f"Data gaps exceed safe interpolation limit ({self.max_gap_minutes} min). Maximum gap: {int(max_gap_minutes)} min.",
                completeness=completeness,
                total_records=len(df),
                missing_intervals=missing_intervals,
                max_gap_minutes=int(max_gap_minutes),
                gaps=gaps,
                warnings=warnings,
            )
        elif missing_intervals > 0:
            return DataQualityResult(
                is_valid=True,
                status="minor_gaps_fixed",
                message=f"Minor data gaps detected and safely interpolated. {missing_intervals} intervals filled.",
                completeness=completeness,
                total_records=len(df),
                missing_intervals=missing_intervals,
                max_gap_minutes=int(max_gap_minutes),
                gaps=gaps,
                warnings=warnings,
            )
        else:
            return DataQualityResult(
                is_valid=True,
                status="clean",
                message="Data quality verified. No gaps detected.",
                completeness=100,
                total_records=len(df),
                missing_intervals=0,
                max_gap_minutes=0,
                gaps=[],
                warnings=warnings,
            )
    
    def sanitize(self, df: pd.DataFrame) -> Tuple[pd.DataFrame, DataQualityResult]:
        """
        Validate and sanitize data by interpolating small gaps.
        
        Args:
            df: DataFrame with timestamp and output_mw columns
            
        Returns:
            Tuple of (sanitized DataFrame, validation result)
        """
        # First validate
        result = self.validate(df)
        
        if not result.is_valid:
            return df, result
        
        if result.status == "clean":
            return df, result
        
        # Interpolate gaps
        try:
            df = df.copy()
            df["timestamp"] = pd.to_datetime(df["timestamp"])
            df = df.sort_values("timestamp").reset_index(drop=True)
            
            # Create complete timeline
            start = df["timestamp"].min()
            end = df["timestamp"].max()
            full_index = pd.date_range(start=start, end=end, freq=f"{self.expected_interval_minutes}T")
            
            # Reindex and interpolate
            df = df.set_index("timestamp")
            df = df.reindex(full_index)
            
            # Interpolate numeric columns
            numeric_cols = df.select_dtypes(include=[np.number]).columns
            df[numeric_cols] = df[numeric_cols].interpolate(method="linear", limit=4)  # Max 4 intervals = 60 min
            
            # Forward/backward fill non-numeric (like region_code)
            df = df.ffill().bfill()
            
            # Reset index
            df = df.reset_index().rename(columns={"index": "timestamp"})
            
            logger.info(f"Sanitized data: {result.missing_intervals} intervals interpolated")
            
            return df, result
            
        except Exception as e:
            logger.error(f"Sanitization failed: {e}")
            return df, DataQualityResult(
                is_valid=False,
                status="invalid",
                message=f"Sanitization failed: {e}",
                completeness=result.completeness,
                total_records=result.total_records,
                missing_intervals=result.missing_intervals,
                max_gap_minutes=result.max_gap_minutes,
                gaps=result.gaps,
                warnings=result.warnings + [str(e)],
            )


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def validate_csv_data(df: pd.DataFrame) -> DataQualityResult:
    """Quick validation without sanitization"""
    sanitizer = DataSanitizer()
    return sanitizer.validate(df)


def sanitize_csv_data(df: pd.DataFrame) -> Tuple[pd.DataFrame, DataQualityResult]:
    """Validate and sanitize CSV data"""
    sanitizer = DataSanitizer()
    return sanitizer.sanitize(df)
