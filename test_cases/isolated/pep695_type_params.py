"""
Isolated: PEP 695 type parameter syntax (Python 3.12+).
Uses `class Foo[T]` instead of `Generic[T]`, and `T: Bound` instead of TypeVar.
Tests that the parser correctly strips the [...] section when resolving bases.
"""
from __future__ import annotations
from typing import Any


# ── Simple single TypeVar ─────────────────────────────────────────────────────

class Box[T]:
    value: T | None = None
    label: str = ""

    def set(self, value: T) -> None:
        self.value = value

    def get(self) -> T | None:
        return self.value

    def is_empty(self) -> bool:
        return self.value is None

    def map[U](self, fn: Any) -> "Box[U]": ...


class Stack[T](Box[T]):
    _items: list[T]
    max_size: int = 128
    overflow_policy: str = "raise"

    def push(self, item: T) -> None:
        self._items.append(item)

    def pop(self) -> T:
        return self._items.pop()

    def peek(self) -> T | None:
        return self._items[-1] if self._items else None

    def __len__(self) -> int:
        return len(self._items)


# ── Bounded TypeVar ───────────────────────────────────────────────────────────

class Numeric[T: (int, float)]:
    value: T
    precision: int = 10

    def add(self, other: T) -> T: ...
    def mul(self, other: T) -> T: ...
    def abs_val(self) -> T: ...
    def clamp(self, lo: T, hi: T) -> T: ...


class Counter[T: (int, float)](Numeric[T]):
    count: int = 0
    step: T
    initial: T

    def increment(self) -> None: ...
    def decrement(self) -> None: ...
    def reset(self) -> None: ...
    def value_at(self, n: int) -> T: ...


# ── Multiple TypeVars ─────────────────────────────────────────────────────────

class Pair[K, V]:
    first: K
    second: V
    separator: str = ":"

    def swap(self) -> "Pair[V, K]": ...
    def to_tuple(self) -> tuple[K, V]: ...
    def to_dict(self) -> dict[str, Any]: ...


class Registry[K, V](Pair[K, V]):
    _store: dict[K, V]
    capacity: int = 1000
    evict_on_full: bool = False

    def put(self, key: K, value: V) -> None: ...
    def get(self, key: K) -> V | None: ...
    def remove(self, key: K) -> bool: ...
    def clear(self) -> None: ...
    def keys(self) -> list[K]: ...
    def values(self) -> list[V]: ...


# ── Multi-line type param list ────────────────────────────────────────────────

class Transform[
    Input,
    Output,
]:
    is_fitted: bool = False
    input_shape: tuple[int, ...] | None = None
    output_shape: tuple[int, ...] | None = None

    def fit(self, data: Input) -> "Transform[Input, Output]": ...
    def apply(self, data: Input) -> Output: ...
    def fit_apply(self, data: Input) -> Output: ...
    def inverse(self, data: Output) -> Input: ...


class Pipeline[
    Input,
    Intermediate,
    Output,
](Transform[Input, Output]):
    stages: list[Any]
    verbose: bool = False
    cache_intermediate: bool = False

    def add_stage(self, stage: Any) -> None: ...
    def run(self, data: Input) -> Output: ...
    def run_until(self, data: Input, stage_name: str) -> Any: ...


# ── TypeVarTuple and ParamSpec ────────────────────────────────────────────────

class Args[*Ts]:
    items: tuple[Any, ...]
    length: int = 0

    def get_item(self, index: int) -> Any: ...
    def unpack(self) -> Any: ...


class Callback[**P, R]:
    description: str = ""
    is_async: bool = False
    retries: int = 0

    def call(self, *args: Any, **kwargs: Any) -> R: ...
    def bind(self, *args: Any) -> "Callback[..., R]": ...
    def memoize(self) -> "Callback[P, R]": ...


# ── Bounded with single type (not union) ─────────────────────────────────────

class Comparable[T: str]:
    value: T
    case_sensitive: bool = True

    def less_than(self, other: T) -> bool: ...
    def greater_than(self, other: T) -> bool: ...
    def equals(self, other: T) -> bool: ...


class SortedList[T: str](Comparable[T]):
    _items: list[T]
    reverse: bool = False
    key_fn: Any = None

    def insert(self, item: T) -> None: ...
    def remove(self, item: T) -> bool: ...
    def find(self, item: T) -> int: ...
    def slice(self, start: int, stop: int) -> list[T]: ...
