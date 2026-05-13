"""
Cross-file (1/3): Protocol / interface definitions.
Imported by base.py and implementations.py to test cross-file inheritance resolution.
"""
from __future__ import annotations
from typing import Any, Protocol, runtime_checkable


@runtime_checkable
class Identifiable(Protocol):
    @property
    def id(self) -> str: ...


@runtime_checkable
class Timestamped(Protocol):
    @property
    def created_at(self) -> str: ...

    @property
    def updated_at(self) -> str: ...


@runtime_checkable
class Auditable(Identifiable, Timestamped, Protocol):
    @property
    def created_by(self) -> str | None: ...

    @property
    def updated_by(self) -> str | None: ...


@runtime_checkable
class Publishable(Protocol):
    def publish(self) -> None: ...
    def unpublish(self) -> None: ...

    @property
    def is_published(self) -> bool: ...


@runtime_checkable
class Searchable(Protocol):
    def to_search_doc(self) -> dict[str, Any]: ...
    def search_weight(self) -> float: ...

    @classmethod
    def search_index(cls) -> str: ...
