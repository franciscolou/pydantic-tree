"""
Real-world ML pipeline (2/3): concrete preprocessing transformers.
Combines: multi-line sigs, attr redefinition, @staticmethod, @classmethod.
"""
from __future__ import annotations
from typing import Any, Literal
from base import StatefulTransformer


class Scaler(StatefulTransformer[list[list[float]]]):
    strategy: Literal["standard", "minmax", "robust"] = "standard"
    with_mean: bool = True
    with_std: bool = True
    clip: bool = False
    clip_min: float = -10.0
    clip_max: float = 10.0
    copy: bool = True

    mean_: list[float] | None = None
    scale_: list[float] | None = None
    var_: list[float] | None = None
    n_samples_seen: int = 0   # redefined (same type, explicit redeclaration)

    @classmethod
    def default_params(cls) -> dict[str, Any]:
        return {
            "strategy": "standard",
            "with_mean": True,
            "with_std": True,
            "clip": False,
        }

    @staticmethod
    def compute_mean(data: list[list[float]]) -> list[float]:
        if not data:
            return []
        n = len(data[0])
        return [sum(row[i] for row in data) / len(data) for i in range(n)]

    @staticmethod
    def compute_std(
        data: list[list[float]],
        mean: list[float],
        ddof: int = 0,
    ) -> list[float]:
        n = len(data)
        if n == 0:
            return []
        k = len(mean)
        return [
            (sum((row[i] - mean[i]) ** 2 for row in data) / max(n - ddof, 1)) ** 0.5
            for i in range(k)
        ]

    @staticmethod
    def compute_minmax(
        data: list[list[float]],
    ) -> tuple[list[float], list[float]]:
        if not data:
            return [], []
        n = len(data[0])
        mins = [min(row[i] for row in data) for i in range(n)]
        maxs = [max(row[i] for row in data) for i in range(n)]
        return mins, maxs

    def update_state(self, X: list[list[float]]) -> None:
        self.mean_ = self.compute_mean(X)
        self.scale_ = self.compute_std(X, self.mean_)
        self.n_samples_seen = len(X)

    def apply_state(self, X: list[list[float]]) -> list[list[float]]:
        if self.mean_ is None or self.scale_ is None:
            raise RuntimeError("Scaler not fitted")
        result = []
        for row in X:
            scaled = []
            for i, val in enumerate(row):
                v = val - (self.mean_[i] if self.with_mean else 0.0)
                if self.with_std and self.scale_[i]:
                    v /= self.scale_[i]
                if self.clip:
                    v = max(self.clip_min, min(self.clip_max, v))
                scaled.append(v)
            result.append(scaled)
        return result


class Encoder(StatefulTransformer[list[list[Any]]]):
    strategy: Literal["onehot", "ordinal", "target"] = "onehot"
    handle_unknown: Literal["error", "ignore", "infrequent"] = "ignore"
    min_frequency: int | None = None
    max_categories: int | None = None
    sparse_output: bool = False
    drop: Literal["first", "if_binary"] | None = None

    categories_: list[list[Any]] | None = None
    n_samples_seen: int = 0     # redefined

    @classmethod
    def default_params(cls) -> dict[str, Any]:
        return {
            "strategy": "onehot",
            "handle_unknown": "ignore",
            "min_frequency": None,
            "max_categories": None,
        }

    @staticmethod
    def infer_categories(
        column: list[Any],
        min_frequency: int | None = None,
        max_categories: int | None = None,
    ) -> list[Any]:
        from collections import Counter
        counts = Counter(column)
        cats = sorted(counts, key=lambda c: -counts[c])
        if min_frequency is not None:
            cats = [c for c in cats if counts[c] >= min_frequency]
        if max_categories is not None:
            cats = cats[:max_categories]
        return cats

    def update_state(self, X: list[list[Any]]) -> None:
        if not X:
            return
        n_cols = len(X[0])
        self.categories_ = [
            self.infer_categories(
                [row[i] for row in X],
                self.min_frequency,
                self.max_categories,
            )
            for i in range(n_cols)
        ]
        self.n_samples_seen = len(X)

    def apply_state(self, X: list[list[Any]]) -> list[list[Any]]:
        return X


class Imputer(StatefulTransformer[list[list[float | None]]]):
    strategy: Literal["mean", "median", "most_frequent", "constant"] = "mean"
    fill_value: float | str | None = None
    missing_indicator: bool = False
    add_indicator: bool = False

    statistics_: list[float] | None = None
    indicator_: Any = None
    n_samples_seen: int = 0   # redefined

    @classmethod
    def default_params(cls) -> dict[str, Any]:
        return {"strategy": "mean", "fill_value": None}

    @staticmethod
    def column_mean(col: list[float | None]) -> float:
        vals = [v for v in col if v is not None]
        return sum(vals) / len(vals) if vals else 0.0

    @staticmethod
    def column_median(col: list[float | None]) -> float:
        vals = sorted(v for v in col if v is not None)
        if not vals:
            return 0.0
        mid = len(vals) // 2
        return vals[mid] if len(vals) % 2 else (vals[mid - 1] + vals[mid]) / 2

    def update_state(self, X: list[list[float | None]]) -> None:
        if not X:
            return
        n_cols = len(X[0])
        self.statistics_ = [
            self.column_mean([row[i] for row in X])
            if self.strategy == "mean"
            else self.column_median([row[i] for row in X])
            for i in range(n_cols)
        ]
        self.n_samples_seen = len(X)

    def apply_state(self, X: list[list[float | None]]) -> list[list[float | None]]:
        if self.statistics_ is None:
            raise RuntimeError("Imputer not fitted")
        return [
            [v if v is not None else self.statistics_[i] for i, v in enumerate(row)]
            for row in X
        ]
