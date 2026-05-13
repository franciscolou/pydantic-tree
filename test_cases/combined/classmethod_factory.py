"""
Combined: factory pattern via @classmethod + deep inheritance + attr redefinition.
Tests classmethods as alternative constructors across a 4-level hierarchy where
each level redefines a class-level discriminator attribute.
"""
from __future__ import annotations
from typing import Any, ClassVar
from datetime import datetime


class BaseMessage:
    _registry: ClassVar[dict[str, type["BaseMessage"]]] = {}

    message_type: str = "base"
    version: int = 1
    timestamp: datetime
    ttl_seconds: int = 3600

    def __init_subclass__(cls, **kwargs: Any) -> None:
        super().__init_subclass__(**kwargs)
        if hasattr(cls, "message_type") and cls.message_type != "base":
            BaseMessage._registry[cls.message_type] = cls

    @classmethod
    def create(cls, **kwargs: Any) -> "BaseMessage":
        obj = cls.__new__(cls)
        obj.timestamp = datetime.utcnow()
        for k, v in kwargs.items():
            setattr(obj, k, v)
        return obj

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "BaseMessage":
        msg_type = data.get("message_type", "base")
        target_cls = cls._registry.get(msg_type, cls)
        return target_cls.create(**data)

    @classmethod
    def registered_types(cls) -> list[str]:
        return sorted(cls._registry.keys())

    @staticmethod
    def is_valid_type(msg_type: str) -> bool:
        return msg_type in BaseMessage._registry

    @staticmethod
    def now_utc() -> datetime:
        return datetime.utcnow()


class CommandMessage(BaseMessage):
    message_type: str = "command"    # redefined
    version: int = 2                 # redefined
    ttl_seconds: int = 60            # redefined

    command: str
    payload: dict[str, Any]
    idempotency_key: str = ""
    priority: int = 0
    timeout_ms: int = 5000

    @classmethod
    def create_high_priority(
        cls,
        command: str,
        payload: dict[str, Any],
    ) -> "CommandMessage":
        return cls.create(command=command, payload=payload, priority=10)

    @classmethod
    def create_low_priority(
        cls,
        command: str,
        payload: dict[str, Any],
    ) -> "CommandMessage":
        return cls.create(command=command, payload=payload, priority=-10)

    @classmethod
    def fire_and_forget(cls, command: str) -> "CommandMessage":
        return cls.create(command=command, payload={}, ttl_seconds=10, priority=-99)


class EventMessage(BaseMessage):
    message_type: str = "event"     # redefined
    version: int = 1                # same as base
    ttl_seconds: int = 86400        # redefined

    event_name: str
    source: str
    correlation_id: str = ""
    causation_id: str = ""
    sequence: int = 0

    @classmethod
    def from_command(
        cls,
        cmd: CommandMessage,
        event_name: str,
    ) -> "EventMessage":
        return cls.create(
            event_name=event_name,
            source=cmd.command,
            causation_id=str(id(cmd)),
            correlation_id=cmd.idempotency_key,
        )

    @classmethod
    def system_event(cls, event_name: str) -> "EventMessage":
        return cls.create(event_name=event_name, source="system")


class DomainEventMessage(EventMessage):
    message_type: str = "domain_event"   # redefined
    version: int = 3                     # redefined
    ttl_seconds: int = 604800            # redefined (1 week)

    aggregate_id: str
    aggregate_type: str
    aggregate_version: int = 0

    @classmethod
    def for_aggregate(
        cls,
        aggregate_id: str,
        aggregate_type: str,
        event_name: str,
        aggregate_version: int = 0,
    ) -> "DomainEventMessage":
        return cls.create(
            aggregate_id=aggregate_id,
            aggregate_type=aggregate_type,
            event_name=event_name,
            aggregate_version=aggregate_version,
            source=aggregate_type,
        )

    @classmethod
    def snapshot(cls, aggregate_id: str, aggregate_type: str) -> "DomainEventMessage":
        return cls.for_aggregate(
            aggregate_id=aggregate_id,
            aggregate_type=aggregate_type,
            event_name=f"{aggregate_type}.snapshot",
        )
