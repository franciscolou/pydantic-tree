from implementations import TypedSmartStore, VersionedPersistentStore, ObservableCacheStore
from typing import Optional, Any, Generic, TypeVar

T = TypeVar("T")


class Repository(TypedSmartStore):
    collection_name: str
    indices: list[str]
    read_only: bool

    def __init__(
        self,
        collection_name: str,
        value_type: type = dict,
        indices: Optional[list[str]] = None,
        read_only: bool = False,
    ) -> None:
        super().__init__(namespace=collection_name, value_type=value_type)
        self.collection_name = collection_name
        self.indices = indices or []
        self.read_only = read_only

    def save(self, entity_id: str, entity: Any) -> None:
        if self.read_only:
            raise PermissionError(f"Repository {self.collection_name!r} is read-only.")
        self.put(entity_id, entity)

    def find(self, entity_id: str) -> Optional[Any]:
        return self.get(entity_id)

    def add_index(self, field: str) -> None:
        if field not in self.indices:
            self.indices.append(field)


class AuditedRepository(Repository, VersionedPersistentStore):
    audit_trail: list[dict[str, Any]]

    def __init__(
        self,
        collection_name: str,
        value_type: type = dict,
        max_history_per_key: int = 10,
    ) -> None:
        Repository.__init__(self, collection_name, value_type)
        VersionedPersistentStore.__init__(self, max_history_per_key)
        self.audit_trail = []

    def save(self, entity_id: str, entity: Any) -> None:
        self.put_versioned(entity_id, entity)
        super().save(entity_id, entity)
        self.audit_trail.append({
            "action": "save",
            "entity_id": entity_id,
        })

    def history(self, entity_id: str) -> list[tuple[Any, Any]]:
        return self.get_history(entity_id)


class ReactiveRepository(Repository, ObservableCacheStore):
    change_hooks: list[Any]

    def __init__(
        self,
        collection_name: str,
        value_type: type = dict,
        cache_ttl_seconds: float = 300.0,
    ) -> None:
        Repository.__init__(self, collection_name, value_type)
        ObservableCacheStore.__init__(self, cache_ttl_seconds)
        self.change_hooks = []

    def save(self, entity_id: str, entity: Any) -> None:
        super().save(entity_id, entity)

    def on_change(self, entity_id: str, callback: Any) -> None:
        namespaced = f"{self.collection_name}:{entity_id}"
        self.watch(namespaced, callback)
