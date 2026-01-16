"""
Powercast AI - Fast XGBoost Forecaster
Trains separate models per horizon step (faster than MultiOutputRegressor)
"""

import numpy as np
import xgboost as xgb
from typing import Dict, Optional, Any
import joblib


class XGBoostForecaster:
    """
    Fast XGBoost forecaster - trains separate models per horizon step.
    Much faster than MultiOutputRegressor approach.
    """

    DEFAULT_PARAMS = {
        "n_estimators": 500,
        "max_depth": 7,
        "learning_rate": 0.05,
        "subsample": 0.8,
        "colsample_bytree": 0.8,
        "min_child_weight": 1,
        "gamma": 0,
        "reg_alpha": 0,
        "reg_lambda": 1,
    }

    def __init__(
        self,
        output_horizon: int = 96,
        params: Optional[Dict[str, Any]] = None,
        **kwargs,
    ):
        self.output_horizon = output_horizon
        self.params = self.DEFAULT_PARAMS.copy()
        if params:
            self.params.update(params)
        self.params.update(kwargs)

        self.models = []
        self.feature_means = None
        self.feature_stds = None
        self.conformal_margins = None
        self.is_fitted = False

    def fit(
        self,
        X: np.ndarray,
        y: np.ndarray,
        X_cal: Optional[np.ndarray] = None,
        y_cal: Optional[np.ndarray] = None,
        verbose: bool = True,
    ) -> "XGBoostForecaster":
        """Train one model per horizon step."""

        # Normalize
        self.feature_means = X.mean(axis=0)
        self.feature_stds = X.std(axis=0) + 1e-8
        X_norm = (X - self.feature_means) / self.feature_stds

        # Train models
        self.models = []
        for h in range(self.output_horizon):
            if verbose and h % 24 == 0:
                print(f"  Training horizon step {h + 1}/{self.output_horizon}...")

            model = xgb.XGBRegressor(
                n_estimators=self.params["n_estimators"],
                max_depth=self.params["max_depth"],
                learning_rate=self.params["learning_rate"],
                subsample=self.params["subsample"],
                colsample_bytree=self.params["colsample_bytree"],
                min_child_weight=self.params["min_child_weight"],
                gamma=self.params["gamma"],
                reg_alpha=self.params["reg_alpha"],
                reg_lambda=self.params["reg_lambda"],
                tree_method="hist",
                n_jobs=-1,
                random_state=42,
                verbosity=0,
            )
            model.fit(X_norm, y[:, h])
            self.models.append(model)

        # Conformal calibration
        if X_cal is not None and y_cal is not None:
            X_cal_norm = (X_cal - self.feature_means) / self.feature_stds
            y_pred = np.column_stack([m.predict(X_cal_norm) for m in self.models])
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

    def predict(self, X: np.ndarray) -> np.ndarray:
        if not self.is_fitted:
            raise ValueError("Model not fitted")
        X_norm = (X - self.feature_means) / self.feature_stds
        return np.column_stack([m.predict(X_norm) for m in self.models])

    def predict_with_intervals(
        self, X: np.ndarray, coverage: float = 0.90
    ) -> Dict[str, np.ndarray]:
        point = self.predict(X)

        if coverage >= 0.95:
            margin = self.conformal_margins["q95"]
        elif coverage >= 0.90:
            margin = self.conformal_margins["q90"]
        else:
            margin = self.conformal_margins["q80"]

        return {
            "point": point,
            "q50": point,
            "q10": point - self.conformal_margins["q90"],
            "q90": point + self.conformal_margins["q90"],
            "lower": point - margin,
            "upper": point + margin,
            "coverage": coverage,
        }

    def get_feature_importance(self) -> np.ndarray:
        if not self.is_fitted:
            raise ValueError("Model not fitted")
        importances = [m.feature_importances_ for m in self.models]
        return np.mean(importances, axis=0)

    def save(self, path: str):
        joblib.dump(
            {
                "models": self.models,
                "params": self.params,
                "feature_means": self.feature_means,
                "feature_stds": self.feature_stds,
                "conformal_margins": self.conformal_margins,
                "output_horizon": self.output_horizon,
                "is_fitted": self.is_fitted,
            },
            path,
            compress=3,
        )

    @classmethod
    def load(cls, path: str) -> "XGBoostForecaster":
        data = joblib.load(path)
        forecaster = cls(
            output_horizon=data["output_horizon"],
            params=data.get("params", cls.DEFAULT_PARAMS),
        )
        forecaster.models = data["models"]
        forecaster.feature_means = data["feature_means"]
        forecaster.feature_stds = data["feature_stds"]
        forecaster.conformal_margins = data.get("conformal_margins", {})
        forecaster.is_fitted = data.get("is_fitted", True)
        return forecaster
