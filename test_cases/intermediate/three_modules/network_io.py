from abstract_io import ReadableChannel, WritableChannel
from typing import Optional


class NetworkReader(ReadableChannel):
    host: str
    port: int
    timeout_seconds: float
    ssl_enabled: bool
    max_retries: int

    def __init__(
        self,
        host: str,
        port: int,
        buffer_size: int = 8192,
        timeout_seconds: float = 30.0,
        ssl_enabled: bool = False,
        max_retries: int = 3,
    ) -> None:
        super().__init__(f"{host}:{port}", buffer_size)
        self.host = host
        self.port = port
        self.timeout_seconds = timeout_seconds
        self.ssl_enabled = ssl_enabled
        self.max_retries = max_retries

    def endpoint(self) -> tuple[str, int]:
        return (self.host, self.port)

    def is_secure(self) -> bool:
        return self.ssl_enabled and self.port == 443

    def url(self, path: str = "/") -> str:
        scheme = "https" if self.is_secure() else "http"
        return f"{scheme}://{self.host}:{self.port}{path}"


class NetworkWriter(WritableChannel):
    host: str
    port: int
    timeout_seconds: float
    retry_count: int
    headers: dict[str, str]

    def __init__(
        self,
        host: str,
        port: int,
        buffer_size: int = 8192,
        timeout_seconds: float = 30.0,
        retry_count: int = 3,
        auto_flush: bool = True,
    ) -> None:
        super().__init__(f"{host}:{port}", buffer_size, auto_flush)
        self.host = host
        self.port = port
        self.timeout_seconds = timeout_seconds
        self.retry_count = retry_count
        self.headers = {}

    def set_header(self, key: str, value: str) -> None:
        self.headers[key] = value

    def endpoint(self) -> tuple[str, int]:
        return (self.host, self.port)

    def flush(self) -> None:
        pass


class BidirectionalNetworkChannel(NetworkReader, NetworkWriter):
    protocol: str
    session_id: Optional[str]

    def __init__(
        self,
        host: str,
        port: int,
        protocol: str = "tcp",
        ssl_enabled: bool = False,
        timeout_seconds: float = 30.0,
        session_id: Optional[str] = None,
    ) -> None:
        NetworkReader.__init__(self, host, port, timeout_seconds=timeout_seconds, ssl_enabled=ssl_enabled)
        NetworkWriter.__init__(self, host, port, timeout_seconds=timeout_seconds)
        self.protocol = protocol
        self.session_id = session_id

    def is_websocket(self) -> bool:
        return self.protocol == "ws" or self.protocol == "wss"
