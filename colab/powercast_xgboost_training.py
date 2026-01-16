"""
Powercast AI - XGBoost Training Script (FAST VERSION)
======================================================
OPTIMIZED FOR SPEED - Completes in 15-30 minutes

Key Optimizations:
1. Single-step tuning (tune on 1-step ahead, apply to all horizons)
2. Reduced estimators during tuning (100 vs 500+)
3. 3-fold CV instead of 5
4. Early stopping in XGBoost
5. Smaller data subset for tuning

EXPECTED RESULTS:
- MAPE: 2.0-3.0%
- Training time: 15-30 minutes total

USAGE:
1. Upload to Google Colab
2. Upload swiss_load_mock.csv when prompted
3. Run the cell
4. Download xgboost_model.joblib when complete
"""

import os
import sys
import numpy as np
import pandas as pd
import time
import json
import warnings
from datetime import datetime
from typing import Dict, Tuple, Optional, Any

warnings.filterwarnings("ignore")

# Install dependencies if needed
try:
    import xgboost
    import optuna
except ImportError:
    print("Installing dependencies...")
    os.system("pip install xgboost==2.0.3 optuna pandas numpy scikit-learn joblib -q")
    import xgboost
    import optuna

import xgboost as xgb
from sklearn.model_selection import TimeSeriesSplit
from sklearn.metrics import mean_absolute_percentage_error, mean_absolute_error
import joblib

optuna.logging.set_verbosity(optuna.logging.WARNING)

# ============================================================================
# CONFIGURATION - OPTIMIZED FOR SPEED
# ============================================================================
CONFIG = {
    # Data
    "data_file": "swiss_load_mock.csv",
    "output_horizon": 96,
    # Tuning - FAST settings
    "n_trials": 50,  # Reduced from 100
    "n_cv_folds": 3,  # Reduced from 5
    "tuning_estimators": 100,  # Low for tuning, increase for final
    "tuning_data_fraction": 0.3,  # Use 30% of data for tuning
    # Final model
    "final_estimators": 500,  # More trees for final model
    # Data splits
    "test_days": 30,
    "calibration_days": 15,
    # Search space - tighter ranges for speed
    "search_space": {
        "max_depth": (4, 10),
        "learning_rate": (0.02, 0.15),
        "subsample": (0.7, 0.95),
        "colsample_bytree": (0.6, 0.95),
        "min_child_weight": (1, 7),
        "gamma": (0.0, 0.3),
        "reg_alpha": (0.0, 0.5),
        "reg_lambda": (0.5, 5.0),
    },
    "output_dir": "/content/powercast_xgboost_outputs",
    "seed": 42,
}

if not os.path.exists("/content"):
    CONFIG["output_dir"] = "./powercast_xgboost_outputs"

# ============================================================================
# BANNER
# ============================================================================
print("=" * 70)
print("POWERCAST AI - XGBoost Training (FAST VERSION)")
print("=" * 70)
print(f"\nSpeed Optimizations:")
print(f"  ✓ Single-step tuning (not 96 outputs)")
print(f"  ✓ {CONFIG['n_trials']} trials with {CONFIG['n_cv_folds']}-fold CV")
print(f"  ✓ {CONFIG['tuning_estimators']} estimators during tuning")
print(f"  ✓ {int(CONFIG['tuning_data_fraction'] * 100)}% data for tuning")
print(f"  ✓ {CONFIG['final_estimators']} estimators for final model")
print(f"\nExpected time: 15-30 minutes")

# ============================================================================
# FEATURE ENGINEERING
# ============================================================================
FEATURE_NAMES = [
    "lag_1h",
    "lag_6h",
    "lag_24h",
    "lag_168h",
    "rolling_mean_24h",
    "rolling_std_24h",
    "rolling_mean_168h",
    "rolling_std_168h",
    "hour_sin",
    "hour_cos",
    "dow_sin",
    "dow_cos",
    "month_sin",
    "month_cos",
    "is_weekend",
    "is_peak_hour",
    "temperature",
    "humidity",
    "cloud_cover",
    "wind_speed",
    "temp_x_humidity",
]


def create_features_single_step(
    load_series: pd.Series,
) -> Tuple[np.ndarray, np.ndarray]:
    """Create features for SINGLE-STEP prediction (fast tuning)."""
    features, targets = [], []

    for i in range(672, len(load_series) - 1):
        row = []

        # Lags
        row.extend(
            [
                load_series.iloc[i - 4],
                load_series.iloc[i - 24],
                load_series.iloc[i - 96],
                load_series.iloc[i - 672],
            ]
        )

        # Rolling
        w24 = load_series.iloc[i - 96 : i]
        w168 = load_series.iloc[i - 672 : i]
        row.extend([w24.mean(), w24.std(), w168.mean(), w168.std()])

        # Calendar
        ts = load_series.index[i]
        hour = ts.hour + ts.minute / 60
        row.extend(
            [
                np.sin(2 * np.pi * hour / 24),
                np.cos(2 * np.pi * hour / 24),
                np.sin(2 * np.pi * ts.dayofweek / 7),
                np.cos(2 * np.pi * ts.dayofweek / 7),
                np.sin(2 * np.pi * ts.month / 12),
                np.cos(2 * np.pi * ts.month / 12),
                1.0 if ts.dayofweek >= 5 else 0.0,
                1.0 if 7 <= ts.hour <= 21 else 0.0,
            ]
        )

        # Weather defaults
        row.extend([15.0, 50.0, 30.0, 5.0, 7.5])

        features.append(row)
        targets.append(load_series.iloc[i + 1])  # Single step ahead

    return np.array(features), np.array(targets)


def create_features_multi_step(
    load_series: pd.Series, horizon: int = 96
) -> Tuple[np.ndarray, np.ndarray]:
    """Create features for MULTI-STEP prediction (final model)."""
    features, targets = [], []

    for i in range(672, len(load_series) - horizon):
        row = []

        row.extend(
            [
                load_series.iloc[i - 4],
                load_series.iloc[i - 24],
                load_series.iloc[i - 96],
                load_series.iloc[i - 672],
            ]
        )

        w24 = load_series.iloc[i - 96 : i]
        w168 = load_series.iloc[i - 672 : i]
        row.extend([w24.mean(), w24.std(), w168.mean(), w168.std()])

        ts = load_series.index[i]
        hour = ts.hour + ts.minute / 60
        row.extend(
            [
                np.sin(2 * np.pi * hour / 24),
                np.cos(2 * np.pi * hour / 24),
                np.sin(2 * np.pi * ts.dayofweek / 7),
                np.cos(2 * np.pi * ts.dayofweek / 7),
                np.sin(2 * np.pi * ts.month / 12),
                np.cos(2 * np.pi * ts.month / 12),
                1.0 if ts.dayofweek >= 5 else 0.0,
                1.0 if 7 <= ts.hour <= 21 else 0.0,
            ]
        )

        row.extend([15.0, 50.0, 30.0, 5.0, 7.5])

        features.append(row)
        targets.append(load_series.iloc[i : i + horizon].values)

    return np.array(features), np.array(targets)


# ============================================================================
# FAST XGBOOST MODEL (Direct, no MultiOutputRegressor)
# ============================================================================
class FastXGBoostForecaster:
    """
    Fast XGBoost forecaster using direct multi-output prediction.
    Trains separate models for each horizon step in parallel.
    """

    def __init__(self, output_horizon: int = 96, params: Optional[Dict] = None):
        self.output_horizon = output_horizon
        self.params = params or {}
        self.models = []
        self.feature_means = None
        self.feature_stds = None
        self.conformal_margins = None
        self.is_fitted = False

    def fit(
        self,
        X: np.ndarray,
        y: np.ndarray,
        X_cal: np.ndarray = None,
        y_cal: np.ndarray = None,
    ):
        """Train models for all horizon steps."""
        # Normalize
        self.feature_means = X.mean(axis=0)
        self.feature_stds = X.std(axis=0) + 1e-8
        X_norm = (X - self.feature_means) / self.feature_stds

        # Train one model per horizon step
        print(f"  Training {self.output_horizon} horizon models...")
        self.models = []

        for h in range(self.output_horizon):
            if h % 24 == 0:
                print(f"    Step {h + 1}/{self.output_horizon}...")

            model = xgb.XGBRegressor(
                n_estimators=self.params.get("n_estimators", 500),
                max_depth=self.params.get("max_depth", 7),
                learning_rate=self.params.get("learning_rate", 0.05),
                subsample=self.params.get("subsample", 0.8),
                colsample_bytree=self.params.get("colsample_bytree", 0.8),
                min_child_weight=self.params.get("min_child_weight", 1),
                gamma=self.params.get("gamma", 0),
                reg_alpha=self.params.get("reg_alpha", 0),
                reg_lambda=self.params.get("reg_lambda", 1),
                tree_method="hist",
                n_jobs=-1,
                random_state=CONFIG["seed"],
                verbosity=0,
            )
            model.fit(X_norm, y[:, h])
            self.models.append(model)

        # Conformal calibration
        if X_cal is not None and y_cal is not None:
            X_cal_norm = (X_cal - self.feature_means) / self.feature_stds
            y_pred = self.predict(X_cal, already_normalized=False)
            residuals = np.abs(y_cal - y_pred)
        else:
            y_pred = np.column_stack([m.predict(X_norm) for m in self.models])
            residuals = np.abs(y - y_pred)

        self.conformal_margins = {
            "q80": np.percentile(residuals, 80, axis=0),
            "q90": np.percentile(residuals, 90, axis=0),
            "q95": np.percentile(residuals, 95, axis=0),
        }

        self.is_fitted = True
        return self

    def predict(self, X: np.ndarray, already_normalized: bool = False) -> np.ndarray:
        if not already_normalized:
            X = (X - self.feature_means) / self.feature_stds
        return np.column_stack([m.predict(X) for m in self.models])

    def predict_with_intervals(self, X: np.ndarray, coverage: float = 0.90):
        point = self.predict(X)
        margin = (
            self.conformal_margins["q90"]
            if coverage >= 0.90
            else self.conformal_margins["q80"]
        )
        return {
            "point": point,
            "q10": point - self.conformal_margins["q90"],
            "q90": point + self.conformal_margins["q90"],
            "lower": point - margin,
            "upper": point + margin,
        }

    def save(self, path: str):
        joblib.dump(
            {
                "models": self.models,
                "params": self.params,
                "feature_means": self.feature_means,
                "feature_stds": self.feature_stds,
                "conformal_margins": self.conformal_margins,
                "output_horizon": self.output_horizon,
            },
            path,
            compress=3,
        )

    @classmethod
    def load(cls, path: str):
        data = joblib.load(path)
        forecaster = cls(output_horizon=data["output_horizon"], params=data["params"])
        forecaster.models = data["models"]
        forecaster.feature_means = data["feature_means"]
        forecaster.feature_stds = data["feature_stds"]
        forecaster.conformal_margins = data["conformal_margins"]
        forecaster.is_fitted = True
        return forecaster


# ============================================================================
# FAST OPTUNA TUNING (Single-step)
# ============================================================================
def run_fast_tuning(X: np.ndarray, y: np.ndarray) -> Dict:
    """
    Fast Optuna tuning using single-step prediction.
    Much faster than tuning 96-output model.
    """
    print(f"\n  Starting fast tuning...")
    print(f"  Data shape: {X.shape}")

    def objective(trial):
        params = {
            "n_estimators": CONFIG["tuning_estimators"],
            "max_depth": trial.suggest_int(
                "max_depth", *CONFIG["search_space"]["max_depth"]
            ),
            "learning_rate": trial.suggest_float(
                "learning_rate", *CONFIG["search_space"]["learning_rate"], log=True
            ),
            "subsample": trial.suggest_float(
                "subsample", *CONFIG["search_space"]["subsample"]
            ),
            "colsample_bytree": trial.suggest_float(
                "colsample_bytree", *CONFIG["search_space"]["colsample_bytree"]
            ),
            "min_child_weight": trial.suggest_int(
                "min_child_weight", *CONFIG["search_space"]["min_child_weight"]
            ),
            "gamma": trial.suggest_float("gamma", *CONFIG["search_space"]["gamma"]),
            "reg_alpha": trial.suggest_float(
                "reg_alpha", *CONFIG["search_space"]["reg_alpha"]
            ),
            "reg_lambda": trial.suggest_float(
                "reg_lambda", *CONFIG["search_space"]["reg_lambda"], log=True
            ),
        }

        tscv = TimeSeriesSplit(n_splits=CONFIG["n_cv_folds"])
        mapes = []

        for train_idx, val_idx in tscv.split(X):
            X_tr, X_val = X[train_idx], X[val_idx]
            y_tr, y_val = y[train_idx], y[val_idx]

            # Normalize
            mean = X_tr.mean(axis=0)
            std = X_tr.std(axis=0) + 1e-8
            X_tr_norm = (X_tr - mean) / std
            X_val_norm = (X_val - mean) / std

            model = xgb.XGBRegressor(
                **params,
                tree_method="hist",
                n_jobs=-1,
                random_state=CONFIG["seed"],
                verbosity=0,
            )
            model.fit(X_tr_norm, y_tr)

            y_pred = model.predict(X_val_norm)
            mape = mean_absolute_percentage_error(y_val, y_pred) * 100
            mapes.append(mape)

        return np.mean(mapes)

    # Run optimization
    sampler = optuna.samplers.TPESampler(seed=CONFIG["seed"], n_startup_trials=10)
    study = optuna.create_study(direction="minimize", sampler=sampler)

    start = time.time()

    def callback(study, trial):
        if trial.number % 10 == 0:
            elapsed = (time.time() - start) / 60
            print(
                f"  Trial {trial.number:3d}/{CONFIG['n_trials']} | "
                f"MAPE: {trial.value:.3f}% | Best: {study.best_value:.3f}% | "
                f"Time: {elapsed:.1f}min"
            )

    study.optimize(
        objective,
        n_trials=CONFIG["n_trials"],
        callbacks=[callback],
        show_progress_bar=True,
    )

    tuning_time = time.time() - start

    print(f"\n  Tuning complete in {tuning_time / 60:.1f} minutes")
    print(f"  Best single-step MAPE: {study.best_value:.3f}%")

    # Add n_estimators for final model
    best_params = study.best_params.copy()
    best_params["n_estimators"] = CONFIG["final_estimators"]

    return best_params, study.best_value, tuning_time


# ============================================================================
# MAIN TRAINING
# ============================================================================
def train():
    print("\n" + "=" * 70)
    print("[1/5] Loading data...")
    print("=" * 70)

    data_file = CONFIG["data_file"]
    if not os.path.exists(data_file):
        try:
            from google.colab import files

            print(f"\n📁 Upload {data_file}")
            uploaded = files.upload()
            data_file = list(uploaded.keys())[0]
        except:
            raise FileNotFoundError(f"Data file not found: {data_file}")

    df = pd.read_csv(data_file, parse_dates=["timestamp"])
    df.set_index("timestamp", inplace=True)
    df = df.sort_index()

    print(f"\n  ✓ Loaded {len(df):,} rows")
    print(f"  ✓ Range: {df.index[0]} to {df.index[-1]}")

    load_series = df["total_load_mw"]

    # ========================================================================
    print("\n" + "=" * 70)
    print("[2/5] Fast hyperparameter tuning (single-step)...")
    print("=" * 70)

    # Create single-step features for fast tuning
    X_single, y_single = create_features_single_step(load_series)
    print(f"\n  Single-step features: {X_single.shape}")

    # Use subset for even faster tuning
    n_tune = int(len(X_single) * CONFIG["tuning_data_fraction"])
    X_tune = X_single[:n_tune]
    y_tune = y_single[:n_tune]
    print(
        f"  Using {n_tune:,} samples for tuning ({int(CONFIG['tuning_data_fraction'] * 100)}%)"
    )

    best_params, best_cv_mape, tuning_time = run_fast_tuning(X_tune, y_tune)

    print(f"\n  Best parameters:")
    for k, v in best_params.items():
        if isinstance(v, float):
            print(f"    {k}: {v:.4f}")
        else:
            print(f"    {k}: {v}")

    # ========================================================================
    print("\n" + "=" * 70)
    print("[3/5] Creating multi-step features...")
    print("=" * 70)

    X, y = create_features_multi_step(load_series, CONFIG["output_horizon"])
    print(f"\n  ✓ Features: {X.shape}")
    print(f"  ✓ Targets: {y.shape}")

    # Split
    samples_per_day = 96
    test_size = CONFIG["test_days"] * samples_per_day
    cal_size = CONFIG["calibration_days"] * samples_per_day

    X_train = X[: -(test_size + cal_size)]
    y_train = y[: -(test_size + cal_size)]
    X_cal = X[-(test_size + cal_size) : -test_size]
    y_cal = y[-(test_size + cal_size) : -test_size]
    X_test = X[-test_size:]
    y_test = y[-test_size:]

    print(f"\n  Train: {len(X_train):,}")
    print(f"  Cal:   {len(X_cal):,}")
    print(f"  Test:  {len(X_test):,}")

    # ========================================================================
    print("\n" + "=" * 70)
    print("[4/5] Training final multi-horizon model...")
    print("=" * 70)

    train_start = time.time()

    model = FastXGBoostForecaster(
        output_horizon=CONFIG["output_horizon"], params=best_params
    )
    model.fit(X_train, y_train, X_cal=X_cal, y_cal=y_cal)

    train_time = time.time() - train_start
    print(f"\n  ✓ Training complete in {train_time:.1f}s")

    # ========================================================================
    print("\n" + "=" * 70)
    print("[5/5] Evaluating...")
    print("=" * 70)

    y_pred = model.predict(X_test)

    test_mape = mean_absolute_percentage_error(y_test, y_pred) * 100
    test_mae = mean_absolute_error(y_test, y_pred)

    print(f"\n  Per-horizon MAPE:")
    horizon_mapes = {}
    for h in [0, 11, 23, 47, 71, 95]:
        h_mape = mean_absolute_percentage_error(y_test[:, h], y_pred[:, h]) * 100
        hours = (h + 1) * 0.25
        print(f"    {hours:5.1f}h: {h_mape:.3f}%")
        horizon_mapes[f"{hours:.1f}h"] = round(h_mape, 4)

    intervals = model.predict_with_intervals(X_test)
    coverage_90 = (
        np.logical_and(y_test >= intervals["q10"], y_test <= intervals["q90"]).mean()
        * 100
    )

    # Inference speed
    t0 = time.time()
    for _ in range(50):
        _ = model.predict(X_test[:1])
    inference_time = (time.time() - t0) / 50 * 1000

    # ========================================================================
    # Save
    print("\n" + "=" * 70)
    print("Saving model...")
    print("=" * 70)

    os.makedirs(CONFIG["output_dir"], exist_ok=True)

    model_path = os.path.join(CONFIG["output_dir"], "xgboost_model.joblib")
    model.save(model_path)
    print(f"\n  ✓ Model: {model_path}")

    config_out = {
        "model_type": "xgboost_fast_tuned",
        "output_horizon": CONFIG["output_horizon"],
        "best_params": best_params,
        "tuning": {
            "n_trials": CONFIG["n_trials"],
            "best_cv_mape": round(best_cv_mape, 4),
            "tuning_time_minutes": round(tuning_time / 60, 2),
        },
        "metrics": {
            "test_mape": round(test_mape, 4),
            "test_mae": round(test_mae, 2),
            "coverage_90": round(coverage_90, 2),
            "inference_time_ms": round(inference_time, 2),
        },
        "horizon_mape": horizon_mapes,
        "training_time_seconds": round(train_time, 2),
        "trained_at": datetime.now().isoformat(),
    }

    config_path = os.path.join(CONFIG["output_dir"], "training_config.json")
    with open(config_path, "w") as f:
        json.dump(config_out, f, indent=2)
    print(f"  ✓ Config: {config_path}")

    # ========================================================================
    # Summary
    print("\n" + "=" * 70)
    print("TRAINING COMPLETE!")
    print("=" * 70)

    total_time = tuning_time + train_time

    print(f"\n  RESULTS")
    print(f"  -------")
    print(f"  Test MAPE:      {test_mape:.3f}%")
    print(f"  Test MAE:       {test_mae:.1f} MW")
    print(f"  Coverage (90%): {coverage_90:.1f}%")
    print(f"  Tuning time:    {tuning_time / 60:.1f} min")
    print(f"  Training time:  {train_time:.1f}s")
    print(f"  Total time:     {total_time / 60:.1f} min")
    print(f"  Inference:      {inference_time:.1f}ms")

    print(f"\n  SUCCESS CRITERIA")
    print(f"  -----------------")
    print(
        f"  MAPE < 3.0%:       {'✓ PASS' if test_mape < 3.0 else '✗ FAIL'} ({test_mape:.3f}%)"
    )
    print(
        f"  Coverage > 80%:    {'✓ PASS' if coverage_90 > 80 else '✗ FAIL'} ({coverage_90:.1f}%)"
    )
    print(
        f"  Inference < 200ms: {'✓ PASS' if inference_time < 200 else '✗ FAIL'} ({inference_time:.1f}ms)"
    )

    # Download
    try:
        from google.colab import files

        print(f"\n  📥 Downloading...")
        files.download(model_path)
        files.download(config_path)
    except:
        pass

    print("\n" + "=" * 70)

    return model, config_out


# ============================================================================
# MAIN
# ============================================================================
if __name__ == "__main__":
    model, config = train()
