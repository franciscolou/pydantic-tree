from typing import Optional, Any, Callable
from datetime import datetime


class Plugin:
    plugin_id: str
    name: str
    version: str
    author: str
    description: str
    is_enabled: bool
    dependencies: list[str]
    config: dict[str, Any]
    loaded_at: Optional[datetime]

    def __init__(
        self,
        plugin_id: str,
        name: str,
        version: str,
        author: str,
        description: str = "",
        dependencies: Optional[list[str]] = None,
    ) -> None:
        self.plugin_id = plugin_id
        self.name = name
        self.version = version
        self.author = author
        self.description = description
        self.is_enabled = True
        self.dependencies = dependencies or []
        self.config = {}
        self.loaded_at = None

    def load(self) -> None:
        self.loaded_at = datetime.utcnow()
        self.on_load()

    def unload(self) -> None:
        self.on_unload()
        self.loaded_at = None

    def on_load(self) -> None:
        pass

    def on_unload(self) -> None:
        pass

    def configure(self, key: str, value: Any) -> None:
        self.config[key] = value

    def is_loaded(self) -> bool:
        return self.loaded_at is not None

    def __repr__(self) -> str:
        return f"Plugin({self.name!r} v{self.version})"


class HookMixin:
    _hooks: dict[str, list[Callable[..., Any]]]
    hook_call_count: int

    def _init_hooks(self) -> None:
        self._hooks = {}
        self.hook_call_count = 0

    def register_hook(self, hook_name: str, fn: Callable[..., Any]) -> None:
        self._hooks.setdefault(hook_name, []).append(fn)

    def unregister_hook(self, hook_name: str, fn: Callable[..., Any]) -> None:
        if hook_name in self._hooks:
            self._hooks[hook_name] = [h for h in self._hooks[hook_name] if h is not fn]

    def call_hook(self, hook_name: str, *args: Any, **kwargs: Any) -> list[Any]:
        results = []
        for fn in self._hooks.get(hook_name, []):
            results.append(fn(*args, **kwargs))
            self.hook_call_count += 1
        return results

    def hook_names(self) -> list[str]:
        return list(self._hooks.keys())

    def has_hook(self, hook_name: str) -> bool:
        return bool(self._hooks.get(hook_name))
