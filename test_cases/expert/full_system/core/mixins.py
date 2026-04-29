from typing import Optional, Any, Callable
from datetime import datetime
from enum import Enum


class ObservableMixin:
    _listeners: dict[str, list[Callable[..., None]]]

    def _init_observable(self) -> None:
        self._listeners = {}

    def on(self, event: str, callback: Callable[..., None]) -> None:
        self._listeners.setdefault(event, []).append(callback)

    def off(self, event: str, callback: Callable[..., None]) -> None:
        if event in self._listeners:
            self._listeners[event] = [cb for cb in self._listeners[event] if cb is not callback]

    def emit(self, event: str, *args: Any, **kwargs: Any) -> None:
        for cb in list(self._listeners.get(event, [])):
            cb(*args, **kwargs)

    def once(self, event: str, callback: Callable[..., None]) -> None:
        def wrapper(*args: Any, **kwargs: Any) -> None:
            callback(*args, **kwargs)
            self.off(event, wrapper)
        self.on(event, wrapper)


class StateMachineMixin:
    state: str
    _transitions: dict[tuple[str, str], str]
    _state_history: list[tuple[str, datetime]]
    _on_enter: dict[str, list[Callable[[], None]]]
    _on_exit: dict[str, list[Callable[[], None]]]

    def _init_state_machine(self, initial_state: str) -> None:
        self.state = initial_state
        self._transitions = {}
        self._state_history = [(initial_state, datetime.utcnow())]
        self._on_enter = {}
        self._on_exit = {}

    def add_transition(self, from_state: str, trigger: str, to_state: str) -> None:
        self._transitions[(from_state, trigger)] = to_state

    def trigger(self, event: str) -> bool:
        key = (self.state, event)
        if key not in self._transitions:
            return False
        next_state = self._transitions[key]
        for cb in self._on_exit.get(self.state, []):
            cb()
        self.state = next_state
        self._state_history.append((next_state, datetime.utcnow()))
        for cb in self._on_enter.get(next_state, []):
            cb()
        return True

    def on_enter(self, state: str, callback: Callable[[], None]) -> None:
        self._on_enter.setdefault(state, []).append(callback)

    def on_exit(self, state: str, callback: Callable[[], None]) -> None:
        self._on_exit.setdefault(state, []).append(callback)

    def can_trigger(self, event: str) -> bool:
        return (self.state, event) in self._transitions

    def time_in_current_state_seconds(self) -> float:
        if not self._state_history:
            return 0.0
        return (datetime.utcnow() - self._state_history[-1][1]).total_seconds()


class EventSourcedMixin:
    _event_store: list[dict[str, Any]]
    _projections: dict[str, Callable[[list[dict[str, Any]]], Any]]

    def _init_event_sourced(self) -> None:
        self._event_store = []
        self._projections = {}

    def record_event(self, event_type: str, data: dict[str, Any]) -> None:
        self._event_store.append({
            "type": event_type,
            "data": data,
            "recorded_at": datetime.utcnow().isoformat(),
            "sequence": len(self._event_store),
        })

    def events_of_type(self, event_type: str) -> list[dict[str, Any]]:
        return [e for e in self._event_store if e["type"] == event_type]

    def register_projection(self, name: str, fn: Callable[[list[dict[str, Any]]], Any]) -> None:
        self._projections[name] = fn

    def project(self, name: str) -> Optional[Any]:
        fn = self._projections.get(name)
        return fn(self._event_store) if fn else None

    def event_count(self) -> int:
        return len(self._event_store)

    def replay_from(self, sequence: int) -> list[dict[str, Any]]:
        return [e for e in self._event_store if e["sequence"] >= sequence]
