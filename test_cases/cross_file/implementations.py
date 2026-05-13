"""
Cross-file (3/3): concrete implementations; imports from base.py.
Tests the extension's ability to resolve class hierarchies spanning three files.
"""
from __future__ import annotations
from typing import Any
from base import IndexableContent, PublishableContent


class Article(IndexableContent):
    body: str = ""
    reading_time_minutes: int = 0
    tags: list[str]
    featured_image_url: str = ""
    excerpt: str = ""
    word_count: int = 0

    def validate(self) -> bool:
        return bool(self.title and self.body)

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "title": self.title,
            "body": self.body,
            "tags": self.tags,
            "excerpt": self.excerpt,
        }

    def to_search_doc(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "title": self.title,
            "body": self.body[:500],
            "tags": self.tags,
            "weight": self.search_weight,
        }

    def schedule_index(self) -> None: ...
    def schedule_deindex(self) -> None: ...

    @classmethod
    def empty(cls) -> "Article":
        obj = cls.__new__(cls)
        obj.tags = []
        return obj


class Video(PublishableContent):
    duration_seconds: int = 0
    resolution: str = "1080p"
    codec: str = "h264"
    thumbnail_url: str = ""
    transcript: str = ""
    captions_available: bool = False

    def validate(self) -> bool:
        return self.duration_seconds > 0

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "title": self.title,
            "duration": self.duration_seconds,
            "resolution": self.resolution,
        }

    def on_publish(self) -> None: ...
    def on_unpublish(self) -> None: ...

    @classmethod
    def empty(cls) -> "Video":
        return cls.__new__(cls)


class RichArticle(Article):
    """Article extended with multimedia and SEO features."""
    has_video: bool = False
    has_interactive: bool = False
    video_id: str | None = None
    interactive_components: list[str]
    seo_title: str = ""
    seo_description: str = ""
    canonical_url: str = ""
    structured_data: dict[str, Any]

    search_weight: float = 2.0       # redefined — rich content ranks higher
    index_name: str = "rich_content" # redefined
    boost_factor: float = 1.5        # redefined

    def validate(self) -> bool:
        return super().validate() and bool(self.seo_title)

    def to_search_doc(self) -> dict[str, Any]:
        doc = super().to_search_doc()
        doc["has_video"] = self.has_video
        doc["has_interactive"] = self.has_interactive
        doc["seo_title"] = self.seo_title
        return doc
