from abstract_io import ReadableChannel, WritableChannel
from pathlib import Path
from typing import Optional


class FileReader(ReadableChannel):
    file_path: Path
    follow_symlinks: bool
    _handle: Optional[object]

    def __init__(
        self,
        file_path: Path,
        buffer_size: int = 4096,
        follow_symlinks: bool = True,
    ) -> None:
        super().__init__(str(file_path), buffer_size)
        self.file_path = file_path
        self.follow_symlinks = follow_symlinks
        self._handle = None

    def open(self) -> None:
        self._handle = open(self.file_path, "rb", buffering=self.buffer_size)
        super().open()

    def close(self) -> None:
        if self._handle:
            self._handle.close()
            self._handle = None
        super().close()

    def file_size(self) -> int:
        return self.file_path.stat().st_size

    def extension(self) -> str:
        return self.file_path.suffix


class FileWriter(WritableChannel):
    file_path: Path
    append_mode: bool
    create_parents: bool
    _handle: Optional[object]

    def __init__(
        self,
        file_path: Path,
        buffer_size: int = 4096,
        append_mode: bool = False,
        auto_flush: bool = False,
        create_parents: bool = False,
    ) -> None:
        super().__init__(str(file_path), buffer_size, auto_flush)
        self.file_path = file_path
        self.append_mode = append_mode
        self.create_parents = create_parents
        self._handle = None

    def open(self) -> None:
        if self.create_parents:
            self.file_path.parent.mkdir(parents=True, exist_ok=True)
        mode = "ab" if self.append_mode else "wb"
        self._handle = open(self.file_path, mode, buffering=self.buffer_size)
        super().open()

    def close(self) -> None:
        self.flush()
        if self._handle:
            self._handle.close()
            self._handle = None
        super().close()

    def flush(self) -> None:
        if self._handle:
            self._handle.flush()

    def exists(self) -> bool:
        return self.file_path.exists()
