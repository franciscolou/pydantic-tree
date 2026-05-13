"""
Isolated: varying widths of multiple inheritance.
Tests rendering with 2, 4, 6, 8, and 10 parent classes.
Each mixin is small and focused so the breadth is the clear differentiator.
"""
from typing import Any


class LoggableMixin:
    log_level: str = "INFO"
    log_prefix: str = ""

    def log(self, message: str) -> None: ...
    def log_error(self, message: str, exc: Exception | None = None) -> None: ...


class SerializableMixin:
    def to_dict(self) -> dict[str, Any]: ...
    def to_json(self) -> str: ...
    def to_bytes(self) -> bytes: ...


class ComparableMixin:
    def __lt__(self, other: Any) -> bool: ...
    def __le__(self, other: Any) -> bool: ...
    def __gt__(self, other: Any) -> bool: ...
    def __ge__(self, other: Any) -> bool: ...


class HashableMixin:
    def __hash__(self) -> int: ...
    def __eq__(self, other: object) -> bool: ...


class CopyableMixin:
    def copy(self) -> "CopyableMixin": ...
    def deep_copy(self) -> "CopyableMixin": ...


class ValidatableMixin:
    _errors: list[str]

    def validate(self) -> bool: ...
    def errors(self) -> list[str]: ...
    def is_valid(self) -> bool: ...


class ObservableMixin:
    def subscribe(self, event: str, callback: Any) -> None: ...
    def unsubscribe(self, event: str, callback: Any) -> None: ...
    def emit(self, event: str, *args: Any) -> None: ...


class CacheableMixin:
    cache_ttl: int = 300
    cache_key_prefix: str = ""

    def cache_key(self) -> str: ...
    def invalidate_cache(self) -> None: ...


class RetryableMixin:
    max_retries: int = 3
    retry_delay: float = 0.5
    retry_backoff: float = 2.0

    def with_retry(self, fn: Any) -> Any: ...
    def should_retry(self, attempt: int, exc: Exception) -> bool: ...


class TracableMixin:
    trace_id: str
    span_id: str

    def start_trace(self, label: str) -> None: ...
    def end_trace(self) -> None: ...
    def trace(self, label: str) -> Any: ...


# ── Progressively wider inheritance ──────────────────────────────────────────


class TwoParent(LoggableMixin, SerializableMixin):
    name: str
    value: int


class FourParent(
    LoggableMixin,
    SerializableMixin,
    ComparableMixin,
    HashableMixin,
):
    id: str
    score: float
    label: str


class SixParent(
    LoggableMixin,
    SerializableMixin,
    ComparableMixin,
    HashableMixin,
    CopyableMixin,
    ValidatableMixin,
):
    id: str
    name: str
    score: float
    is_active: bool


class EightParent(
    LoggableMixin,
    SerializableMixin,
    ComparableMixin,
    HashableMixin,
    CopyableMixin,
    ValidatableMixin,
    ObservableMixin,
    CacheableMixin,
):
    id: str
    name: str
    score: float
    is_active: bool
    tags: list[str]
    metadata: dict[str, Any]


class TenParent(
    LoggableMixin,
    SerializableMixin,
    ComparableMixin,
    HashableMixin,
    CopyableMixin,
    ValidatableMixin,
    ObservableMixin,
    CacheableMixin,
    RetryableMixin,
    TracableMixin,
):
    id: str
    name: str
    description: str
    score: float
    weight: float
    is_active: bool
    tags: list[str]
    metadata: dict[str, Any]
    created_at: str
    updated_at: str
