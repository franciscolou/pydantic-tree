from datetime import datetime
from typing import Optional, Any, Callable
import json


class SerializableMixin:
    def to_dict(self) -> dict[str, Any]:
        return {k: v for k, v in self.__dict__.items() if not k.startswith("_")}

    def to_json(self, indent: Optional[int] = None) -> str:
        return json.dumps(self.to_dict(), default=str, indent=indent)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "SerializableMixin":
        obj = cls.__new__(cls)
        obj.__dict__.update(data)
        return obj

    def clone(self) -> "SerializableMixin":
        return self.__class__.from_dict(self.to_dict())


class AuditMixin:
    created_at: datetime
    updated_at: datetime
    created_by: Optional[str]
    updated_by: Optional[str]
    version: int

    def _init_audit(self, created_by: Optional[str] = None) -> None:
        now = datetime.utcnow()
        self.created_at = now
        self.updated_at = now
        self.created_by = created_by
        self.updated_by = created_by
        self.version = 1

    def mark_updated(self, updated_by: Optional[str] = None) -> None:
        self.updated_at = datetime.utcnow()
        self.updated_by = updated_by
        self.version += 1

    def age_seconds(self) -> float:
        return (datetime.utcnow() - self.created_at).total_seconds()


class ValidatableMixin:
    _errors: list[str]

    def _init_validation(self) -> None:
        self._errors = []

    def validate(self) -> bool:
        self._errors = []
        self._run_validations()
        return len(self._errors) == 0

    def _run_validations(self) -> None:
        pass

    def errors(self) -> list[str]:
        return list(self._errors)

    def _add_error(self, message: str) -> None:
        self._errors.append(message)

    def is_valid(self) -> bool:
        return self.validate()


class ObservableMixin:
    _listeners: dict[str, list[Callable[..., None]]]

    def _init_observable(self) -> None:
        self._listeners = {}

    def on(self, event: str, callback: Callable[..., None]) -> None:
        self._listeners.setdefault(event, []).append(callback)

    def off(self, event: str, callback: Callable[..., None]) -> None:
        if event in self._listeners:
            self._listeners[event] = [cb for cb in self._listeners[event] if cb != callback]

    def emit(self, event: str, *args: Any, **kwargs: Any) -> None:
        for cb in self._listeners.get(event, []):
            cb(*args, **kwargs)

    def listener_count(self, event: str) -> int:
        return len(self._listeners.get(event, []))
