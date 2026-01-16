"""
Powercast AI - XGBoost Training with Optuna Hyperparameter Tuning
Production-grade training pipeline for maximum accuracy.

Usage:
    python train_xgboost.py                    # Full tuning (100 trials)
    python train_xgboost.py --trials 50        # Quick tuning (50 trials)
    python train_xgboost.py --no-tune          # Skip tuning, use best known params
"""

import pandas as pd
import numpy as np
import time
import json
from pathlib import Path
from sklearn.metrics import mean_absolute_percentage_error, mean_absolute_error
from sklearn.model_selection import TimeSeriesSplit
import sys
import warnings

warnings.filterwarnings("ignore")

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from models.xgboost_forecaster import XGBoostForecaster
from data.features import create_features

# Try to import optuna
try:
    import optuna
    from optuna.samplers import TPESampler

    OPTUNA_AVAILABLE = True
except ImportError:
    OPTUNA_AVAILABLE = False
    print("Warning: Optuna not installed. Run: pip install optuna")


# Best known parameters from previous tuning runs
# These are used when --no-tune is specified
BEST_KNOWN_PARAMS = {
    "n_estimators": 1200,
    "max_depth": 9,
    "learning_rate": 0.035,
    "subsample": 0.85,
    "colsample_bytree": 0.75,
    "min_child_weight": 3,
    "gamma": 0.1,
    "reg_alpha": 0.1,
    "reg_lambda": 2.0,
}


def create_objective(X_train, y_train, n_splits=5):
    """
    Create Optuna objective function for hyperparameter optimization.
    Uses TimeSeriesSplit for proper time-series cross-validation.
    """

    def objective(trial):
        # Define hyperparameter search space
        params = {
            "n_estimators": trial.suggest_int("n_estimators", 300, 2000),
            "max_depth": trial.suggest_int("max_depth", 4, 12),
            "learning_rate": trial.suggest_float("learning_rate", 0.01, 0.2, log=True),
            "subsample": trial.suggest_float("subsample", 0.6, 1.0),
            "colsample_bytree": trial.suggest_float("colsample_bytree", 0.5, 1.0),
            "min_child_weight": trial.suggest_int("min_child_weight", 1, 10),
            "gamma": trial.suggest_float("gamma", 0, 0.5),
            "reg_alpha": trial.suggest_float("reg_alpha", 0, 1.0),
            "reg_lambda": trial.suggest_float("reg_lambda", 0.1, 10.0, log=True),
        }

        # Time-series cross-validation
        tscv = TimeSeriesSplit(n_splits=n_splits)
        mapes = []

        for fold, (train_idx, val_idx) in enumerate(tscv.split(X_train)):
            X_tr, X_val = X_train[train_idx], X_train[val_idx]
            y_tr, y_val = y_train[train_idx], y_train[val_idx]

            # Train model
            model = XGBoostForecaster(output_horizon=96, params=params)
            model.fit(X_tr, y_tr)

            # Evaluate
            y_pred = model.predict(X_val)
            mape = mean_absolute_percentage_error(y_val, y_pred) * 100
            mapes.append(mape)

        # Return mean MAPE across folds
        return np.mean(mapes)

    return objective


def run_hyperparameter_tuning(X_train, y_train, n_trials=100, n_splits=5):
    """
    Run Optuna hyperparameter optimization.

    Args:
        X_train: Training features
        y_train: Training targets
        n_trials: Number of optimization trials
        n_splits: Number of cross-validation folds

    Returns:
        Best parameters dictionary
    """
    if not OPTUNA_AVAILABLE:
        print("   ⚠ Optuna not available, using best known parameters")
        return BEST_KNOWN_PARAMS

    print(f"   Starting Optuna optimization ({n_trials} trials, {n_splits}-fold CV)...")
    print(f"   This may take 15-45 minutes depending on hardware.\n")

    # Create study with TPE sampler (Bayesian optimization)
    sampler = TPESampler(seed=42, n_startup_trials=20)
    study = optuna.create_study(
        direction="minimize", sampler=sampler, study_name="powercast_xgboost_tuning"
    )

    # Optimize
    objective = create_objective(X_train, y_train, n_splits)

    # Progress callback
    def callback(study, trial):
        if trial.number % 10 == 0:
            print(
                f"   Trial {trial.number}: MAPE = {trial.value:.3f}% | Best = {study.best_value:.3f}%"
            )

    study.optimize(
        objective,
        n_trials=n_trials,
        callbacks=[callback],
        show_progress_bar=True,
        gc_after_trial=True,
    )

    print(f"\n   ✓ Optimization complete!")
    print(f"   Best MAPE (CV): {study.best_value:.3f}%")
    print(f"   Best params: {study.best_params}")

    return study.best_params


def train(
    data_path: str = "data/swiss_load_mock.csv",
    output_dir: str = "ml/outputs",
    n_trials: int = 100,
    tune: bool = True,
):
    """
    Train XGBoost model with optional hyperparameter tuning.

    Args:
        data_path: Path to training data CSV
        output_dir: Directory to save trained model
        n_trials: Number of Optuna trials
        tune: Whether to run hyperparameter tuning
    """
    print("=" * 70)
    print("POWERCAST AI - XGBoost Training with Optuna Tuning")
    print("=" * 70)

    # ==================== 1. LOAD DATA ====================
    print("\n[1/7] Loading data...")
    df = pd.read_csv(data_path, parse_dates=["timestamp"])
    df.set_index("timestamp", inplace=True)
    df = df.sort_index()
    print(f"   ✓ Loaded {len(df):,} rows")
    print(f"   ✓ Date range: {df.index[0]} to {df.index[-1]}")

    load_series = df["total_load_mw"]

    # ==================== 2. CREATE FEATURES ====================
    print("\n[2/7] Engineering features...")
    X, y = create_features(load_series, output_horizon=96)
    print(f"   ✓ Feature shape: {X.shape}")
    print(f"   ✓ Target shape: {y.shape}")

    # ==================== 3. TRAIN/VAL/TEST SPLIT ====================
    # Test: last 30 days
    # Validation/Calibration: 15 days before test
    # Train: everything else

    test_size = 2880  # 30 days
    cal_size = 1440  # 15 days

    X_train = X[: -(test_size + cal_size)]
    y_train = y[: -(test_size + cal_size)]
    X_cal = X[-(test_size + cal_size) : -test_size]
    y_cal = y[-(test_size + cal_size) : -test_size]
    X_test = X[-test_size:]
    y_test = y[-test_size:]

    print(f"\n[3/7] Data split:")
    print(f"   ✓ Training: {len(X_train):,} samples")
    print(f"   ✓ Calibration: {len(X_cal):,} samples (for conformal prediction)")
    print(f"   ✓ Testing: {len(X_test):,} samples (~30 days)")

    # ==================== 4. HYPERPARAMETER TUNING ====================
    print("\n[4/7] Hyperparameter optimization...")

    if tune and OPTUNA_AVAILABLE:
        start_tune = time.time()
        best_params = run_hyperparameter_tuning(X_train, y_train, n_trials=n_trials)
        tune_time = time.time() - start_tune
        print(f"\n   ✓ Tuning completed in {tune_time / 60:.1f} minutes")
    else:
        if not tune:
            print("   Skipping tuning (--no-tune flag)")
        best_params = BEST_KNOWN_PARAMS.copy()
        print(f"   Using best known parameters: {best_params}")
        tune_time = 0

    # ==================== 5. TRAIN FINAL MODEL ====================
    print("\n[5/7] Training final model with best parameters...")
    start_train = time.time()

    model = XGBoostForecaster(output_horizon=96, params=best_params)

    # Train on full training set, calibrate on calibration set
    model.fit(X_train, y_train, X_cal=X_cal, y_cal=y_cal)

    training_time = time.time() - start_train
    print(f"   ✓ Training completed in {training_time:.2f} seconds")

    # ==================== 6. EVALUATE ====================
    print("\n[6/7] Evaluating on test set...")

    y_pred = model.predict(X_test)

    # Metrics
    test_mape = mean_absolute_percentage_error(y_test, y_pred) * 100
    test_mae = mean_absolute_error(y_test, y_pred)

    # Per-horizon MAPE (to check accuracy degrades over time)
    horizon_mapes = []
    for h in [0, 23, 47, 71, 95]:  # 0h, 6h, 12h, 18h, 24h
        h_mape = mean_absolute_percentage_error(y_test[:, h], y_pred[:, h]) * 100
        horizon_mapes.append((h, h_mape))

    # Prediction intervals
    intervals = model.predict_with_intervals(X_test, coverage=0.90)
    within_90 = (
        np.logical_and(y_test >= intervals["q10"], y_test <= intervals["q90"]).mean()
        * 100
    )

    intervals_80 = model.predict_with_intervals(X_test, coverage=0.80)
    within_80 = (
        np.logical_and(
            y_test >= intervals_80["lower"], y_test <= intervals_80["upper"]
        ).mean()
        * 100
    )

    # Inference speed
    start_infer = time.time()
    for _ in range(100):
        _ = model.predict(X_test[:1])
    inference_time = (time.time() - start_infer) / 100 * 1000

    print(f"   ✓ Test MAPE: {test_mape:.3f}%")
    print(f"   ✓ Test MAE: {test_mae:.1f} MW")
    print(f"   ✓ Coverage (90%): {within_90:.1f}%")
    print(f"   ✓ Coverage (80%): {within_80:.1f}%")
    print(f"   ✓ Inference time: {inference_time:.1f}ms")

    print("\n   Per-horizon MAPE:")
    for h, mape in horizon_mapes:
        hours = (h + 1) * 0.25
        print(f"      {hours:.1f}h ahead: {mape:.3f}%")

    # ==================== 7. SAVE MODEL ====================
    print("\n[7/7] Saving model artifacts...")
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    model.save(output_path / "xgboost_model.joblib")

    # Save comprehensive config
    config = {
        "model_type": "xgboost_tuned",
        "output_horizon": 96,
        "best_params": best_params,
        "tuning": {
            "n_trials": n_trials if tune else 0,
            "tuning_time_minutes": round(tune_time / 60, 2) if tune else 0,
            "method": "optuna_tpe" if tune else "best_known",
        },
        "metrics": {
            "test_mape": round(test_mape, 4),
            "test_mae": round(test_mae, 2),
            "coverage_90": round(within_90, 2),
            "coverage_80": round(within_80, 2),
            "inference_time_ms": round(inference_time, 2),
        },
        "horizon_mape": {
            f"{(h + 1) * 0.25:.1f}h": round(m, 4) for h, m in horizon_mapes
        },
        "data": {
            "source": data_path,
            "n_train": len(X_train),
            "n_cal": len(X_cal),
            "n_test": len(X_test),
            "n_features": X.shape[1],
        },
        "training_time_seconds": round(training_time, 2),
        "trained_at": pd.Timestamp.now().isoformat(),
    }

    with open(output_path / "training_config.json", "w") as f:
        json.dump(config, f, indent=2)

    print(f"   ✓ Model: {output_path / 'xgboost_model.joblib'}")
    print(f"   ✓ Config: {output_path / 'training_config.json'}")

    # ==================== SUMMARY ====================
    print("\n" + "=" * 70)
    print("TRAINING COMPLETE")
    print("=" * 70)
    print(f"Test MAPE:      {test_mape:.3f}%")
    print(f"Test MAE:       {test_mae:.1f} MW")
    print(f"Coverage (90%): {within_90:.1f}%")
    print(f"Coverage (80%): {within_80:.1f}%")
    print(f"Training Time:  {training_time:.2f}s")
    if tune:
        print(f"Tuning Time:    {tune_time / 60:.1f} minutes ({n_trials} trials)")
    print(f"Inference:      {inference_time:.1f}ms")

    print("\n" + "-" * 70)
    print("SUCCESS CRITERIA:")
    print(
        f"   MAPE < 2.5%:       {'✓ PASS' if test_mape < 2.5 else '✗ FAIL'} ({test_mape:.3f}%)"
    )
    print(
        f"   MAPE < 3.0%:       {'✓ PASS' if test_mape < 3.0 else '✗ FAIL'} ({test_mape:.3f}%)"
    )
    print(
        f"   Coverage > 85%:    {'✓ PASS' if within_90 > 85 else '✗ FAIL'} ({within_90:.1f}%)"
    )
    print(
        f"   Inference < 100ms: {'✓ PASS' if inference_time < 100 else '✗ FAIL'} ({inference_time:.1f}ms)"
    )
    print("=" * 70 + "\n")

    return model, config


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(
        description="Train XGBoost forecaster with Optuna tuning"
    )
    parser.add_argument(
        "--data",
        type=str,
        default="data/swiss_load_mock.csv",
        help="Path to training data",
    )
    parser.add_argument(
        "--output",
        type=str,
        default="ml/outputs",
        help="Output directory",
    )
    parser.add_argument(
        "--trials",
        type=int,
        default=100,
        help="Number of Optuna trials (default: 100)",
    )
    parser.add_argument(
        "--no-tune",
        action="store_true",
        help="Skip tuning, use best known parameters",
    )

    args = parser.parse_args()

    train(
        data_path=args.data,
        output_dir=args.output,
        n_trials=args.trials,
        tune=not args.no_tune,
    )
