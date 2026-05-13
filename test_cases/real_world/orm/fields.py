"""
Real-world ORM (1/3): field descriptors using Generic[T].
Combines: Generic[T], @classmethod, @staticmethod, TypeVar.
"""
from __future__ import annotations
from typing import Any, Callable, Generic, TypeVar


T = TypeVar("T")


class Field(Generic[T]):
    name: str
    default: T | None
    required: bool
    nullable: bool
    validators: list[Callable[[T], bool]]

    column_name: str = ""
    db_type: str = ""
    index: bool = False
    unique: bool = False
    primary_key: bool = False

    def __init__(
        self,
        default: T | None = None,
        required: bool = True,
        nullable: bool = False,
        column_name: str = "",
        index: bool = False,
        unique: bool = False,
        validators: list[Callable[[T], bool]] | None = None,
    ) -> None:
        self.default = default
        self.required = required
        self.nullable = nullable
        self.column_name = column_name
        self.index = index
        self.unique = unique
        self.validators = validators or []
        self.name = ""

    def validate(self, value: T) -> bool:
        return all(v(value) for v in self.validators)

    @staticmethod
    def coerce(value: Any, target_type: type) -> Any:
        if value is None or isinstance(value, target_type):
            return value
        return target_type(value)

    @classmethod
    def required_field(cls, **kwargs: Any) -> "Field[T]":
        return cls(required=True, nullable=False, **kwargs)

    @classmethod
    def optional_field(cls, default: T | None = None, **kwargs: Any) -> "Field[T]":
        return cls(required=False, nullable=True, default=default, **kwargs)


class IntField(Field[int]):
    min_value: int | None = None
    max_value: int | None = None
    db_type: str = "INTEGER"
    auto_increment: bool = False
    unsigned: bool = False

    def __init__(
        self,
        default: int | None = None,
        required: bool = True,
        nullable: bool = False,
        min_value: int | None = None,
        max_value: int | None = None,
        auto_increment: bool = False,
        unsigned: bool = False,
        **kwargs: Any,
    ) -> None:
        super().__init__(default=default, required=required, nullable=nullable, **kwargs)
        self.min_value = min_value
        self.max_value = max_value
        self.auto_increment = auto_increment
        self.unsigned = unsigned

    def validate(self, value: int) -> bool:
        if not super().validate(value):
            return False
        if self.min_value is not None and value < self.min_value:
            return False
        if self.max_value is not None and value > self.max_value:
            return False
        return True

    @classmethod
    def primary_key(cls) -> "IntField":
        return cls(
            required=False,
            nullable=False,
            auto_increment=True,
            unique=True,
            primary_key=True,
        )

    @classmethod
    def positive(cls, **kwargs: Any) -> "IntField":
        return cls(min_value=1, **kwargs)


class StringField(Field[str]):
    max_length: int | None = None
    min_length: int | None = None
    pattern: str | None = None
    choices: list[str] | None = None
    db_type: str = "VARCHAR"
    encoding: str = "utf-8"
    trim_whitespace: bool = True
    case_sensitive: bool = True

    @classmethod
    def text_field(cls, max_length: int = 65535, **kwargs: Any) -> "StringField":
        return cls(max_length=max_length, db_type="TEXT", **kwargs)

    @classmethod
    def char_field(cls, max_length: int = 255, **kwargs: Any) -> "StringField":
        return cls(max_length=max_length, db_type="VARCHAR", **kwargs)

    @classmethod
    def email_field(cls) -> "StringField":
        return cls(max_length=254, pattern=r"[^@]+@[^@]+\.[^@]+", index=True)

    @staticmethod
    def validate_pattern(value: str, pattern: str) -> bool:
        import re
        return bool(re.fullmatch(pattern, value))


class ForeignKeyField(Field[int]):
    related_model: str
    related_field: str = "id"
    on_delete: str = "CASCADE"
    on_update: str = "CASCADE"
    db_type: str = "INTEGER"
    lazy: bool = True
    back_ref: str = ""

    def __init__(
        self,
        related_model: str,
        related_field: str = "id",
        on_delete: str = "CASCADE",
        on_update: str = "CASCADE",
        lazy: bool = True,
        back_ref: str = "",
        **kwargs: Any,
    ) -> None:
        super().__init__(nullable=False, **kwargs)
        self.related_model = related_model
        self.related_field = related_field
        self.on_delete = on_delete
        self.on_update = on_update
        self.lazy = lazy
        self.back_ref = back_ref
