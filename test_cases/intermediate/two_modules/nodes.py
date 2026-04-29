from typing import Optional, Any, Iterator


class Node:
    node_id: str
    label: str
    metadata: dict[str, Any]
    parent: Optional["Node"]

    def __init__(
        self,
        node_id: str,
        label: str,
        metadata: Optional[dict[str, Any]] = None,
    ) -> None:
        self.node_id = node_id
        self.label = label
        self.metadata = metadata or {}
        self.parent = None

    def is_root(self) -> bool:
        return self.parent is None

    def depth(self) -> int:
        if self.parent is None:
            return 0
        return 1 + self.parent.depth()

    def path_to_root(self) -> list["Node"]:
        if self.parent is None:
            return [self]
        return self.parent.path_to_root() + [self]

    def __repr__(self) -> str:
        return f"{self.__class__.__name__}({self.node_id!r}, {self.label!r})"


class ContainerNode(Node):
    children: list[Node]
    max_children: Optional[int]
    ordered: bool

    def __init__(
        self,
        node_id: str,
        label: str,
        max_children: Optional[int] = None,
        ordered: bool = True,
        metadata: Optional[dict[str, Any]] = None,
    ) -> None:
        super().__init__(node_id, label, metadata)
        self.children = []
        self.max_children = max_children
        self.ordered = ordered

    def add_child(self, node: Node) -> None:
        if self.max_children is not None and len(self.children) >= self.max_children:
            raise ValueError(f"Cannot add more than {self.max_children} children.")
        node.parent = self
        self.children.append(node)

    def remove_child(self, node_id: str) -> Optional[Node]:
        for i, child in enumerate(self.children):
            if child.node_id == node_id:
                removed = self.children.pop(i)
                removed.parent = None
                return removed
        return None

    def find_descendant(self, node_id: str) -> Optional[Node]:
        for child in self.children:
            if child.node_id == node_id:
                return child
            if isinstance(child, ContainerNode):
                found = child.find_descendant(node_id)
                if found:
                    return found
        return None

    def iter_descendants(self) -> Iterator[Node]:
        for child in self.children:
            yield child
            if isinstance(child, ContainerNode):
                yield from child.iter_descendants()

    def subtree_size(self) -> int:
        return 1 + sum(
            c.subtree_size() if isinstance(c, ContainerNode) else 1
            for c in self.children
        )


class LeafNode(Node):
    value: Any
    data_type: str
    is_mutable: bool

    def __init__(
        self,
        node_id: str,
        label: str,
        value: Any,
        data_type: str = "unknown",
        is_mutable: bool = True,
    ) -> None:
        super().__init__(node_id, label)
        self.value = value
        self.data_type = data_type
        self.is_mutable = is_mutable

    def is_numeric(self) -> bool:
        return self.data_type in ("int", "float")

    def as_string(self) -> str:
        return str(self.value)

    def update(self, new_value: Any) -> None:
        if not self.is_mutable:
            raise RuntimeError(f"Node {self.node_id!r} is immutable.")
        self.value = new_value
