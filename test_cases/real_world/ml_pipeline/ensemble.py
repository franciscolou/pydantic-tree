"""
Real-world ML pipeline (3/3): ensemble methods.
Combines: multiple inheritance, Generic, @classmethod, abstract, attr redefinition.
"""
from __future__ import annotations
import abc
from typing import Any, Generic, TypeVar
from base import Estimator, Transformer


X = TypeVar("X")
Y = TypeVar("Y")


class WeightedMixin:
    weights: list[float] | None = None
    normalize_weights: bool = True

    @staticmethod
    def normalize(weights: list[float]) -> list[float]:
        total = sum(weights)
        return [w / total for w in weights] if total else weights

    def effective_weights(self, n: int) -> list[float]:
        if self.weights is None:
            return [1.0 / n] * n
        w = (self.weights or [])[:n]
        return self.normalize(w) if self.normalize_weights else w


class VotingMixin:
    voting: str = "hard"
    flatten_transform: bool = True

    @staticmethod
    def majority_vote(predictions: list[Any]) -> Any:
        from collections import Counter
        return Counter(predictions).most_common(1)[0][0]

    @staticmethod
    def soft_vote(predictions: list[Any], weights: list[float]) -> Any:
        weighted = {}
        for pred, w in zip(predictions, weights):
            weighted[pred] = weighted.get(pred, 0.0) + w
        return max(weighted, key=lambda k: weighted[k])


class Ensemble(Estimator[X, Y], abc.ABC, Generic[X, Y]):
    estimators: list[tuple[str, Estimator[Any, Any]]]
    is_fitted: bool = False
    verbose: int = 0

    def __init__(
        self,
        estimators: list[tuple[str, Estimator[Any, Any]]],
        verbose: int = 0,
    ) -> None:
        self.estimators = estimators
        self.verbose = verbose

    @classmethod
    def default_params(cls) -> dict[str, Any]:
        return {"estimators": [], "verbose": 0}

    @abc.abstractmethod
    def aggregate(self, predictions: list[Y]) -> Y: ...

    def fit(self, X: X, y: Y | None = None) -> "Ensemble[X, Y]":
        for name, est in self.estimators:
            est.fit(X, y)
        self.is_fitted = True
        return self

    def predict(self, X: X) -> Y:
        self.check_is_fitted()
        preds = [est.predict(X) for _, est in self.estimators]
        return self.aggregate(preds)

    def named_estimators(self) -> dict[str, Estimator[Any, Any]]:
        return dict(self.estimators)


class VotingEnsemble(Ensemble[X, Y], WeightedMixin, VotingMixin, Generic[X, Y]):
    voting: str = "soft"          # redefined with different default
    weights: list[float] | None = None

    @classmethod
    def default_params(cls) -> dict[str, Any]:
        return {**super().default_params(), "voting": "soft", "weights": None}

    def aggregate(self, predictions: list[Y]) -> Y:
        if self.voting == "hard":
            return self.majority_vote(predictions)
        ws = self.effective_weights(len(predictions))
        return self.soft_vote(predictions, ws)


class StackingEnsemble(Ensemble[X, Y], Generic[X, Y]):
    final_estimator: Estimator[X, Y] | None = None
    passthrough: bool = False
    cv: int = 5
    stack_method: str = "auto"

    @classmethod
    def default_params(cls) -> dict[str, Any]:
        return {
            **super().default_params(),
            "cv": 5,
            "passthrough": False,
            "stack_method": "auto",
        }

    def aggregate(self, predictions: list[Y]) -> Y:
        if self.final_estimator is None:
            raise ValueError("final_estimator must be set before calling predict")
        return self.final_estimator.predict(predictions)  # type: ignore

    def fit(self, X: X, y: Y | None = None) -> "StackingEnsemble[X, Y]":
        super().fit(X, y)
        if self.final_estimator is not None:
            meta_features: list[Any] = [est.predict(X) for _, est in self.estimators]
            self.final_estimator.fit(meta_features, y)  # type: ignore
        return self


class BaggingEnsemble(Ensemble[X, Y], WeightedMixin, Generic[X, Y]):
    n_estimators: int = 10
    max_samples: float = 1.0
    max_features: float = 1.0
    bootstrap: bool = True
    bootstrap_features: bool = False
    random_state: int | None = None
    oob_score: bool = False

    oob_score_: float | None = None

    @classmethod
    def default_params(cls) -> dict[str, Any]:
        return {
            **super().default_params(),
            "n_estimators": 10,
            "max_samples": 1.0,
            "bootstrap": True,
        }

    def aggregate(self, predictions: list[Y]) -> Y:
        ws = self.effective_weights(len(predictions))
        return self.majority_vote(predictions)  # type: ignore
