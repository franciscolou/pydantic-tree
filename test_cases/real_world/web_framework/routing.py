"""
Real-world web framework (3/3): routing system.
Combines: Generic[T], @classmethod, multiple inheritance, multi-line sigs.
"""
from __future__ import annotations
import abc
from typing import Any, Callable, Generic, TypeVar


Handler = Callable[..., Any]
T = TypeVar("T")


class Route:
    path: str
    name: str
    handler: Handler
    methods: list[str]
    middleware: list[Any]
    tags: list[str]

    def __init__(
        self,
        path: str,
        handler: Handler,
        name: str = "",
        methods: list[str] | None = None,
        middleware: list[Any] | None = None,
        tags: list[str] | None = None,
    ) -> None:
        self.path = path
        self.handler = handler
        self.name = name or handler.__name__
        self.methods = methods or ["GET"]
        self.middleware = middleware or []
        self.tags = tags or []

    @staticmethod
    def normalize_path(path: str) -> str:
        return "/" + path.strip("/")

    @staticmethod
    def extract_param_names(path: str) -> list[str]:
        import re
        return re.findall(r"\{(\w+)\}", path)


class ParameterizedRoute(Route):
    param_names: list[str]
    param_types: dict[str, type]
    converters: dict[str, Callable[[str], Any]]
    optional_params: set[str]
    regex_pattern: str = ""

    def __init__(
        self,
        path: str,
        handler: Handler,
        name: str = "",
        methods: list[str] | None = None,
        middleware: list[Any] | None = None,
        tags: list[str] | None = None,
        param_types: dict[str, type] | None = None,
        converters: dict[str, Callable[[str], Any]] | None = None,
        optional_params: set[str] | None = None,
    ) -> None:
        super().__init__(path, handler, name, methods, middleware, tags)
        self.param_types = param_types or {}
        self.converters = converters or {}
        self.optional_params = optional_params or set()
        self.param_names = self.extract_param_names(path)

    def convert_param(self, name: str, raw: str) -> Any:
        if name in self.converters:
            return self.converters[name](raw)
        if name in self.param_types:
            return self.param_types[name](raw)
        return raw

    def match(self, path: str) -> dict[str, Any] | None: ...


class Router(Generic[T]):
    prefix: str = ""
    routes: list[Route]
    name_map: dict[str, Route]
    middleware: list[Any]
    default_tags: list[str]

    def __init__(
        self,
        prefix: str = "",
        middleware: list[Any] | None = None,
        tags: list[str] | None = None,
    ) -> None:
        self.prefix = Route.normalize_path(prefix) if prefix else ""
        self.routes = []
        self.name_map = {}
        self.middleware = middleware or []
        self.default_tags = tags or []

    def add_route(
        self,
        path: str,
        handler: Handler,
        methods: list[str],
        name: str = "",
        middleware: list[Any] | None = None,
    ) -> Route: ...

    def get(self, path: str, name: str = "") -> Callable[[Handler], Handler]: ...
    def post(self, path: str, name: str = "") -> Callable[[Handler], Handler]: ...
    def put(self, path: str, name: str = "") -> Callable[[Handler], Handler]: ...
    def delete(self, path: str, name: str = "") -> Callable[[Handler], Handler]: ...

    @classmethod
    def with_prefix(cls, prefix: str) -> "Router[T]":
        return cls(prefix=prefix)

    def include(
        self,
        other: "Router[T]",
        prefix: str = "",
        middleware: list[Any] | None = None,
    ) -> None: ...

    def resolve(
        self,
        path: str,
        method: str,
    ) -> tuple[Route, dict[str, Any]] | None: ...

    def all_routes(self) -> list[Route]:
        return list(self.routes)


class VersionedRouter(Router[T], Generic[T]):
    version: str = "v1"
    deprecated_versions: list[str]
    deprecation_headers: bool = True

    def __init__(
        self,
        version: str = "v1",
        prefix: str = "",
        middleware: list[Any] | None = None,
    ) -> None:
        super().__init__(prefix=f"/api/{version}{prefix}", middleware=middleware)
        self.version = version
        self.deprecated_versions = []

    @classmethod
    def v1(cls) -> "VersionedRouter[T]":
        return cls(version="v1")

    @classmethod
    def v2(cls) -> "VersionedRouter[T]":
        return cls(version="v2")

    @classmethod
    def v3(cls) -> "VersionedRouter[T]":
        return cls(version="v3")

    def deprecate_version(self, version: str, sunset_date: str = "") -> None:
        self.deprecated_versions.append(version)

    def is_deprecated(self) -> bool:
        return self.version in self.deprecated_versions
