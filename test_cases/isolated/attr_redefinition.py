"""
Isolated: attribute redefinition in child classes.
Tests: narrowing Optional → concrete type, changing defaults, removing defaults,
and redeclaring with a different annotation entirely.
"""
from typing import Any, Optional


class Shape:
    color: str = "black"
    fill: Optional[str] = None
    stroke_width: float = 1.0
    is_visible: bool = True
    opacity: float = 1.0
    z_index: int = 0
    blend_mode: str = "normal"

    def area(self) -> float: ...
    def perimeter(self) -> float: ...
    def bounding_box(self) -> tuple[float, float, float, float]: ...


class ColoredShape(Shape):
    color: str = "red"          # redefined — different default
    fill: str = "transparent"   # narrowed: Optional[str] → str
    opacity: float = 0.9        # redefined — different default
    gradient: Optional[str] = None

    def to_css(self) -> str: ...


class StyledShape(ColoredShape):
    color: str                  # redefined — no default (required)
    stroke_width: float = 2.0   # redefined — different default
    z_index: int = 10           # redefined — different default
    opacity: float = 1.0        # back to Shape's default

    shadow_blur: float = 0.0
    shadow_color: str = "rgba(0,0,0,0.3)"


class Rectangle(StyledShape):
    width: float
    height: float
    corner_radius: float = 0.0


class RoundedRect(Rectangle):
    corner_radius: float = 8.0  # redefined — different default
    fill: str = "white"         # redefined — different default
    shadow_blur: float = 4.0    # redefined — different default


# ── Separate hierarchy: permission inheritance ─────────────────────────────


class Permission:
    name: str
    code: str
    description: str = ""
    is_active: bool = True
    scope: Optional[str] = None
    requires_mfa: bool = False

    def check(self, user: Any) -> bool: ...


class ScopedPermission(Permission):
    scope: str              # narrowed: Optional[str] → str (required)
    requires_mfa: bool = True   # redefined — different default

    def check(self, user: Any) -> bool: ...


class AdminPermission(ScopedPermission):
    scope: str = "admin"    # redefined — gains default
    description: str = "Full administrative access"  # redefined
    is_active: bool = True
    audit_log: bool = True

    def check(self, user: Any) -> bool: ...
