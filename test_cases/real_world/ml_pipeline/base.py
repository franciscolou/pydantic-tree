"""
Real-world ML pipeline (1/3): abstract estimators and transformers.
Combines: ABC, Generic[T], @classmethod, @abstractmethod, multi-line sigs.
"""
from __future__ import annotations
import abc
from typing import Any, Generic, TypeVar


X = TypeVar("X")
Y = TypeVar("Y")


class Estimator(abc.ABC, Generic[X, Y]):
    is_fitted: bool = False
    n_features_in: int | None = None
    feature_names_in: list[str] | None = None
    _tags: dict[str, Any]

    @abc.abstractmethod
    def fit(self, X: X, y: Y | None = None) -> "Estimator[X, Y]": ...

    @abc.abstractmethod
    def predict(self, X: X) -> Y: ...

    def fit_predict(self, X: X, y: Y | None = None) -> Y:
        return self.fit(X, y).predict(X)

    def check_is_fitted(self) -> None:
        if not self.is_fitted:
            raise RuntimeError(f"{type(self).__name__} is not fitted yet")

    @classmethod
    def from_params(cls, **params: Any) -> "Estimator[X, Y]":
        obj = cls.__new__(cls)
        for k, v in params.items():
            setattr(obj, k, v)
        return obj

    @classmethod
    @abc.abstractmethod
    def default_params(cls) -> dict[str, Any]: ...

    @classmethod
    def param_names(cls) -> list[str]:
        return list(cls.default_params().keys())


class Transformer(Estimator[X, X], abc.ABC):
    @abc.abstractmethod
    def transform(self, X: X) -> X: ...

    def fit_transform(
        self,
        X: X,
        y: X | None = None,
        **fit_params: Any,
    ) -> X:
        return self.fit(X, y).transform(X)

    def predict(self, X: X) -> X:
        return self.transform(X)

    def inverse_transform(self, X: X) -> X:
        raise NotImplementedError


class StatefulTransformer(Transformer[X], abc.ABC):
    state: dict[str, Any]
    n_samples_seen: int = 0
    feature_stats: dict[str, Any]

    def __init__(self) -> None:
        self.state = {}
        self.feature_stats = {}
        self.n_samples_seen = 0

    @abc.abstractmethod
    def update_state(self, X: X) -> None: ...

    @abc.abstractmethod
    def apply_state(self, X: X) -> X: ...

    def fit(self, X: X, y: X | None = None) -> "StatefulTransformer[X]":
        self.update_state(X)
        self.is_fitted = True
        return self

    def transform(self, X: X) -> X:
        self.check_is_fitted()
        return self.apply_state(X)


class Pipeline(Estimator[X, Y], Generic[X, Y]):
    steps: list[tuple[str, Estimator[Any, Any]]]
    memory: str | None = None
    verbose: bool = False

    def __init__(
        self,
        steps: list[tuple[str, Estimator[Any, Any]]],
        memory: str | None = None,
        verbose: bool = False,
    ) -> None:
        self.steps = steps
        self.memory = memory
        self.verbose = verbose

    def fit(self, X: X, y: Y | None = None) -> "Pipeline[X, Y]":
        for _, step in self.steps[:-1]:
            X = step.fit_transform(X, y)  # type: ignore
        self.steps[-1][1].fit(X, y)
        self.is_fitted = True
        return self

    def predict(self, X: X) -> Y:
        for _, step in self.steps[:-1]:
            X = step.transform(X)  # type: ignore
        return self.steps[-1][1].predict(X)

    @classmethod
    def default_params(cls) -> dict[str, Any]:
        return {"steps": [], "verbose": False}
