from plugin_base import HookMixin
from typing import Optional, Any, Callable
from datetime import datetime


class BeforeHook(HookMixin):
    before_call_count: int
    abort_on_failure: bool

    def __init__(self, abort_on_failure: bool = False) -> None:
        self._init_hooks()
        self.before_call_count = 0
        self.abort_on_failure = abort_on_failure

    def before(self, context: dict[str, Any]) -> bool:
        results = self.call_hook("before", context)
        self.before_call_count += 1
        if self.abort_on_failure:
            return all(r is not False for r in results)
        return True

    def on_before(self, fn: Callable[[dict[str, Any]], Optional[bool]]) -> None:
        self.register_hook("before", fn)


class AfterHook(HookMixin):
    after_call_count: int
    collect_results: bool
    result_history: list[Any]

    def __init__(self, collect_results: bool = False) -> None:
        self._init_hooks()
        self.after_call_count = 0
        self.collect_results = collect_results
        self.result_history = []

    def after(self, context: dict[str, Any], result: Any = None) -> None:
        self.call_hook("after", context, result)
        self.after_call_count += 1
        if self.collect_results and result is not None:
            self.result_history.append(result)

    def on_after(self, fn: Callable[[dict[str, Any], Any], None]) -> None:
        self.register_hook("after", fn)

    def last_result(self) -> Optional[Any]:
        return self.result_history[-1] if self.result_history else None


class AroundHook(BeforeHook, AfterHook):
    """Diamond: AroundHook inherits from both BeforeHook and AfterHook, which both inherit from HookMixin."""
    execution_times_ms: list[float]
    max_execution_time_ms: Optional[float]

    def __init__(
        self,
        abort_on_failure: bool = False,
        collect_results: bool = False,
        max_execution_time_ms: Optional[float] = None,
    ) -> None:
        BeforeHook.__init__(self, abort_on_failure)
        AfterHook.__init__(self, collect_results)
        self.execution_times_ms = []
        self.max_execution_time_ms = max_execution_time_ms

    def around(self, context: dict[str, Any], fn: Callable[[], Any]) -> Any:
        if not self.before(context):
            return None
        start = datetime.utcnow()
        result = fn()
        elapsed_ms = (datetime.utcnow() - start).total_seconds() * 1000
        self.execution_times_ms.append(elapsed_ms)
        if self.max_execution_time_ms and elapsed_ms > self.max_execution_time_ms:
            self.call_hook("timeout", context, elapsed_ms)
        self.after(context, result)
        return result

    def avg_execution_time_ms(self) -> float:
        if not self.execution_times_ms:
            return 0.0
        return sum(self.execution_times_ms) / len(self.execution_times_ms)

    def on_timeout(self, fn: Callable[[dict[str, Any], float], None]) -> None:
        self.register_hook("timeout", fn)
