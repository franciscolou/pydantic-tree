"""
Isolated: TypeVar, Generic[T], covariant/contravariant TypeVars, Protocol.
Tests rendering of parameterized class names and generic inheritance.
"""
from __future__ import annotations
from typing import (
    Any,
    Callable,
    ClassVar,
    Generic,
    Iterator,
    Protocol,
    TypeVar,
    runtime_checkable,
)


T = TypeVar("T")
T_co = TypeVar("T_co", covariant=True)
T_contra = TypeVar("T_contra", contravariant=True)
K = TypeVar("K")
V = TypeVar("V")
N = TypeVar("N", int, float)


@runtime_checkable
class Readable(Protocol[T_co]):
    def read(self) -> T_co: ...
    def peek(self) -> T_co | None: ...


@runtime_checkable
class Writable(Protocol[T_contra]):
    def write(self, value: T_contra) -> None: ...
    def flush(self) -> None: ...


@runtime_checkable
class ReadWritable(Readable[T], Writable[T], Protocol[T]):
    def seek(self, position: int) -> None: ...
    def tell(self) -> int: ...


class Container(Generic[T]):
    _item: T | None = None
    capacity: int = 1

    def set(self, item: T) -> None:
        self._item = item

    def get(self) -> T | None:
        return self._item

    def is_empty(self) -> bool:
        return self._item is None

    def map(self, fn: Callable[[T], V]) -> "Container[V]": ...


class Stack(Container[T]):
    _items: list[T]
    max_size: int = 128

    def __init__(self, max_size: int = 128) -> None:
        self._items = []
        self.max_size = max_size

    def push(self, item: T) -> None:
        self._items.append(item)

    def pop(self) -> T:
        return self._items.pop()

    def peek(self) -> T | None:
        return self._items[-1] if self._items else None

    def __len__(self) -> int:
        return len(self._items)


class BoundedStack(Stack[T]):
    overflow_policy: str = "raise"

    def push(self, item: T) -> None:
        if len(self._items) >= self.max_size:
            if self.overflow_policy == "drop":
                return
            raise OverflowError("Stack is full")
        self._items.append(item)


class Mapping(Generic[K, V]):
    _data: dict[K, V]

    def __init__(self) -> None:
        self._data = {}

    def put(self, key: K, value: V) -> None:
        self._data[key] = value

    def get(self, key: K) -> V | None:
        return self._data.get(key)

    def keys(self) -> Iterator[K]:
        return iter(self._data.keys())

    def values(self) -> Iterator[V]:
        return iter(self._data.values())

    def items(self) -> Iterator[tuple[K, V]]:
        return iter(self._data.items())

    def __len__(self) -> int:
        return len(self._data)


class NumericContainer(Container[N]):
    total: N
    count: int = 0

    def add(self, item: N) -> None: ...
    def sum(self) -> N: ...
    def average(self) -> float: ...
    def minimum(self) -> N: ...
    def maximum(self) -> N: ...
