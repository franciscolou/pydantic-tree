"""
Cross-file (2/3): abstract base classes; imports from protocols.py.
"""
from __future__ import annotations
import abc
from typing import Any
from protocols import Publishable, Searchable


class ContentBase(abc.ABC):
    id: str
    title: str
    slug: str
    created_at: str
    updated_at: str
    created_by: str | None = None
    updated_by: str | None = None

    @abc.abstractmethod
    def validate(self) -> bool: ...

    @abc.abstractmethod
    def to_dict(self) -> dict[str, Any]: ...

    @staticmethod
    def slugify(title: str) -> str:
        return title.lower().replace(" ", "-")

    @classmethod
    def empty(cls) -> "ContentBase": ...


class PublishableContent(ContentBase, abc.ABC):
    is_published: bool = False
    published_at: str | None = None
    author_id: str = ""
    visibility: str = "public"

    def publish(self) -> None:
        from datetime import datetime, timezone
        self.is_published = True
        self.published_at = datetime.now(timezone.utc).isoformat()

    def unpublish(self) -> None:
        self.is_published = False
        self.published_at = None

    @abc.abstractmethod
    def on_publish(self) -> None: ...

    @abc.abstractmethod
    def on_unpublish(self) -> None: ...


class IndexableContent(PublishableContent, abc.ABC):
    search_weight: float = 1.0
    indexed_at: str | None = None
    index_name: str = "default"
    boost_factor: float = 1.0

    @abc.abstractmethod
    def to_search_doc(self) -> dict[str, Any]: ...

    def on_publish(self) -> None:
        self.schedule_index()

    def on_unpublish(self) -> None:
        self.schedule_deindex()

    @abc.abstractmethod
    def schedule_index(self) -> None: ...

    @abc.abstractmethod
    def schedule_deindex(self) -> None: ...
