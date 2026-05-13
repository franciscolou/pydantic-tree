"""
Isolated: class declarations spanning multiple lines due to many base classes.
Tests the parser's collectClassDeclLines() bracket-depth tracking.
"""
from __future__ import annotations
from typing import Any


class Printable:
    def __str__(self) -> str: ...


class Representable:
    def __repr__(self) -> str: ...


class Comparable:
    def __eq__(self, other: object) -> bool: ...
    def __lt__(self, other: Any) -> bool: ...
    def __le__(self, other: Any) -> bool: ...


class Hashable:
    def __hash__(self) -> int: ...


class Iterable:
    def __iter__(self) -> Any: ...
    def __len__(self) -> int: ...
    def __contains__(self, item: Any) -> bool: ...


class Copyable:
    def copy(self) -> "Copyable": ...
    def deep_copy(self) -> "Copyable": ...


class Freezable:
    is_frozen: bool = False

    def freeze(self) -> None: ...
    def unfreeze(self) -> None: ...
    def is_mutable(self) -> bool: ...


class Mergeable:
    def merge(self, other: "Mergeable") -> "Mergeable": ...
    def merge_into(self, other: "Mergeable") -> None: ...


class Diffable:
    def diff(self, other: "Diffable") -> dict[str, Any]: ...
    def has_changes(self, other: "Diffable") -> bool: ...


class Patchable:
    def patch(self, changes: dict[str, Any]) -> None: ...
    def rollback(self, changes: dict[str, Any]) -> None: ...


# ── Two bases ─────────────────────────────────────────────────────────────────

class SimpleRecord(
    Printable,
    Representable,
):
    id: str
    name: str


# ── Four bases ────────────────────────────────────────────────────────────────

class RichRecord(
    Printable,
    Representable,
    Comparable,
    Hashable,
):
    id: str
    name: str
    score: float


# ── Seven bases ───────────────────────────────────────────────────────────────

class VersionedRecord(
    Printable,
    Representable,
    Comparable,
    Hashable,
    Copyable,
    Freezable,
    Diffable,
):
    id: str
    name: str
    version: int = 1
    score: float
    tags: list[str]


# ── Ten bases ─────────────────────────────────────────────────────────────────

class FullRecord(
    Printable,
    Representable,
    Comparable,
    Hashable,
    Iterable,
    Copyable,
    Freezable,
    Mergeable,
    Diffable,
    Patchable,
):
    id: str
    name: str
    description: str
    score: float
    version: int = 1
    tags: list[str]
    metadata: dict[str, Any]
    is_active: bool = True
    created_at: str
    updated_at: str
