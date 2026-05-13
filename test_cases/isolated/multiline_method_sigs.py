"""
Isolated: methods with many parameters, testing signature-wrapping rendering.
"""
from __future__ import annotations
from typing import Any, Callable, Literal
from datetime import datetime


class QueryBuilder:
    table: str
    schema: str = "public"
    _parts: list[str]

    def select(
        self,
        *columns: str,
        distinct: bool = False,
        alias: dict[str, str] | None = None,
        cast: dict[str, str] | None = None,
    ) -> "QueryBuilder": ...

    def where(
        self,
        condition: str,
        *params: Any,
        negate: bool = False,
        case_sensitive: bool = True,
        or_group: str | None = None,
    ) -> "QueryBuilder": ...

    def join(
        self,
        table: str,
        on: str,
        join_type: Literal["INNER", "LEFT", "RIGHT", "FULL OUTER"] = "INNER",
        alias: str | None = None,
        lateral: bool = False,
    ) -> "QueryBuilder": ...

    def order_by(
        self,
        *columns: str,
        ascending: bool = True,
        nulls_first: bool = False,
        collation: str | None = None,
    ) -> "QueryBuilder": ...

    def paginate(
        self,
        page: int = 1,
        page_size: int = 20,
        max_page_size: int = 200,
        cursor: str | None = None,
    ) -> "QueryBuilder": ...

    def build(self) -> tuple[str, list[Any]]: ...


class AggregateQueryBuilder(QueryBuilder):
    def group_by(
        self,
        *columns: str,
        rollup: bool = False,
        cube: bool = False,
        grouping_sets: list[list[str]] | None = None,
    ) -> "AggregateQueryBuilder": ...

    def having(
        self,
        condition: str,
        *params: Any,
        negate: bool = False,
        conjunction: Literal["AND", "OR"] = "AND",
    ) -> "AggregateQueryBuilder": ...

    def window(
        self,
        function: str,
        partition_by: list[str],
        order_by: list[str],
        frame: str | None = None,
        alias: str = "w",
        exclude: Literal["NO OTHERS", "CURRENT ROW", "TIES", "GROUP"] | None = None,
    ) -> "AggregateQueryBuilder": ...


class ReportQueryBuilder(AggregateQueryBuilder):
    default_timezone: str = "UTC"

    def date_range(
        self,
        start: datetime,
        end: datetime,
        column: str = "created_at",
        inclusive: bool = True,
        timezone: str = "UTC",
        truncate_to: Literal["day", "hour", "minute"] | None = None,
    ) -> "ReportQueryBuilder": ...

    def compare_period(
        self,
        current_start: datetime,
        current_end: datetime,
        previous_start: datetime,
        previous_end: datetime,
        metrics: list[str],
        granularity: Literal["day", "week", "month", "quarter"] = "day",
        include_partial: bool = False,
        fill_missing: bool = True,
    ) -> "ReportQueryBuilder": ...

    def export(
        self,
        format: Literal["csv", "json", "parquet", "xlsx"] = "csv",
        path: str | None = None,
        chunk_size: int = 10_000,
        compression: Literal["none", "gzip", "zstd"] = "none",
    ) -> Any: ...
