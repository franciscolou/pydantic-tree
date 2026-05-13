"""
Real-world ORM (2/3): Model base with metaclass-driven field collection.
Combines: metaclass/ABCMeta, @classmethod, @abstractmethod, multi-line class decl,
attr redefinition across levels.
"""
from __future__ import annotations
import abc
from typing import Any, ClassVar
from fields import Field, IntField, StringField


class ModelMeta(abc.ABCMeta):
    """Metaclass: collects Field instances declared in the class body."""

    def __new__(
        mcs,
        name: str,
        bases: tuple[type, ...],
        namespace: dict[str, Any],
        **kwargs: Any,
    ) -> "ModelMeta":
        fields: dict[str, Field[Any]] = {}
        for base in bases:
            if hasattr(base, "_fields"):
                fields.update(base._fields)
        for key, val in namespace.items():
            if isinstance(val, Field):
                val.name = key
                if not val.column_name:
                    val.column_name = key
                fields[key] = val
        namespace["_fields"] = fields
        return super().__new__(mcs, name, bases, namespace, **kwargs)


class Model(metaclass=ModelMeta):
    _fields: ClassVar[dict[str, Field[Any]]] = {}
    _table_name: ClassVar[str] = ""
    _schema: ClassVar[str] = "public"
    _indexes: ClassVar[list[dict[str, Any]]] = []

    id: IntField = IntField.primary_key()

    @classmethod
    def table_name(cls) -> str:
        return cls._table_name or cls.__name__.lower() + "s"

    @classmethod
    def full_table_name(cls) -> str:
        return f"{cls._schema}.{cls.table_name()}"

    @classmethod
    def field_names(cls) -> list[str]:
        return list(cls._fields.keys())

    @classmethod
    def required_fields(cls) -> list[str]:
        return [n for n, f in cls._fields.items() if f.required]

    @classmethod
    def from_row(cls, row: dict[str, Any]) -> "Model":
        obj = cls.__new__(cls)
        for field_name, field in cls._fields.items():
            col = field.column_name or field_name
            setattr(obj, field_name, row.get(col, field.default))
        return obj

    def to_row(self) -> dict[str, Any]:
        return {
            (f.column_name or n): getattr(self, n, f.default)
            for n, f in self._fields.items()
        }

    def validate(self) -> bool:
        return all(
            f.validate(getattr(self, n, None))
            for n, f in self._fields.items()
            if not f.nullable
        )

    @abc.abstractmethod
    def __repr__(self) -> str: ...


class TimestampedModel(Model, abc.ABC):
    created_at: StringField = StringField.char_field(max_length=32, required=False)
    updated_at: StringField = StringField.char_field(max_length=32, required=False)

    @classmethod
    def now_iso(cls) -> str:
        from datetime import datetime, timezone
        return datetime.now(timezone.utc).isoformat()

    def touch(self) -> None:
        self.updated_at = self.now_iso()

    @abc.abstractmethod
    def __repr__(self) -> str: ...


class SoftDeleteModel(TimestampedModel, abc.ABC):
    is_deleted: bool = False
    deleted_at: StringField = StringField(required=False, nullable=True)
    deleted_by: StringField = StringField(required=False, nullable=True)

    @classmethod
    def active_filter(cls) -> dict[str, Any]:
        return {"is_deleted": False}

    def soft_delete(self, deleted_by: str | None = None) -> None:
        self.is_deleted = True
        self.deleted_at = self.now_iso()
        if deleted_by:
            self.deleted_by = deleted_by

    def restore(self) -> None:
        self.is_deleted = False
        self.deleted_at = None  # type: ignore
        self.deleted_by = None  # type: ignore

    @abc.abstractmethod
    def __repr__(self) -> str: ...
