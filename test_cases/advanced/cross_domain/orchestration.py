from storage import Storage, CloudStorage, DistributedStorage
from compute import ComputeUnit, CPU, GPU, NPU
from network import NetworkInterface, EthernetInterface, InfinibandInterface
from typing import Optional
from datetime import datetime


class ClusterNode:
    node_id: str
    hostname: str
    cpu: CPU
    gpus: list[GPU]
    storage: Storage
    network_interface: NetworkInterface
    is_healthy: bool
    joined_at: datetime
    labels: dict[str, str]

    def __init__(
        self,
        node_id: str,
        hostname: str,
        cpu: CPU,
        storage: Storage,
        network_interface: NetworkInterface,
        gpus: Optional[list[GPU]] = None,
    ) -> None:
        self.node_id = node_id
        self.hostname = hostname
        self.cpu = cpu
        self.gpus = gpus or []
        self.storage = storage
        self.network_interface = network_interface
        self.is_healthy = True
        self.joined_at = datetime.utcnow()
        self.labels = {}

    def total_vram_gb(self) -> float:
        return sum(g.vram_gb for g in self.gpus)

    def set_label(self, key: str, value: str) -> None:
        self.labels[key] = value

    def has_gpu(self) -> bool:
        return len(self.gpus) > 0

    def __repr__(self) -> str:
        return f"ClusterNode({self.hostname!r}, cpus={self.cpu.core_count}, gpus={len(self.gpus)})"


class AIClusterNode(ClusterNode):
    npus: list[NPU]
    model_serving_port: int
    max_concurrent_models: int
    loaded_models: list[str]

    def __init__(
        self,
        node_id: str,
        hostname: str,
        cpu: CPU,
        storage: Storage,
        network_interface: NetworkInterface,
        gpus: Optional[list[GPU]] = None,
        npus: Optional[list[NPU]] = None,
        model_serving_port: int = 8080,
        max_concurrent_models: int = 4,
    ) -> None:
        super().__init__(node_id, hostname, cpu, storage, network_interface, gpus)
        self.npus = npus or []
        self.model_serving_port = model_serving_port
        self.max_concurrent_models = max_concurrent_models
        self.loaded_models = []

    def total_tops(self) -> float:
        return sum(n.tops for n in self.npus)

    def load_model(self, model_name: str) -> bool:
        if len(self.loaded_models) >= self.max_concurrent_models:
            return False
        self.loaded_models.append(model_name)
        return True

    def unload_model(self, model_name: str) -> None:
        self.loaded_models = [m for m in self.loaded_models if m != model_name]


class Cluster:
    cluster_id: str
    name: str
    nodes: list[ClusterNode]
    shared_storage: DistributedStorage
    scheduler_policy: str
    created_at: datetime

    def __init__(
        self,
        cluster_id: str,
        name: str,
        shared_storage: DistributedStorage,
        scheduler_policy: str = "round_robin",
    ) -> None:
        self.cluster_id = cluster_id
        self.name = name
        self.nodes = []
        self.shared_storage = shared_storage
        self.scheduler_policy = scheduler_policy
        self.created_at = datetime.utcnow()

    def add_node(self, node: ClusterNode) -> None:
        self.nodes.append(node)

    def remove_node(self, node_id: str) -> Optional[ClusterNode]:
        for i, node in enumerate(self.nodes):
            if node.node_id == node_id:
                return self.nodes.pop(i)
        return None

    def healthy_nodes(self) -> list[ClusterNode]:
        return [n for n in self.nodes if n.is_healthy]

    def total_cpu_cores(self) -> int:
        return sum(n.cpu.core_count for n in self.healthy_nodes())

    def total_gpu_count(self) -> int:
        return sum(len(n.gpus) for n in self.healthy_nodes())


class HybridCluster(Cluster):
    cloud_storage: CloudStorage
    on_premise_nodes: list[ClusterNode]
    cloud_nodes: list[ClusterNode]
    burst_enabled: bool
    max_cloud_nodes: int

    def __init__(
        self,
        cluster_id: str,
        name: str,
        shared_storage: DistributedStorage,
        cloud_storage: CloudStorage,
        burst_enabled: bool = True,
        max_cloud_nodes: int = 10,
    ) -> None:
        super().__init__(cluster_id, name, shared_storage)
        self.cloud_storage = cloud_storage
        self.on_premise_nodes = []
        self.cloud_nodes = []
        self.burst_enabled = burst_enabled
        self.max_cloud_nodes = max_cloud_nodes

    def add_on_prem_node(self, node: ClusterNode) -> None:
        self.on_premise_nodes.append(node)
        self.add_node(node)

    def add_cloud_node(self, node: ClusterNode) -> bool:
        if len(self.cloud_nodes) >= self.max_cloud_nodes:
            return False
        self.cloud_nodes.append(node)
        self.add_node(node)
        return True

    def burst_capacity_nodes(self) -> int:
        return self.max_cloud_nodes - len(self.cloud_nodes)

    def is_bursting(self) -> bool:
        return self.burst_enabled and len(self.cloud_nodes) > 0
