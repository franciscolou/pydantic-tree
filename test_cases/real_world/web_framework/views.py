"""
Real-world web framework (1/3): class-based views.
Combines: abstract classes, @classmethod, multiple inheritance, multi-line class decls.
"""
from __future__ import annotations
import abc
from typing import Any, Callable, Literal


class Request:
    method: str
    path: str
    headers: dict[str, str]
    query_params: dict[str, str]
    path_params: dict[str, str]
    body: bytes
    state: dict[str, Any]


class Response:
    status_code: int = 200
    headers: dict[str, str]
    body: bytes
    content_type: str = "application/json"


class View(abc.ABC):
    http_method_names: list[str] = [
        "get",
        "post",
        "put",
        "patch",
        "delete",
        "head",
        "options",
        "trace",
    ]
    content_type: str = "application/json"
    throttle_classes: list[type] = []
    permission_classes: list[type] = []

    @classmethod
    def as_handler(cls) -> Callable[[Request], Response]:
        def handler(request: Request) -> Response:
            return cls().dispatch(request)
        return handler

    def dispatch(self, request: Request) -> Response:
        method = request.method.lower()
        handler = getattr(self, method, self.method_not_allowed)
        return handler(request)

    def method_not_allowed(self, request: Request) -> Response: ...

    @abc.abstractmethod
    def get(self, request: Request) -> Response: ...


class TemplateView(View, abc.ABC):
    template_name: str = ""
    extra_context: dict[str, Any]
    content_type: str = "text/html; charset=utf-8"

    @abc.abstractmethod
    def get_context_data(
        self,
        request: Request,
        **kwargs: Any,
    ) -> dict[str, Any]: ...

    def get(self, request: Request) -> Response: ...


class CrudView(View, abc.ABC):
    model_class: type | None = None
    pk_url_kwarg: str = "id"
    lookup_field: str = "id"

    @abc.abstractmethod
    def get_object(self, pk: str) -> Any: ...

    @abc.abstractmethod
    def get_queryset(self) -> Any: ...

    def get(self, request: Request) -> Response: ...
    def post(self, request: Request) -> Response: ...
    def put(self, request: Request) -> Response: ...
    def patch(self, request: Request) -> Response: ...
    def delete(self, request: Request) -> Response: ...


class AuthMixin:
    authentication_classes: list[type] = []
    permission_classes: list[type] = []
    allow_anonymous: bool = False

    @staticmethod
    def get_token_from_header(request: Request) -> str | None:
        auth = request.headers.get("Authorization", "")
        return auth[7:] if auth.startswith("Bearer ") else None

    @staticmethod
    def decode_basic_auth(request: Request) -> tuple[str, str] | None:
        import base64
        auth = request.headers.get("Authorization", "")
        if not auth.startswith("Basic "):
            return None
        decoded = base64.b64decode(auth[6:]).decode()
        parts = decoded.split(":", 1)
        return (parts[0], parts[1]) if len(parts) == 2 else None

    def check_permissions(self, request: Request) -> bool: ...
    def get_current_user(self, request: Request) -> Any | None: ...


class RateLimitMixin:
    rate_limit: int = 100
    rate_window_seconds: int = 60
    rate_key_prefix: str = "rl"
    rate_limit_by: Literal["ip", "user", "key"] = "ip"

    @staticmethod
    def build_rate_key(prefix: str, identifier: str, window: int) -> str:
        return f"{prefix}:{identifier}:{window}"

    def is_rate_limited(self, request: Request) -> bool: ...
    def get_rate_limit_identifier(self, request: Request) -> str: ...


class CacheMixin:
    cache_timeout: int = 60
    cache_vary_on: list[str] = ["Accept"]
    cache_private: bool = False

    @staticmethod
    def build_cache_key(path: str, params: dict[str, str]) -> str:
        qs = "&".join(f"{k}={v}" for k, v in sorted(params.items()))
        return f"view:{path}?{qs}"

    def get_cache_key(self, request: Request) -> str:
        return self.build_cache_key(request.path, request.query_params)

    def is_cacheable(self, request: Request) -> bool:
        return request.method == "GET"


class SecuredCrudView(
    AuthMixin,
    RateLimitMixin,
    CacheMixin,
    CrudView,
    abc.ABC,
):
    allow_anonymous: bool = False  # redefined
    rate_limit: int = 50           # redefined
    cache_timeout: int = 0         # redefined — secured views are not cached by default

    def dispatch(self, request: Request) -> Response:
        if not self.check_permissions(request):
            ...
        if self.is_rate_limited(request):
            ...
        return super().dispatch(request)

    @abc.abstractmethod
    def get_object(self, pk: str) -> Any: ...

    @abc.abstractmethod
    def get_queryset(self) -> Any: ...
