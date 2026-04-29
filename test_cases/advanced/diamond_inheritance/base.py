from typing import Optional, Any
from datetime import datetime


class Storable:
    _storage_key: Optional[str]
    _stored_at: Optional[datetime]
    _storage_backend: str

    def __init__(self, storage_backend: str = "memory") -> None:
        self._storage_key = None
        self._stored_at = None
        self._storage_backend = storage_backend

    def assign_key(self, key: str) -> None:
        self._storage_key = key

    def mark_stored(self) -> None:
        self._stored_at = datetime.utcnow()

    def is_stored(self) -> bool:
        return self._storage_key is not None and self._stored_at is not None

    def storage_age_seconds(self) -> Optional[float]:
        if self._stored_at is None:
            return None
        return (datetime.utcnow() - self._stored_at).total_seconds()


class PersistentStore(Storable):
    _dirty_fields: set[str]
    _is_persisted: bool
    persistence_priority: int

    def __init__(self, storage_backend: str = "database", persistence_priority: int = 5) -> None:
        super().__init__(storage_backend)
        self._dirty_fields = set()
        self._is_persisted = False
        self.persistence_priority = persistence_priority

    def mark_dirty(self, field: str) -> None:
        self._dirty_fields.add(field)
        self._is_persisted = False

    def mark_clean(self) -> None:
        self._dirty_fields.clear()
        self._is_persisted = True
        self.mark_stored()

    def is_dirty(self) -> bool:
        return bool(self._dirty_fields)

    def needs_save(self) -> bool:
        return not self._is_persisted or self.is_dirty()

    def dirty_fields(self) -> frozenset[str]:
        return frozenset(self._dirty_fields)


class CacheStore(Storable):
    _cache: dict[str, Any]
    _cache_ttl_seconds: float
    _cache_hits: int
    _cache_misses: int

    def __init__(self, storage_backend: str = "redis", cache_ttl_seconds: float = 300.0) -> None:
        super().__init__(storage_backend)
        self._cache = {}
        self._cache_ttl_seconds = cache_ttl_seconds
        self._cache_hits = 0
        self._cache_misses = 0

    def get_cached(self, key: str) -> Optional[Any]:
        if key in self._cache:
            self._cache_hits += 1
            return self._cache[key]
        self._cache_misses += 1
        return None

    def set_cached(self, key: str, value: Any) -> None:
        self._cache[key] = value
        self.mark_stored()

    def invalidate(self, key: Optional[str] = None) -> None:
        if key is None:
            self._cache.clear()
        else:
            self._cache.pop(key, None)

    def hit_rate(self) -> float:
        total = self._cache_hits + self._cache_misses
        return self._cache_hits / total if total > 0 else 0.0

    def cache_size(self) -> int:
        return len(self._cache)


class SmartStore(PersistentStore, CacheStore):
    """Diamond: PersistentStore and CacheStore both inherit from Storable."""
    write_through: bool
    namespace: str

    def __init__(
        self,
        namespace: str,
        write_through: bool = True,
        cache_ttl_seconds: float = 300.0,
        persistence_priority: int = 5,
    ) -> None:
        PersistentStore.__init__(self, storage_backend="database", persistence_priority=persistence_priority)
        CacheStore.__init__(self, storage_backend="redis", cache_ttl_seconds=cache_ttl_seconds)
        self.write_through = write_through
        self.namespace = namespace

    def put(self, key: str, value: Any) -> None:
        namespaced = f"{self.namespace}:{key}"
        self.set_cached(namespaced, value)
        if self.write_through:
            self.mark_dirty(namespaced)

    def get(self, key: str) -> Optional[Any]:
        namespaced = f"{self.namespace}:{key}"
        return self.get_cached(namespaced)

    def flush(self) -> None:
        self.mark_clean()
        self.invalidate()
