import math
from typing import Optional


class Point:
    x: float
    y: float

    def __init__(self, x: float, y: float) -> None:
        self.x = x
        self.y = y

    def distance_to(self, other: "Point") -> float:
        return math.sqrt((self.x - other.x) ** 2 + (self.y - other.y) ** 2)

    def midpoint(self, other: "Point") -> "Point":
        return Point((self.x + other.x) / 2, (self.y + other.y) / 2)

    def translate(self, dx: float, dy: float) -> "Point":
        return Point(self.x + dx, self.y + dy)

    def __repr__(self) -> str:
        return f"Point({self.x}, {self.y})"


class Rectangle:
    top_left: Point
    width: float
    height: float
    label: Optional[str]

    def __init__(
        self,
        top_left: Point,
        width: float,
        height: float,
        label: Optional[str] = None,
    ) -> None:
        self.top_left = top_left
        self.width = width
        self.height = height
        self.label = label

    def area(self) -> float:
        return self.width * self.height

    def perimeter(self) -> float:
        return 2 * (self.width + self.height)

    def center(self) -> Point:
        return Point(
            self.top_left.x + self.width / 2,
            self.top_left.y + self.height / 2,
        )

    def contains(self, point: Point) -> bool:
        return (
            self.top_left.x <= point.x <= self.top_left.x + self.width
            and self.top_left.y <= point.y <= self.top_left.y + self.height
        )

    def intersects(self, other: "Rectangle") -> bool:
        return not (
            other.top_left.x > self.top_left.x + self.width
            or other.top_left.x + other.width < self.top_left.x
            or other.top_left.y > self.top_left.y + self.height
            or other.top_left.y + other.height < self.top_left.y
        )


class Circle:
    center: Point
    radius: float

    def __init__(self, center: Point, radius: float) -> None:
        self.center = center
        self.radius = radius

    def area(self) -> float:
        return math.pi * self.radius**2

    def circumference(self) -> float:
        return 2 * math.pi * self.radius

    def contains(self, point: Point) -> bool:
        return self.center.distance_to(point) <= self.radius

    def bounding_box(self) -> Rectangle:
        top_left = Point(self.center.x - self.radius, self.center.y - self.radius)
        return Rectangle(top_left, self.radius * 2, self.radius * 2)
