"""
Feature engineering for load forecasting.
21 engineered features based on validated time-series forecasting practices.
"""

import numpy as np
import pandas as pd
from typing import Tuple, Optional


FEATURE_NAMES = [
    # Lag features (4)
    "lag_1h",
    "lag_6h",
    "lag_24h",
    "lag_168h",
    # Rolling statistics (4)
    "rolling_mean_24h",
    "rolling_std_24h",
    "rolling_mean_168h",
    "rolling_std_168h",
    # Calendar features (8)
    "hour_sin",
    "hour_cos",
    "dow_sin",
    "dow_cos",
    "month_sin",
    "month_cos",
    "is_weekend",
    "is_peak_hour",
    # Weather features (5)
    "temperature",
    "humidity",
    "cloud_cover",
    "wind_speed",
    "temp_x_humidity",
]


def create_features(
    load_series: pd.Series,
    weather_df: Optional[pd.DataFrame] = None,
    output_horizon: int = 96,
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Create features and targets for training XGBoost forecaster.

    Args:
        load_series: Load values with datetime index (15-min intervals)
        weather_df: Optional weather data with columns ['temperature', 'humidity', 'cloud_cover', 'wind_speed']
        output_horizon: Number of steps to forecast (default: 96 = 24 hours)

    Returns:
        X: Feature array (n_samples, 21)
        y: Target array (n_samples, output_horizon)
    """
    features = []
    targets = []

    # Need 168 hours (1 week) of history = 672 time steps at 15-min intervals
    # Start from index 672 to ensure sufficient lag data
    for i in range(672, len(load_series) - output_horizon):
        row = []

        # ==================== LAG FEATURES ====================
        # Recent lags capture short-term dynamics
        row.append(load_series.iloc[i - 4])  # 1h ago (4 * 15min)
        row.append(load_series.iloc[i - 24])  # 6h ago (24 * 15min)
        row.append(load_series.iloc[i - 96])  # 24h ago (daily pattern)
        row.append(load_series.iloc[i - 672])  # 168h ago (weekly pattern)

        # ==================== ROLLING STATISTICS ====================
        # Capture trend and volatility
        window_24h = load_series.iloc[i - 96 : i]
        window_168h = load_series.iloc[i - 672 : i]
        row.append(window_24h.mean())
        row.append(window_24h.std())
        row.append(window_168h.mean())
        row.append(window_168h.std())

        # ==================== CALENDAR FEATURES ====================
        # Cyclical encoding for periodic patterns
        ts = load_series.index[i]
        hour = ts.hour + ts.minute / 60

        # Hour of day (0-24)
        row.append(np.sin(2 * np.pi * hour / 24))
        row.append(np.cos(2 * np.pi * hour / 24))

        # Day of week (0-6)
        row.append(np.sin(2 * np.pi * ts.dayofweek / 7))
        row.append(np.cos(2 * np.pi * ts.dayofweek / 7))

        # Month of year (1-12)
        row.append(np.sin(2 * np.pi * ts.month / 12))
        row.append(np.cos(2 * np.pi * ts.month / 12))

        # Binary indicators
        row.append(1.0 if ts.dayofweek >= 5 else 0.0)  # Weekend
        row.append(1.0 if 7 <= ts.hour <= 21 else 0.0)  # Peak hours

        # ==================== WEATHER FEATURES ====================
        if weather_df is not None and ts in weather_df.index:
            temp = weather_df.loc[ts, "temperature"]
            humidity = weather_df.loc[ts, "humidity"]
            row.append(temp)
            row.append(humidity)
            row.append(weather_df.loc[ts, "cloud_cover"])
            row.append(weather_df.loc[ts, "wind_speed"])
            row.append(temp * humidity / 100)  # Interaction term
        else:
            # Default weather values (Swiss averages)
            row.extend([15.0, 50.0, 30.0, 5.0, 7.5])

        features.append(row)
        targets.append(load_series.iloc[i : i + output_horizon].values)

    return np.array(features), np.array(targets)


def create_inference_features(
    load_history: pd.Series,
    forecast_start: pd.Timestamp,
    weather_df: Optional[pd.DataFrame] = None,
) -> np.ndarray:
    """
    Create features for real-time inference (single prediction).

    Args:
        load_history: Historical load data (must have at least 672 recent values)
        forecast_start: Timestamp for which to create features
        weather_df: Optional weather forecast data

    Returns:
        Feature vector (1, 21)
    """
    if len(load_history) < 672:
        raise ValueError(
            f"Need at least 672 historical values, got {len(load_history)}"
        )

    row = []

    # Use the last 672 values
    recent = load_history.iloc[-672:]

    # Lag features
    row.append(recent.iloc[-4])  # 1h ago
    row.append(recent.iloc[-24])  # 6h ago
    row.append(recent.iloc[-96])  # 24h ago
    row.append(recent.iloc[-672])  # 168h ago

    # Rolling statistics
    window_24h = recent.iloc[-96:]
    window_168h = recent
    row.append(window_24h.mean())
    row.append(window_24h.std())
    row.append(window_168h.mean())
    row.append(window_168h.std())

    # Calendar features for forecast start time
    hour = forecast_start.hour + forecast_start.minute / 60
    row.append(np.sin(2 * np.pi * hour / 24))
    row.append(np.cos(2 * np.pi * hour / 24))
    row.append(np.sin(2 * np.pi * forecast_start.dayofweek / 7))
    row.append(np.cos(2 * np.pi * forecast_start.dayofweek / 7))
    row.append(np.sin(2 * np.pi * forecast_start.month / 12))
    row.append(np.cos(2 * np.pi * forecast_start.month / 12))
    row.append(1.0 if forecast_start.dayofweek >= 5 else 0.0)
    row.append(1.0 if 7 <= forecast_start.hour <= 21 else 0.0)

    # Weather features
    if weather_df is not None and forecast_start in weather_df.index:
        temp = weather_df.loc[forecast_start, "temperature"]
        humidity = weather_df.loc[forecast_start, "humidity"]
        row.append(temp)
        row.append(humidity)
        row.append(weather_df.loc[forecast_start, "cloud_cover"])
        row.append(weather_df.loc[forecast_start, "wind_speed"])
        row.append(temp * humidity / 100)
    else:
        row.extend([15.0, 50.0, 30.0, 5.0, 7.5])

    return np.array([row])
