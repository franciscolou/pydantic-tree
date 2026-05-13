"""
Combined: mixin pattern + @staticmethod + @abstractmethod.
Tests a layered mixin stack where each level adds static helpers and
abstract requirements, converging into a concrete leaf.
"""
from __future__ import annotations
import abc
from typing import Any, ClassVar


class IdMixin:
    _counter: ClassVar[int] = 0

    id: int

    @classmethod
    def next_id(cls) -> int:
        cls._counter += 1
        return cls._counter

    @staticmethod
    def format_id(raw_id: int, prefix: str = "") -> str:
        return f"{prefix}{raw_id:08d}"

    @staticmethod
    def parse_id(formatted: str, prefix: str = "") -> int:
        return int(formatted.removeprefix(prefix))


class TimestampMixin:
    created_at: str
    updated_at: str

    @staticmethod
    def now_iso() -> str:
        from datetime import datetime, timezone
        return datetime.now(timezone.utc).isoformat()

    @staticmethod
    def parse_iso(ts: str) -> Any:
        from datetime import datetime
        return datetime.fromisoformat(ts)

    def touch(self) -> None:
        self.updated_at = self.now_iso()


class SoftDeleteMixin:
    is_deleted: bool = False
    deleted_at: str | None = None

    @staticmethod
    def current_time() -> str:
        from datetime import datetime, timezone
        return datetime.now(timezone.utc).isoformat()

    def soft_delete(self) -> None:
        self.is_deleted = True
        self.deleted_at = self.current_time()

    def restore(self) -> None:
        self.is_deleted = False
        self.deleted_at = None


class BaseEntity(IdMixin, TimestampMixin, SoftDeleteMixin, abc.ABC):
    @abc.abstractmethod
    def validate(self) -> bool: ...

    @abc.abstractmethod
    def to_dict(self) -> dict[str, Any]: ...

    @classmethod
    @abc.abstractmethod
    def from_dict(cls, data: dict[str, Any]) -> "BaseEntity": ...

    @staticmethod
    def merge_dicts(*dicts: dict[str, Any]) -> dict[str, Any]:
        result: dict[str, Any] = {}
        for d in dicts:
            result.update(d)
        return result


class NamedEntity(BaseEntity, abc.ABC):
    name: str
    slug: str

    @staticmethod
    def slugify(name: str) -> str:
        return name.lower().replace(" ", "-")

    @staticmethod
    def validate_slug(slug: str) -> bool:
        import re
        return bool(re.fullmatch(r"[a-z0-9-]+", slug))

    @abc.abstractmethod
    def display_name(self) -> str: ...

    def validate(self) -> bool:
        return bool(self.name and self.slug and self.validate_slug(self.slug))


class ConcreteEntity(NamedEntity):
    description: str = ""
    tags: list[str]
    rank: int = 0

    def display_name(self) -> str:
        return self.name.title()

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "slug": self.slug,
            "description": self.description,
            "tags": self.tags,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "ConcreteEntity":
        obj = cls.__new__(cls)
        for k, v in data.items():
            setattr(obj, k, v)
        return obj
