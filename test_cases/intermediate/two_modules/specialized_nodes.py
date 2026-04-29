from nodes import Node, ContainerNode, LeafNode
from typing import Optional, Any, Callable


class FilterableNode(ContainerNode):
    filter_fn: Optional[Callable[[Node], bool]]
    sort_key: Optional[Callable[[Node], Any]]

    def __init__(
        self,
        node_id: str,
        label: str,
        filter_fn: Optional[Callable[[Node], bool]] = None,
        sort_key: Optional[Callable[[Node], Any]] = None,
        metadata: Optional[dict[str, Any]] = None,
    ) -> None:
        super().__init__(node_id, label, metadata=metadata)
        self.filter_fn = filter_fn
        self.sort_key = sort_key

    def filtered_children(self) -> list[Node]:
        result = self.children if self.filter_fn is None else [c for c in self.children if self.filter_fn(c)]
        if self.sort_key is not None:
            result = sorted(result, key=self.sort_key)
        return result

    def count_matching(self) -> int:
        return len(self.filtered_children())


class PaginatedNode(ContainerNode):
    page_size: int
    current_page: int

    def __init__(
        self,
        node_id: str,
        label: str,
        page_size: int = 10,
        metadata: Optional[dict[str, Any]] = None,
    ) -> None:
        super().__init__(node_id, label, metadata=metadata)
        self.page_size = page_size
        self.current_page = 0

    def total_pages(self) -> int:
        if not self.children:
            return 0
        return (len(self.children) + self.page_size - 1) // self.page_size

    def current_page_children(self) -> list[Node]:
        start = self.current_page * self.page_size
        return self.children[start : start + self.page_size]

    def next_page(self) -> bool:
        if self.current_page < self.total_pages() - 1:
            self.current_page += 1
            return True
        return False

    def prev_page(self) -> bool:
        if self.current_page > 0:
            self.current_page -= 1
            return True
        return False


class ComputedLeafNode(LeafNode):
    compute_fn: Callable[[], Any]
    cached_value: Optional[Any]
    is_stale: bool
    compute_count: int

    def __init__(
        self,
        node_id: str,
        label: str,
        compute_fn: Callable[[], Any],
        data_type: str = "computed",
    ) -> None:
        super().__init__(node_id, label, value=None, data_type=data_type, is_mutable=False)
        self.compute_fn = compute_fn
        self.cached_value = None
        self.is_stale = True
        self.compute_count = 0

    def evaluate(self) -> Any:
        if self.is_stale:
            self.cached_value = self.compute_fn()
            self.is_stale = False
            self.compute_count += 1
        return self.cached_value

    def invalidate(self) -> None:
        self.is_stale = True


class AggregatorNode(ContainerNode):
    aggregation: str
    result_type: str

    def __init__(
        self,
        node_id: str,
        label: str,
        aggregation: str = "sum",
        result_type: str = "float",
    ) -> None:
        super().__init__(node_id, label)
        self.aggregation = aggregation
        self.result_type = result_type

    def compute(self) -> Any:
        numeric_leaves = [
            c for c in self.children
            if isinstance(c, LeafNode) and c.is_numeric()
        ]
        values = [float(c.value) for c in numeric_leaves]
        if not values:
            return 0.0
        if self.aggregation == "sum":
            return sum(values)
        if self.aggregation == "avg":
            return sum(values) / len(values)
        if self.aggregation == "max":
            return max(values)
        if self.aggregation == "min":
            return min(values)
        return 0.0
