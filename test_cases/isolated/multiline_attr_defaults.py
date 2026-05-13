"""
Isolated: class-level attributes with multi-line default expressions.
Tests bracket-depth tracking across dicts, lists, sets, and nested structures.
"""
from typing import Any


class HttpClient:
    default_headers: dict[str, str] = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": "pytree-client/1.0",
        "X-Request-Source": "internal",
        "Cache-Control": "no-cache",
    }
    allowed_methods: list[str] = [
        "GET",
        "POST",
        "PUT",
        "PATCH",
        "DELETE",
        "HEAD",
        "OPTIONS",
    ]
    status_messages: dict[int, str] = {
        200: "OK",
        201: "Created",
        204: "No Content",
        301: "Moved Permanently",
        302: "Found",
        400: "Bad Request",
        401: "Unauthorized",
        403: "Forbidden",
        404: "Not Found",
        409: "Conflict",
        422: "Unprocessable Entity",
        429: "Too Many Requests",
        500: "Internal Server Error",
        502: "Bad Gateway",
        503: "Service Unavailable",
        504: "Gateway Timeout",
    }
    retry_on_status: set[int] = {
        429,
        500,
        502,
        503,
        504,
    }
    timeout: float = 30.0
    retries: int = 3
    base_url: str = ""

    def get(self, url: str, params: dict[str, Any] | None = None) -> Any: ...
    def post(self, url: str, body: Any) -> Any: ...
    def put(self, url: str, body: Any) -> Any: ...
    def delete(self, url: str) -> Any: ...


class AuthenticatedClient(HttpClient):
    default_headers: dict[str, str] = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Authorization": "Bearer <token>",
        "X-Api-Version": "2024-01",
        "X-Client-Id": "default",
    }
    scopes: list[str] = [
        "read:users",
        "write:users",
        "read:products",
        "write:products",
        "read:orders",
        "write:orders",
    ]
    token_refresh_endpoints: dict[str, str] = {
        "access": "/auth/token",
        "refresh": "/auth/token/refresh",
        "revoke": "/auth/token/revoke",
        "introspect": "/auth/token/introspect",
    }
    token: str = ""
    refresh_token: str = ""
    token_expiry: float = 0.0

    def refresh(self) -> None: ...
    def revoke(self) -> None: ...
    def introspect(self) -> dict[str, Any]: ...


class SchemaRegistryClient(AuthenticatedClient):
    schema_cache: dict[str, dict[str, Any]] = {}
    compatibility_levels: list[str] = [
        "NONE",
        "BACKWARD",
        "BACKWARD_TRANSITIVE",
        "FORWARD",
        "FORWARD_TRANSITIVE",
        "FULL",
        "FULL_TRANSITIVE",
    ]
    subject_name_strategies: dict[str, str] = {
        "topic": "TopicNameStrategy",
        "record": "RecordNameStrategy",
        "topic_record": "TopicRecordNameStrategy",
    }
    registry_url: str = "http://localhost:8081"
    subject_suffix: str = "-value"

    def get_schema(self, subject: str, version: str = "latest") -> dict[str, Any]: ...
    def register_schema(self, subject: str, schema: dict[str, Any]) -> int: ...
