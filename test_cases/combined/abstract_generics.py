"""
Combined: ABC + Generic[T].
Abstract base classes parameterized with type variables.
Tests the intersection of generic type parameters and abstract methods.
"""
from __future__ import annotations
import abc
from typing import Any, Generic, Iterator, TypeVar


T = TypeVar("T")
T_co = TypeVar("T_co", covariant=True)


class Codec(abc.ABC, Generic[T]):
    encoding: str = "utf-8"
    version: int = 1

    @abc.abstractmethod
    def encode(self, value: T) -> bytes: ...

    @abc.abstractmethod
    def decode(self, data: bytes) -> T: ...

    def round_trip(self, value: T) -> T:
        return self.decode(self.encode(value))

    @classmethod
    @abc.abstractmethod
    def mime_type(cls) -> str: ...


class StreamCodec(Codec[T], abc.ABC):
    chunk_size: int = 4096
    max_buffer: int = 65536

    @abc.abstractmethod
    def encode_stream(self, values: Iterator[T]) -> Iterator[bytes]: ...

    @abc.abstractmethod
    def decode_stream(self, chunks: Iterator[bytes]) -> Iterator[T]: ...


class JsonCodec(Codec[Any]):
    encoding: str = "utf-8"
    indent: int | None = None
    sort_keys: bool = False

    def encode(self, value: Any) -> bytes: ...
    def decode(self, data: bytes) -> Any: ...

    @classmethod
    def mime_type(cls) -> str:
        return "application/json"


class MsgpackCodec(Codec[Any]):
    use_bin_type: bool = True
    strict_map_key: bool = False

    def encode(self, value: Any) -> bytes: ...
    def decode(self, data: bytes) -> Any: ...

    @classmethod
    def mime_type(cls) -> str:
        return "application/msgpack"


class CompressedStreamCodec(StreamCodec[T]):
    compression_level: int = 6
    algorithm: str = "zlib"
    chunk_size: int = 8192   # redefined

    def encode(self, value: T) -> bytes: ...
    def decode(self, data: bytes) -> T: ...
    def encode_stream(self, values: Iterator[T]) -> Iterator[bytes]: ...
    def decode_stream(self, chunks: Iterator[bytes]) -> Iterator[T]: ...

    @classmethod
    def mime_type(cls) -> str:
        return f"application/octet-stream+{cls.algorithm}"


class Serializer(abc.ABC, Generic[T]):
    version: int = 1
    magic_bytes: bytes = b""
    strict: bool = True

    @abc.abstractmethod
    def serialize(self, obj: T) -> dict[str, Any]: ...

    @abc.abstractmethod
    def deserialize(self, data: dict[str, Any]) -> T: ...

    @classmethod
    @abc.abstractmethod
    def supported_versions(cls) -> list[int]: ...

    def serialize_list(self, objs: list[T]) -> list[dict[str, Any]]:
        return [self.serialize(o) for o in objs]

    def deserialize_list(self, items: list[dict[str, Any]]) -> list[T]:
        return [self.deserialize(d) for d in items]


class VersionedSerializer(Serializer[T], abc.ABC):
    current_version: int = 1
    migrations: dict[int, Any]

    @abc.abstractmethod
    def migrate(self, data: dict[str, Any], from_version: int) -> dict[str, Any]: ...

    def deserialize(self, data: dict[str, Any]) -> T:
        v = data.get("_version", 1)
        if v != self.current_version:
            data = self.migrate(data, v)
        return self._deserialize_current(data)

    @abc.abstractmethod
    def _deserialize_current(self, data: dict[str, Any]) -> T: ...
