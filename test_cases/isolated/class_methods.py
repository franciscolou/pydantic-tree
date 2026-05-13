"""
Isolated: @classmethod only.
Tests classmethods as constructors, registries, and factory patterns.
"""
from __future__ import annotations
from typing import Any, ClassVar
from datetime import datetime
import json


class Config:
    _defaults: ClassVar[dict[str, Any]] = {
        "debug": False,
        "log_level": "INFO",
        "timeout": 30,
        "max_retries": 3,
    }
    _overrides: ClassVar[dict[str, Any]] = {}

    debug: bool
    log_level: str
    timeout: int
    max_retries: int

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "Config":
        obj = cls.__new__(cls)
        merged = {**cls._defaults, **data}
        for k, v in merged.items():
            setattr(obj, k, v)
        return obj

    @classmethod
    def from_json(cls, path: str) -> "Config":
        with open(path) as fh:
            return cls.from_dict(json.load(fh))

    @classmethod
    def from_env(cls) -> "Config":
        import os
        return cls.from_dict({k.lower(): v for k, v in os.environ.items()})

    @classmethod
    def defaults(cls) -> "Config":
        return cls.from_dict({})

    @classmethod
    def set_override(cls, key: str, value: Any) -> None:
        cls._overrides[key] = value

    @staticmethod
    def validate_log_level(level: str) -> bool:
        return level in {"DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"}


class AppConfig(Config):
    _defaults: ClassVar[dict[str, Any]] = {
        **Config._defaults,
        "host": "localhost",
        "port": 8080,
        "workers": 4,
    }

    host: str
    port: int
    workers: int

    @classmethod
    def for_production(cls) -> "AppConfig":
        return cls.from_dict({"debug": False, "workers": 16, "host": "0.0.0.0"})

    @classmethod
    def for_development(cls) -> "AppConfig":
        return cls.from_dict({"debug": True, "workers": 1, "host": "127.0.0.1"})

    @classmethod
    def for_testing(cls) -> "AppConfig":
        return cls.from_dict({"debug": True, "workers": 1, "host": "127.0.0.1", "port": 0})

    @staticmethod
    def validate_port(port: int) -> bool:
        return 1 <= port <= 65535


class WorkerConfig(AppConfig):
    _defaults: ClassVar[dict[str, Any]] = {
        **AppConfig._defaults,
        "queue": "default",
        "concurrency": 2,
        "retry_limit": 3,
        "visibility_timeout": 30,
    }

    queue: str
    concurrency: int
    retry_limit: int
    visibility_timeout: int

    @classmethod
    def for_heavy_jobs(cls) -> "WorkerConfig":
        return cls.from_dict({"concurrency": 1, "queue": "heavy", "retry_limit": 1})

    @classmethod
    def for_light_jobs(cls) -> "WorkerConfig":
        return cls.from_dict({"concurrency": 8, "queue": "light", "retry_limit": 5})

    @classmethod
    def for_cron(cls) -> "WorkerConfig":
        return cls.from_dict({"concurrency": 1, "queue": "cron", "retry_limit": 0})
