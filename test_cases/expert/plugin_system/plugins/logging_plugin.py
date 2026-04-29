from plugin_base import Plugin
from hooks import BeforeHook, AfterHook
from typing import Optional, Any
from datetime import datetime
from pathlib import Path
from enum import Enum


class LogLevel(Enum):
    DEBUG = 10
    INFO = 20
    WARNING = 30
    ERROR = 40
    CRITICAL = 50


class LoggingPlugin(Plugin, BeforeHook, AfterHook):
    log_level: LogLevel
    log_file: Optional[Path]
    log_entries: list[dict[str, Any]]
    max_entries: int
    include_timestamps: bool
    format_string: str

    def __init__(
        self,
        log_level: LogLevel = LogLevel.INFO,
        log_file: Optional[Path] = None,
        max_entries: int = 10000,
        include_timestamps: bool = True,
    ) -> None:
        Plugin.__init__(
            self,
            plugin_id="logging",
            name="Logging Plugin",
            version="1.0.0",
            author="system",
            description="Logs before/after hook execution with configurable levels.",
        )
        BeforeHook.__init__(self, abort_on_failure=False)
        AfterHook.__init__(self, collect_results=True)
        self.log_level = log_level
        self.log_file = log_file
        self.log_entries = []
        self.max_entries = max_entries
        self.include_timestamps = include_timestamps
        self.format_string = "[{level}] {message}"

    def log(self, level: LogLevel, message: str, context: Optional[dict[str, Any]] = None) -> None:
        if level.value < self.log_level.value:
            return
        entry: dict[str, Any] = {
            "level": level.name,
            "message": message,
            "context": context or {},
        }
        if self.include_timestamps:
            entry["timestamp"] = datetime.utcnow().isoformat()
        if len(self.log_entries) >= self.max_entries:
            self.log_entries.pop(0)
        self.log_entries.append(entry)

    def on_load(self) -> None:
        self.log(LogLevel.INFO, f"Plugin {self.name!r} loaded.")

    def on_unload(self) -> None:
        self.log(LogLevel.INFO, f"Plugin {self.name!r} unloaded.")

    def before(self, context: dict[str, Any]) -> bool:
        self.log(LogLevel.DEBUG, "Before hook triggered.", context)
        return super().before(context)

    def after(self, context: dict[str, Any], result: Any = None) -> None:
        self.log(LogLevel.DEBUG, "After hook triggered.", context)
        super().after(context, result)

    def entries_by_level(self, level: LogLevel) -> list[dict[str, Any]]:
        return [e for e in self.log_entries if e["level"] == level.name]

    def error_count(self) -> int:
        return len(self.entries_by_level(LogLevel.ERROR)) + len(self.entries_by_level(LogLevel.CRITICAL))

    def clear_logs(self) -> None:
        self.log_entries.clear()
