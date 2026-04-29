from typing import Optional


class IOChannel:
    channel_id: str
    is_open: bool
    buffer_size: int
    encoding: str

    def __init__(
        self,
        channel_id: str,
        buffer_size: int = 4096,
        encoding: str = "utf-8",
    ) -> None:
        self.channel_id = channel_id
        self.is_open = False
        self.buffer_size = buffer_size
        self.encoding = encoding

    def open(self) -> None:
        self.is_open = True

    def close(self) -> None:
        self.is_open = False

    def _require_open(self) -> None:
        if not self.is_open:
            raise IOError(f"Channel {self.channel_id!r} is not open.")

    def __repr__(self) -> str:
        state = "open" if self.is_open else "closed"
        return f"{self.__class__.__name__}({self.channel_id!r}, {state})"


class ReadableChannel(IOChannel):
    position: int
    total_bytes_read: int

    def __init__(self, channel_id: str, buffer_size: int = 4096) -> None:
        super().__init__(channel_id, buffer_size)
        self.position = 0
        self.total_bytes_read = 0

    def read(self, n: int = -1) -> bytes:
        raise NotImplementedError

    def seek(self, offset: int, whence: int = 0) -> int:
        raise NotImplementedError

    def readline(self) -> bytes:
        raise NotImplementedError

    def readlines(self) -> list[bytes]:
        lines: list[bytes] = []
        while True:
            line = self.readline()
            if not line:
                break
            lines.append(line)
        return lines

    def read_text(self) -> str:
        return self.read().decode(self.encoding)


class WritableChannel(IOChannel):
    total_bytes_written: int
    auto_flush: bool

    def __init__(
        self,
        channel_id: str,
        buffer_size: int = 4096,
        auto_flush: bool = False,
    ) -> None:
        super().__init__(channel_id, buffer_size)
        self.total_bytes_written = 0
        self.auto_flush = auto_flush

    def write(self, data: bytes) -> int:
        raise NotImplementedError

    def flush(self) -> None:
        raise NotImplementedError

    def writelines(self, lines: list[bytes]) -> None:
        for line in lines:
            self.write(line)

    def write_text(self, text: str) -> int:
        return self.write(text.encode(self.encoding))
