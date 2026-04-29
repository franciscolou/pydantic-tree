from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional, Callable


class Color:
    name: str
    hex_code: str
    opacity: float

    def __init__(self, name: str, hex_code: str, opacity: float = 1.0) -> None:
        self.name = name
        self.hex_code = hex_code
        self.opacity = opacity

    def to_rgba(self) -> tuple[int, int, int, float]:
        r = int(self.hex_code[1:3], 16)
        g = int(self.hex_code[3:5], 16)
        b = int(self.hex_code[5:7], 16)
        return r, g, b, self.opacity

    def darken(self, amount: float) -> "Color":
        return Color(self.name + "_dark", self.hex_code, self.opacity * (1 - amount))

    def __repr__(self) -> str:
        return f"Color({self.name!r}, {self.hex_code!r})"


class Timer:
    label: str
    duration: timedelta
    started_at: Optional[datetime]
    callback: Optional[Callable[[], None]]

    def __init__(
        self,
        label: str,
        duration: timedelta,
        callback: Optional[Callable[[], None]] = None,
    ) -> None:
        self.label = label
        self.duration = duration
        self.started_at = None
        self.callback = callback

    def start(self) -> None:
        self.started_at = datetime.utcnow()

    def elapsed(self) -> timedelta:
        if self.started_at is None:
            return timedelta(0)
        return datetime.utcnow() - self.started_at

    def is_expired(self) -> bool:
        return self.elapsed() >= self.duration

    def reset(self) -> None:
        self.started_at = None


class FileMetadata:
    path: Path
    size_bytes: int
    created_at: datetime
    modified_at: datetime
    is_readonly: bool
    tags: list[str]

    def __init__(
        self,
        path: Path,
        size_bytes: int,
        created_at: datetime,
        modified_at: datetime,
        is_readonly: bool = False,
        tags: Optional[list[str]] = None,
    ) -> None:
        self.path = path
        self.size_bytes = size_bytes
        self.created_at = created_at
        self.modified_at = modified_at
        self.is_readonly = is_readonly
        self.tags = tags or []

    def extension(self) -> str:
        return self.path.suffix

    def size_mb(self) -> float:
        return self.size_bytes / (1024 * 1024)

    def is_large(self, threshold_mb: float = 100.0) -> bool:
        return self.size_mb() > threshold_mb

    def age_days(self) -> int:
        return (datetime.utcnow() - self.created_at).days
