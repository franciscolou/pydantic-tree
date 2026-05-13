"""
Combined: diamond MRO + Generic[T] + abstract methods.
Two branches both inherit from a generic base and converge in a Duplex class.
Tests the layout engine's diamond detection and longest-path layering with generics.
"""
from __future__ import annotations
import abc
from typing import Generic, Iterator, TypeVar


T = TypeVar("T")


class Source(abc.ABC, Generic[T]):
    is_open: bool = False
    read_count: int = 0

    @abc.abstractmethod
    def open(self) -> None: ...

    @abc.abstractmethod
    def read(self) -> T: ...

    def close(self) -> None:
        self.is_open = False

    def read_all(self) -> list[T]:
        items = []
        while self.is_open:
            items.append(self.read())
        return items


class Sink(abc.ABC, Generic[T]):
    is_flushed: bool = True
    write_count: int = 0

    @abc.abstractmethod
    def write(self, item: T) -> None: ...

    @abc.abstractmethod
    def flush(self) -> None: ...

    def close(self) -> None:
        self.flush()

    def write_all(self, items: list[T]) -> None:
        for item in items:
            self.write(item)


class BufferedSource(Source[T], abc.ABC):
    buffer_size: int = 8192
    _buffer: list[T]
    fill_count: int = 0

    def __init__(self, buffer_size: int = 8192) -> None:
        self._buffer = []
        self.buffer_size = buffer_size

    @abc.abstractmethod
    def fill_buffer(self) -> None: ...

    def read(self) -> T:
        if not self._buffer:
            self.fill_buffer()
            self.fill_count += 1
        return self._buffer.pop(0)


class BufferedSink(Sink[T], abc.ABC):
    buffer_size: int = 8192
    _pending: list[T]
    flush_count: int = 0

    def __init__(self, buffer_size: int = 8192) -> None:
        self._pending = []
        self.buffer_size = buffer_size

    def write(self, item: T) -> None:
        self._pending.append(item)
        if len(self._pending) >= self.buffer_size:
            self.flush()


# Diamond: BufferedSource and BufferedSink both carry buffer_size from Source/Sink;
# Duplex inherits both branches and redefines buffer_size once.

class Duplex(BufferedSource[T], BufferedSink[T], abc.ABC):
    buffer_size: int = 4096   # redefined in diamond child

    @abc.abstractmethod
    def open(self) -> None: ...

    @abc.abstractmethod
    def fill_buffer(self) -> None: ...

    @abc.abstractmethod
    def flush(self) -> None: ...


class MemoryDuplex(Duplex[T]):
    _store: list[T]
    buffer_size: int = 256   # redefined again — small in-memory buffer

    def __init__(self) -> None:
        super().__init__(buffer_size=256)
        self._store = []

    def open(self) -> None:
        self.is_open = True

    def fill_buffer(self) -> None:
        chunk = self._store[:self.buffer_size]
        self._buffer.extend(chunk)

    def flush(self) -> None:
        self._store.extend(self._pending)
        self._pending.clear()
        self.is_flushed = True
        self.flush_count += 1


class FileDuplex(Duplex[bytes]):
    path: str
    mode: str = "rb+"
    encoding: str = "utf-8"
    buffer_size: int = 65536  # redefined — large buffer for file I/O

    def open(self) -> None:
        self.is_open = True

    def fill_buffer(self) -> None: ...

    def flush(self) -> None:
        self.is_flushed = True
