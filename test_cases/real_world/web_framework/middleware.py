"""
Real-world web framework (2/3): middleware stack.
Combines: ABC, mixin stack, @staticmethod, multi-line sigs.
"""
from __future__ import annotations
import abc
from typing import Any, Callable, Literal


Handler = Callable[["MiddlewareRequest"], "MiddlewareResponse"]


class MiddlewareRequest:
    path: str
    method: str
    headers: dict[str, str]
    body: bytes
    state: dict[str, Any]
    client_ip: str = ""


class MiddlewareResponse:
    status: int = 200
    headers: dict[str, str]
    body: bytes


class Middleware(abc.ABC):
    priority: int = 0
    is_enabled: bool = True
    name: str = ""

    @abc.abstractmethod
    def process(
        self,
        request: MiddlewareRequest,
        next_handler: Handler,
    ) -> MiddlewareResponse: ...

    @staticmethod
    def add_header(
        response: MiddlewareResponse,
        name: str,
        value: str,
        override: bool = True,
    ) -> MiddlewareResponse:
        if override or name not in response.headers:
            response.headers[name] = value
        return response


class LoggingMiddleware(Middleware):
    log_request_body: bool = False
    log_response_body: bool = False
    log_level: str = "INFO"
    max_body_log_size: int = 1024
    exclude_paths: list[str] = ["/health", "/metrics"]

    def process(
        self,
        request: MiddlewareRequest,
        next_handler: Handler,
    ) -> MiddlewareResponse: ...


class CorsMiddleware(Middleware):
    allow_origins: list[str] = ["*"]
    allow_methods: list[str] = [
        "GET",
        "POST",
        "PUT",
        "PATCH",
        "DELETE",
        "OPTIONS",
    ]
    allow_headers: list[str] = [
        "Content-Type",
        "Authorization",
        "X-Requested-With",
        "X-Api-Key",
    ]
    expose_headers: list[str] = []
    allow_credentials: bool = False
    max_age: int = 86400

    @staticmethod
    def is_simple_method(method: str) -> bool:
        return method.upper() in {"GET", "HEAD", "POST"}

    @staticmethod
    def origin_matches(origin: str, allowed: list[str]) -> bool:
        return "*" in allowed or origin in allowed

    def process(
        self,
        request: MiddlewareRequest,
        next_handler: Handler,
    ) -> MiddlewareResponse: ...


class SecurityMiddleware(Middleware):
    hsts_max_age: int = 31536000
    hsts_include_subdomains: bool = True
    hsts_preload: bool = False
    csp_policy: str = "default-src 'self'"
    x_frame_options: Literal["DENY", "SAMEORIGIN"] = "DENY"
    x_content_type_nosniff: bool = True
    referrer_policy: str = "strict-origin-when-cross-origin"
    permissions_policy: str = ""

    def process(
        self,
        request: MiddlewareRequest,
        next_handler: Handler,
    ) -> MiddlewareResponse: ...


class CompressionMiddleware(Middleware):
    min_size_bytes: int = 1024
    algorithms: list[str] = ["br", "gzip", "deflate"]
    compression_level: int = 6
    exclude_content_types: list[str] = [
        "image/jpeg",
        "image/png",
        "image/gif",
        "image/webp",
    ]

    @staticmethod
    def negotiate_algorithm(
        accept_encoding: str,
        available: list[str],
    ) -> str | None:
        for algo in available:
            if algo in accept_encoding:
                return algo
        return None

    @staticmethod
    def compress_body(
        body: bytes,
        algorithm: str,
        level: int = 6,
    ) -> bytes:
        if algorithm == "gzip":
            import gzip
            return gzip.compress(body, compresslevel=level)
        return body

    def process(
        self,
        request: MiddlewareRequest,
        next_handler: Handler,
    ) -> MiddlewareResponse: ...


class TracingMiddleware(Middleware):
    service_name: str = "unknown"
    sample_rate: float = 1.0
    propagation_format: Literal["w3c", "b3", "jaeger"] = "w3c"
    tags: dict[str, str] = {}

    @staticmethod
    def extract_trace_id(
        headers: dict[str, str],
        format: Literal["w3c", "b3", "jaeger"] = "w3c",
    ) -> str | None:
        if format == "w3c":
            traceparent = headers.get("traceparent", "")
            parts = traceparent.split("-")
            return parts[1] if len(parts) >= 2 else None
        if format == "b3":
            return headers.get("X-B3-TraceId")
        return None

    def process(
        self,
        request: MiddlewareRequest,
        next_handler: Handler,
    ) -> MiddlewareResponse: ...
