from base import SmartStore, PersistentStore, CacheStore
from typing import Optional, Any, Callable
from datetime import datetime


class TypedSmartStore(SmartStore):
    value_type: type
    coerce: bool
    schema: Optional[dict[str, type]]

    def __init__(
        self,
        namespace: str,
        value_type: type = str,
        coerce: bool = False,
        schema: Optional[dict[str, type]] = None,
        write_through: bool = True,
    ) -> None:
        super().__init__(namespace, write_through)
        self.value_type = value_type
        self.coerce = coerce
        self.schema = schema

    def put(self, key: str, value: Any) -> None:
        if self.coerce:
            value = self.value_type(value)
        elif not isinstance(value, self.value_type):
            raise TypeError(f"Expected {self.value_type.__name__}, got {type(value).__name__}")
        super().put(key, value)

    def get_typed(self, key: str) -> Optional[Any]:
        value = self.get(key)
        if value is not None and not isinstance(value, self.value_type):
            raise TypeError(f"Stored value is not of type {self.value_type.__name__}")
        return value


class VersionedPersistentStore(PersistentStore):
    version_history: dict[str, list[tuple[datetime, Any]]]
    max_history_per_key: int

    def __init__(
        self,
        max_history_per_key: int = 10,
        persistence_priority: int = 5,
    ) -> None:
        super().__init__(persistence_priority=persistence_priority)
        self.version_history = {}
        self.max_history_per_key = max_history_per_key

    def put_versioned(self, field: str, value: Any) -> None:
        history = self.version_history.setdefault(field, [])
        history.append((datetime.utcnow(), value))
        if len(history) > self.max_history_per_key:
            history.pop(0)
        self.mark_dirty(field)

    def get_history(self, field: str) -> list[tuple[datetime, Any]]:
        return list(self.version_history.get(field, []))

    def rollback(self, field: str) -> Optional[Any]:
        history = self.version_history.get(field, [])
        if len(history) < 2:
            return None
        history.pop()
        return history[-1][1] if history else None


class ObservableCacheStore(CacheStore):
    _watchers: dict[str, list[Callable[[str, Any], None]]]

    def __init__(self, cache_ttl_seconds: float = 300.0) -> None:
        super().__init__(cache_ttl_seconds=cache_ttl_seconds)
        self._watchers = {}

    def watch(self, key: str, callback: Callable[[str, Any], None]) -> None:
        self._watchers.setdefault(key, []).append(callback)

    def unwatch(self, key: str, callback: Callable[[str, Any], None]) -> None:
        if key in self._watchers:
            self._watchers[key] = [cb for cb in self._watchers[key] if cb != callback]

    def set_cached(self, key: str, value: Any) -> None:
        super().set_cached(key, value)
        for cb in self._watchers.get(key, []):
            cb(key, value)

    def watcher_count(self, key: str) -> int:
        return len(self._watchers.get(key, []))
