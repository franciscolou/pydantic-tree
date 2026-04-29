from typing import Optional, Any
from datetime import datetime
import uuid


class DomainObject:
    object_id: str
    created_at: datetime
    _class_registry: dict[str, type] = {}

    def __init__(self, object_id: Optional[str] = None) -> None:
        self.object_id = object_id or str(uuid.uuid4())
        self.created_at = datetime.utcnow()

    def __init_subclass__(cls, **kwargs: Any) -> None:
        super().__init_subclass__(**kwargs)
        DomainObject._class_registry[cls.__name__] = cls

    def type_name(self) -> str:
        return self.__class__.__name__

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, DomainObject):
            return False
        return self.object_id == other.object_id

    def __hash__(self) -> int:
        return hash(self.object_id)

    def __repr__(self) -> str:
        return f"{self.type_name()}({self.object_id[:8]})"


class AggregateRoot(DomainObject):
    version: int
    uncommitted_events: list[Any]
    _snapshot_interval: int

    def __init__(self, object_id: Optional[str] = None) -> None:
        super().__init__(object_id)
        self.version = 0
        self.uncommitted_events = []
        self._snapshot_interval = 50

    def apply(self, event: Any) -> None:
        self.uncommitted_events.append(event)
        self.version += 1

    def commit(self) -> list[Any]:
        events = list(self.uncommitted_events)
        self.uncommitted_events.clear()
        return events

    def needs_snapshot(self) -> bool:
        return self.version % self._snapshot_interval == 0

    def has_uncommitted_events(self) -> bool:
        return bool(self.uncommitted_events)
