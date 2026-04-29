from events import Event, UserEvent, SystemEvent, DomainEvent
from commands import Command, UndoableCommand
from typing import Optional, Callable, Any
from datetime import datetime


class Handler:
    handler_id: str
    is_active: bool
    processed_count: int
    error_count: int

    def __init__(self, handler_id: str) -> None:
        self.handler_id = handler_id
        self.is_active = True
        self.processed_count = 0
        self.error_count = 0

    def handle(self, message: Any) -> None:
        raise NotImplementedError

    def activate(self) -> None:
        self.is_active = True

    def deactivate(self) -> None:
        self.is_active = False

    def success_rate(self) -> float:
        total = self.processed_count + self.error_count
        if total == 0:
            return 1.0
        return self.processed_count / total


class EventHandler(Handler):
    supported_event_types: list[str]
    on_success: Optional[Callable[[Event], None]]
    on_error: Optional[Callable[[Event, Exception], None]]

    def __init__(
        self,
        handler_id: str,
        supported_event_types: Optional[list[str]] = None,
        on_success: Optional[Callable[[Event], None]] = None,
        on_error: Optional[Callable[[Event, Exception], None]] = None,
    ) -> None:
        super().__init__(handler_id)
        self.supported_event_types = supported_event_types or []
        self.on_success = on_success
        self.on_error = on_error

    def can_handle(self, event: Event) -> bool:
        return not self.supported_event_types or event.event_type in self.supported_event_types

    def handle(self, message: Any) -> None:
        if not isinstance(message, Event):
            raise TypeError(f"Expected Event, got {type(message).__name__}")
        if not self.can_handle(message):
            return
        try:
            self._process_event(message)
            self.processed_count += 1
            if self.on_success:
                self.on_success(message)
        except Exception as exc:
            self.error_count += 1
            if self.on_error:
                self.on_error(message, exc)
            else:
                raise

    def _process_event(self, event: Event) -> None:
        pass


class CommandHandler(Handler):
    allowed_command_types: list[str]
    require_authorization: bool
    authorized_issuers: set[str]

    def __init__(
        self,
        handler_id: str,
        allowed_command_types: Optional[list[str]] = None,
        require_authorization: bool = False,
        authorized_issuers: Optional[set[str]] = None,
    ) -> None:
        super().__init__(handler_id)
        self.allowed_command_types = allowed_command_types or []
        self.require_authorization = require_authorization
        self.authorized_issuers = authorized_issuers or set()

    def is_authorized(self, command: Command) -> bool:
        if not self.require_authorization:
            return True
        return command.issued_by in self.authorized_issuers

    def handle(self, message: Any) -> Any:
        if not isinstance(message, Command):
            raise TypeError(f"Expected Command, got {type(message).__name__}")
        if not self.is_authorized(message):
            self.error_count += 1
            raise PermissionError(f"Issuer {message.issued_by!r} is not authorized.")
        if not message.can_execute():
            self.error_count += 1
            raise RuntimeError(f"Command {message.command_type!r} cannot execute now.")
        result = message.execute()
        self.processed_count += 1
        return result


class PipelineHandler(EventHandler, CommandHandler):
    stages: list[Callable[[Any], Any]]
    transformation_log: list[dict[str, Any]]

    def __init__(
        self,
        handler_id: str,
        stages: Optional[list[Callable[[Any], Any]]] = None,
    ) -> None:
        EventHandler.__init__(self, handler_id)
        CommandHandler.__init__(self, handler_id)
        self.stages = stages or []
        self.transformation_log = []

    def add_stage(self, fn: Callable[[Any], Any]) -> "PipelineHandler":
        self.stages.append(fn)
        return self

    def run_pipeline(self, message: Any) -> Any:
        result = message
        for stage in self.stages:
            entry: dict[str, Any] = {
                "stage": stage.__name__,
                "input_type": type(result).__name__,
                "at": datetime.utcnow().isoformat(),
            }
            result = stage(result)
            entry["output_type"] = type(result).__name__
            self.transformation_log.append(entry)
        return result

    def handle(self, message: Any) -> Any:
        transformed = self.run_pipeline(message)
        if isinstance(transformed, Event):
            EventHandler.handle(self, transformed)
        elif isinstance(transformed, Command):
            return CommandHandler.handle(self, transformed)
        return transformed
