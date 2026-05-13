"""
Isolated: Enum classes.
Tests rendering of EnumMember symbols — both unannotated (name = value)
and annotated (name: type = value) variants.
"""
from enum import Enum, IntEnum, Flag, auto
from typing import ClassVar


# ── Unannotated string enum ───────────────────────────────────────────────────

class Status(str, Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    PROCESSING = "processing"
    SHIPPED = "shipped"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"
    REFUNDED = "refunded"


# ── Unannotated int enum ──────────────────────────────────────────────────────

class Priority(IntEnum):
    CRITICAL = 0
    HIGH = 1
    NORMAL = 2
    LOW = 3
    BACKGROUND = 4


# ── auto() values ─────────────────────────────────────────────────────────────

class Direction(Enum):
    NORTH = auto()
    SOUTH = auto()
    EAST = auto()
    WEST = auto()


# ── Flag enum (bitmask) ───────────────────────────────────────────────────────

class Permission(Flag):
    READ = auto()
    WRITE = auto()
    EXECUTE = auto()
    DELETE = auto()
    ADMIN = READ | WRITE | EXECUTE | DELETE


# ── Annotated enum members (typed) ───────────────────────────────────────────

class Color(Enum):
    RED: int = 1
    GREEN: int = 2
    BLUE: int = 3
    ALPHA: int = 255


# ── Enum with ClassVar attributes and methods ─────────────────────────────────

class HttpMethod(str, Enum):
    GET = "GET"
    POST = "POST"
    PUT = "PUT"
    PATCH = "PATCH"
    DELETE = "DELETE"
    HEAD = "HEAD"
    OPTIONS = "OPTIONS"

    _safe_methods: ClassVar[frozenset[str]] = frozenset({"GET", "HEAD", "OPTIONS"})

    @property
    def is_safe(self) -> bool:
        return self.value in self._safe_methods

    @property
    def is_idempotent(self) -> bool:
        return self.value in {"GET", "PUT", "DELETE", "HEAD", "OPTIONS"}

    def allows_body(self) -> bool:
        return self in {HttpMethod.POST, HttpMethod.PUT, HttpMethod.PATCH}


# ── Inheritance: extending an enum ────────────────────────────────────────────

class ExtendedStatus(Status):
    ARCHIVED = "archived"
    DRAFT = "draft"
