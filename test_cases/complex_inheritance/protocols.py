"""
Tier 0 — four unrelated root protocols.
"""
from abc import ABC, abstractmethod


class Base(ABC):
    @abstractmethod
    def get_id(self) -> str: ...


class Serializable(ABC):
    @abstractmethod
    def serialize(self) -> bytes: ...


class Comparable(ABC):
    @abstractmethod
    def compare_to(self, other: object) -> int: ...


class Drawable(ABC):
    @abstractmethod
    def draw(self, target: object) -> None: ...
