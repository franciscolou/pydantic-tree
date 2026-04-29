from datetime import datetime
from typing import Optional, Any
import uuid


class Command:
    command_id: str
    command_type: str
    issued_at: datetime
    issued_by: str
    metadata: dict[str, Any]

    def __init__(
        self,
        command_type: str,
        issued_by: str,
        metadata: Optional[dict[str, Any]] = None,
    ) -> None:
        self.command_id = str(uuid.uuid4())
        self.command_type = command_type
        self.issued_at = datetime.utcnow()
        self.issued_by = issued_by
        self.metadata = metadata or {}

    def execute(self) -> Any:
        raise NotImplementedError

    def can_execute(self) -> bool:
        return True

    def __repr__(self) -> str:
        return f"Command({self.command_type!r}, by={self.issued_by!r})"


class UndoableCommand(Command):
    is_executed: bool
    executed_at: Optional[datetime]
    undo_stack: list[Any]

    def __init__(
        self,
        command_type: str,
        issued_by: str,
        metadata: Optional[dict[str, Any]] = None,
    ) -> None:
        super().__init__(command_type, issued_by, metadata)
        self.is_executed = False
        self.executed_at = None
        self.undo_stack = []

    def execute(self) -> Any:
        result = self._do_execute()
        self.is_executed = True
        self.executed_at = datetime.utcnow()
        return result

    def _do_execute(self) -> Any:
        raise NotImplementedError

    def undo(self) -> None:
        if not self.is_executed:
            raise RuntimeError("Cannot undo a command that has not been executed.")
        self._do_undo()
        self.is_executed = False

    def _do_undo(self) -> None:
        raise NotImplementedError


class BatchCommand(Command):
    sub_commands: list[Command]
    stop_on_failure: bool
    results: list[Any]

    def __init__(
        self,
        issued_by: str,
        stop_on_failure: bool = True,
    ) -> None:
        super().__init__("batch", issued_by)
        self.sub_commands = []
        self.stop_on_failure = stop_on_failure
        self.results = []

    def add(self, command: Command) -> "BatchCommand":
        self.sub_commands.append(command)
        return self

    def execute(self) -> list[Any]:
        self.results = []
        for cmd in self.sub_commands:
            try:
                self.results.append(cmd.execute())
            except Exception as exc:
                self.results.append(exc)
                if self.stop_on_failure:
                    break
        return self.results

    def success_count(self) -> int:
        return sum(1 for r in self.results if not isinstance(r, Exception))


class ScheduledCommand(UndoableCommand):
    scheduled_for: datetime
    recurrence_seconds: Optional[float]
    max_executions: Optional[int]
    execution_count: int

    def __init__(
        self,
        command_type: str,
        issued_by: str,
        scheduled_for: datetime,
        recurrence_seconds: Optional[float] = None,
        max_executions: Optional[int] = None,
    ) -> None:
        super().__init__(command_type, issued_by)
        self.scheduled_for = scheduled_for
        self.recurrence_seconds = recurrence_seconds
        self.max_executions = max_executions
        self.execution_count = 0

    def is_due(self) -> bool:
        return datetime.utcnow() >= self.scheduled_for

    def is_exhausted(self) -> bool:
        return self.max_executions is not None and self.execution_count >= self.max_executions

    def can_execute(self) -> bool:
        return self.is_due() and not self.is_exhausted()

    def _do_execute(self) -> Any:
        self.execution_count += 1
        return {"executed_at": datetime.utcnow().isoformat(), "count": self.execution_count}

    def _do_undo(self) -> None:
        self.execution_count = max(0, self.execution_count - 1)
