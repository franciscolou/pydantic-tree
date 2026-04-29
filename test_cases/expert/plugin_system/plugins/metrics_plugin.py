from plugin_base import Plugin
from hooks import AroundHook
from typing import Optional, Any
from datetime import datetime
from collections import defaultdict


class MetricsPlugin(Plugin, AroundHook):
    counters: dict[str, int]
    gauges: dict[str, float]
    histograms: dict[str, list[float]]
    labels: dict[str, dict[str, str]]
    flush_interval_seconds: float
    last_flush_at: Optional[datetime]

    def __init__(
        self,
        flush_interval_seconds: float = 60.0,
        max_execution_time_ms: Optional[float] = None,
    ) -> None:
        Plugin.__init__(
            self,
            plugin_id="metrics",
            name="Metrics Plugin",
            version="2.0.0",
            author="system",
            description="Collects execution metrics via around-hook instrumentation.",
        )
        AroundHook.__init__(
            self,
            abort_on_failure=False,
            collect_results=False,
            max_execution_time_ms=max_execution_time_ms,
        )
        self.counters = defaultdict(int)
        self.gauges = {}
        self.histograms = defaultdict(list)
        self.labels = {}
        self.flush_interval_seconds = flush_interval_seconds
        self.last_flush_at = None

    def increment(self, metric: str, value: int = 1, labels: Optional[dict[str, str]] = None) -> None:
        self.counters[metric] += value
        if labels:
            self.labels[metric] = labels

    def set_gauge(self, metric: str, value: float) -> None:
        self.gauges[metric] = value

    def observe(self, metric: str, value: float) -> None:
        self.histograms[metric].append(value)

    def histogram_summary(self, metric: str) -> dict[str, float]:
        values = self.histograms.get(metric, [])
        if not values:
            return {}
        sorted_vals = sorted(values)
        n = len(sorted_vals)
        return {
            "count": float(n),
            "sum": sum(sorted_vals),
            "min": sorted_vals[0],
            "max": sorted_vals[-1],
            "p50": sorted_vals[n // 2],
            "p95": sorted_vals[int(n * 0.95)],
            "p99": sorted_vals[int(n * 0.99)],
            "avg": sum(sorted_vals) / n,
        }

    def on_load(self) -> None:
        self.increment("plugin.loads")
        self.last_flush_at = datetime.utcnow()

    def around(self, context: dict[str, Any], fn: Any) -> Any:
        operation = context.get("operation", "unknown")
        self.increment(f"ops.{operation}")
        result = super().around(context, fn)
        if self.execution_times_ms:
            self.observe(f"latency.{operation}", self.execution_times_ms[-1])
        return result

    def should_flush(self) -> bool:
        if self.last_flush_at is None:
            return True
        elapsed = (datetime.utcnow() - self.last_flush_at).total_seconds()
        return elapsed >= self.flush_interval_seconds

    def flush(self) -> dict[str, Any]:
        snapshot = {
            "counters": dict(self.counters),
            "gauges": dict(self.gauges),
            "histograms": {k: self.histogram_summary(k) for k in self.histograms},
            "flushed_at": datetime.utcnow().isoformat(),
        }
        self.last_flush_at = datetime.utcnow()
        return snapshot

    def reset(self) -> None:
        self.counters.clear()
        self.gauges.clear()
        self.histograms.clear()
