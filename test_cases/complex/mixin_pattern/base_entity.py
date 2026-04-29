from mixins import SerializableMixin, AuditMixin, ValidatableMixin, ObservableMixin
from typing import Optional
import uuid


class BaseEntity(SerializableMixin, AuditMixin, ValidatableMixin, ObservableMixin):
    entity_id: str
    is_active: bool
    tags: list[str]
    metadata: dict[str, str]

    def __init__(
        self,
        entity_id: Optional[str] = None,
        created_by: Optional[str] = None,
    ) -> None:
        self.entity_id = entity_id or str(uuid.uuid4())
        self.is_active = True
        self.tags = []
        self.metadata = {}
        self._init_audit(created_by)
        self._init_validation()
        self._init_observable()

    def add_tag(self, tag: str) -> None:
        if tag not in self.tags:
            self.tags.append(tag)
            self.emit("tag_added", tag)

    def remove_tag(self, tag: str) -> None:
        self.tags = [t for t in self.tags if t != tag]

    def set_metadata(self, key: str, value: str) -> None:
        self.metadata[key] = value
        self.mark_updated()

    def deactivate(self, updated_by: Optional[str] = None) -> None:
        self.is_active = False
        self.mark_updated(updated_by)
        self.emit("deactivated")

    def activate(self, updated_by: Optional[str] = None) -> None:
        self.is_active = True
        self.mark_updated(updated_by)
        self.emit("activated")
