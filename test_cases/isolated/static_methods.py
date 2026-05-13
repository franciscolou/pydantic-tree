"""
Isolated: @staticmethod only.
Tests rendering of static methods across an inheritance chain.
"""
from __future__ import annotations
from typing import ClassVar
import math


class MathUtils:
    PI: ClassVar[float] = 3.141592653589793
    E: ClassVar[float] = 2.718281828459045
    TAU: ClassVar[float] = 6.283185307179586
    GOLDEN_RATIO: ClassVar[float] = 1.6180339887498949

    @staticmethod
    def clamp(value: float, lo: float, hi: float) -> float:
        return max(lo, min(hi, value))

    @staticmethod
    def lerp(a: float, b: float, t: float) -> float:
        return a + (b - a) * t

    @staticmethod
    def sign(x: float) -> int:
        return 0 if x == 0 else (1 if x > 0 else -1)

    @staticmethod
    def nearly_equal(a: float, b: float, epsilon: float = 1e-9) -> bool:
        return abs(a - b) < epsilon

    @staticmethod
    def safe_div(numerator: float, denominator: float, fallback: float = 0.0) -> float:
        return numerator / denominator if denominator != 0 else fallback


class TrigUtils(MathUtils):
    @staticmethod
    def degrees_to_radians(deg: float) -> float:
        return deg * math.pi / 180.0

    @staticmethod
    def radians_to_degrees(rad: float) -> float:
        return rad * 180.0 / math.pi

    @staticmethod
    def normalize_angle_deg(deg: float) -> float:
        return deg % 360.0

    @staticmethod
    def normalize_angle_rad(rad: float) -> float:
        return rad % (2 * math.pi)


class StringUtils:
    WHITESPACE: ClassVar[str] = " \t\n\r\f\v"
    MAX_SLUG_LENGTH: ClassVar[int] = 128
    ELLIPSIS: ClassVar[str] = "…"

    @staticmethod
    def slugify(text: str, separator: str = "-") -> str:
        return text.lower().replace(" ", separator)

    @staticmethod
    def truncate(text: str, max_length: int, suffix: str = "...") -> str:
        if len(text) <= max_length:
            return text
        return text[: max_length - len(suffix)] + suffix

    @staticmethod
    def to_camel_case(snake_str: str) -> str:
        parts = snake_str.split("_")
        return parts[0] + "".join(p.title() for p in parts[1:])

    @staticmethod
    def to_snake_case(camel_str: str) -> str:
        import re
        return re.sub(r"(?<!^)(?=[A-Z])", "_", camel_str).lower()

    @staticmethod
    def pad_center(text: str, width: int, fill: str = " ") -> str:
        return text.center(width, fill)

    @staticmethod
    def count_words(text: str) -> int:
        return len(text.split())


class EnhancedStringUtils(StringUtils):
    @staticmethod
    def wrap_lines(text: str, max_width: int) -> list[str]:
        import textwrap
        return textwrap.wrap(text, max_width)

    @staticmethod
    def strip_html(text: str) -> str:
        import re
        return re.sub(r"<[^>]+>", "", text)

    @staticmethod
    def extract_emails(text: str) -> list[str]:
        import re
        return re.findall(r"[\w.+-]+@[\w-]+\.[a-zA-Z]{2,}", text)
