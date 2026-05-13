"""
Isolated: ABC and @abstractmethod.
Tests: fully abstract, partially abstract (intermediate), and concrete classes.
Also shows abstract classmethods and mixed concrete+abstract interfaces.
"""
from __future__ import annotations
import abc
from typing import Any, Iterator


class Repository(abc.ABC):
    entity_type: str

    @abc.abstractmethod
    def find_by_id(self, entity_id: str) -> Any | None: ...

    @abc.abstractmethod
    def find_all(self) -> list[Any]: ...

    @abc.abstractmethod
    def save(self, entity: Any) -> None: ...

    @abc.abstractmethod
    def delete(self, entity_id: str) -> bool: ...

    @abc.abstractmethod
    def count(self) -> int: ...

    def exists(self, entity_id: str) -> bool:
        return self.find_by_id(entity_id) is not None


class FilterableRepository(Repository, abc.ABC):
    @abc.abstractmethod
    def find_where(self, **filters: Any) -> list[Any]: ...

    @abc.abstractmethod
    def count_where(self, **filters: Any) -> int: ...

    def exists_where(self, **filters: Any) -> bool:
        return self.count_where(**filters) > 0


class PaginatedRepository(FilterableRepository, abc.ABC):
    default_page_size: int = 20

    @abc.abstractmethod
    def find_page(
        self,
        page: int,
        page_size: int,
        **filters: Any,
    ) -> list[Any]: ...

    @abc.abstractmethod
    def total_pages(self, page_size: int, **filters: Any) -> int: ...

    @classmethod
    @abc.abstractmethod
    def for_entity_type(cls, entity_type: str) -> "PaginatedRepository": ...


class InMemoryRepository(PaginatedRepository):
    entity_type: str = "generic"
    default_page_size: int = 10

    _store: dict[str, Any]

    def __init__(self) -> None:
        self._store = {}

    def find_by_id(self, entity_id: str) -> Any | None:
        return self._store.get(entity_id)

    def find_all(self) -> list[Any]:
        return list(self._store.values())

    def save(self, entity: Any) -> None:
        self._store[str(id(entity))] = entity

    def delete(self, entity_id: str) -> bool:
        return self._store.pop(entity_id, None) is not None

    def count(self) -> int:
        return len(self._store)

    def find_where(self, **filters: Any) -> list[Any]:
        return [
            v for v in self._store.values()
            if all(getattr(v, k, None) == fv for k, fv in filters.items())
        ]

    def count_where(self, **filters: Any) -> int:
        return len(self.find_where(**filters))

    def find_page(self, page: int, page_size: int, **filters: Any) -> list[Any]:
        items = self.find_where(**filters)
        start = page * page_size
        return items[start : start + page_size]

    def total_pages(self, page_size: int, **filters: Any) -> int:
        import math
        return math.ceil(self.count_where(**filters) / page_size)

    @classmethod
    def for_entity_type(cls, entity_type: str) -> "InMemoryRepository":
        repo = cls()
        repo.entity_type = entity_type
        return repo
