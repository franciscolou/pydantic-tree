from datetime import datetime
from typing import Optional, Any
import uuid


class Event:
    event_id: str
    event_type: str
    timestamp: datetime
    source: str
    payload: dict[str, Any]

    def __init__(
        self,
        event_type: str,
        source: str,
        payload: Optional[dict[str, Any]] = None,
    ) -> None:
        self.event_id = str(uuid.uuid4())
        self.event_type = event_type
        self.timestamp = datetime.utcnow()
        self.source = source
        self.payload = payload or {}

    def age_ms(self) -> float:
        return (datetime.utcnow() - self.timestamp).total_seconds() * 1000

    def __repr__(self) -> str:
        return f"Event({self.event_type!r}, source={self.source!r}, id={self.event_id[:8]})"


class UserEvent(Event):
    user_id: str
    session_id: Optional[str]

    def __init__(
        self,
        event_type: str,
        user_id: str,
        session_id: Optional[str] = None,
        payload: Optional[dict[str, Any]] = None,
    ) -> None:
        super().__init__(event_type, source=f"user:{user_id}", payload=payload)
        self.user_id = user_id
        self.session_id = session_id

    def is_authenticated(self) -> bool:
        return self.session_id is not None


class SystemEvent(Event):
    severity: str
    host: str
    process_id: int

    def __init__(
        self,
        event_type: str,
        host: str,
        process_id: int,
        severity: str = "info",
        payload: Optional[dict[str, Any]] = None,
    ) -> None:
        super().__init__(event_type, source=f"system:{host}", payload=payload)
        self.severity = severity
        self.host = host
        self.process_id = process_id

    def is_critical(self) -> bool:
        return self.severity in ("error", "critical")


class DomainEvent(Event):
    aggregate_id: str
    aggregate_type: str
    sequence_number: int

    def __init__(
        self,
        event_type: str,
        aggregate_id: str,
        aggregate_type: str,
        sequence_number: int,
        payload: Optional[dict[str, Any]] = None,
    ) -> None:
        super().__init__(event_type, source=f"{aggregate_type}:{aggregate_id}", payload=payload)
        self.aggregate_id = aggregate_id
        self.aggregate_type = aggregate_type
        self.sequence_number = sequence_number

    def routing_key(self) -> str:
        return f"{self.aggregate_type}.{self.event_type}"


class AuditEvent(UserEvent, SystemEvent):
    action: str
    resource_type: str
    resource_id: str
    outcome: str

    def __init__(
        self,
        action: str,
        user_id: str,
        host: str,
        resource_type: str,
        resource_id: str,
        outcome: str = "success",
        process_id: int = 0,
    ) -> None:
        UserEvent.__init__(self, "audit", user_id)
        SystemEvent.__init__(self, "audit", host, process_id, severity="info")
        self.action = action
        self.resource_type = resource_type
        self.resource_id = resource_id
        self.outcome = outcome

    def was_successful(self) -> bool:
        return self.outcome == "success"

    def summary(self) -> str:
        return f"{self.user_id} {self.action} {self.resource_type}/{self.resource_id}: {self.outcome}"
