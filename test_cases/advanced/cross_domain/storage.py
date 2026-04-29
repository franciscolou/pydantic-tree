from typing import Optional
from pathlib import Path
from datetime import datetime


class Storage:
    storage_id: str
    capacity_gb: float
    used_gb: float
    storage_type: str
    redundancy_level: int
    is_encrypted: bool

    def __init__(
        self,
        storage_id: str,
        capacity_gb: float,
        storage_type: str,
        redundancy_level: int = 1,
        is_encrypted: bool = False,
    ) -> None:
        self.storage_id = storage_id
        self.capacity_gb = capacity_gb
        self.used_gb = 0.0
        self.storage_type = storage_type
        self.redundancy_level = redundancy_level
        self.is_encrypted = is_encrypted

    def free_gb(self) -> float:
        return self.capacity_gb - self.used_gb

    def utilization_pct(self) -> float:
        return self.used_gb / self.capacity_gb * 100

    def is_full(self, threshold_pct: float = 95.0) -> bool:
        return self.utilization_pct() >= threshold_pct

    def allocate(self, size_gb: float) -> bool:
        if size_gb > self.free_gb():
            return False
        self.used_gb += size_gb
        return True


class LocalStorage(Storage):
    mount_point: Path
    filesystem: str
    inode_count: int
    inode_used: int
    supports_symlinks: bool

    def __init__(
        self,
        storage_id: str,
        capacity_gb: float,
        mount_point: Path,
        filesystem: str = "ext4",
        inode_count: int = 1_000_000,
        supports_symlinks: bool = True,
        is_encrypted: bool = False,
    ) -> None:
        super().__init__(storage_id, capacity_gb, "local", redundancy_level=1, is_encrypted=is_encrypted)
        self.mount_point = mount_point
        self.filesystem = filesystem
        self.inode_count = inode_count
        self.inode_used = 0
        self.supports_symlinks = supports_symlinks

    def inodes_free(self) -> int:
        return self.inode_count - self.inode_used

    def is_ssd(self) -> bool:
        return self.filesystem in ("apfs", "btrfs", "f2fs")


class CloudStorage(Storage):
    provider: str
    region: str
    bucket_name: str
    access_tier: str
    versioning_enabled: bool
    endpoint_url: Optional[str]

    def __init__(
        self,
        storage_id: str,
        capacity_gb: float,
        provider: str,
        region: str,
        bucket_name: str,
        access_tier: str = "standard",
        versioning_enabled: bool = False,
        endpoint_url: Optional[str] = None,
        is_encrypted: bool = True,
        redundancy_level: int = 3,
    ) -> None:
        super().__init__(storage_id, capacity_gb, "cloud", redundancy_level, is_encrypted)
        self.provider = provider
        self.region = region
        self.bucket_name = bucket_name
        self.access_tier = access_tier
        self.versioning_enabled = versioning_enabled
        self.endpoint_url = endpoint_url

    def is_cold_storage(self) -> bool:
        return self.access_tier in ("glacier", "cold", "archive")

    def retrieval_time_hours(self) -> float:
        return {"standard": 0.0, "infrequent": 0.0, "cold": 12.0, "glacier": 48.0}.get(
            self.access_tier, 0.0
        )


class DistributedStorage(CloudStorage):
    shard_count: int
    replication_factor: int
    consistency_model: str
    node_urls: list[str]

    def __init__(
        self,
        storage_id: str,
        capacity_gb: float,
        provider: str,
        region: str,
        bucket_name: str,
        shard_count: int = 8,
        replication_factor: int = 3,
        consistency_model: str = "eventual",
        node_urls: Optional[list[str]] = None,
    ) -> None:
        super().__init__(
            storage_id, capacity_gb, provider, region, bucket_name,
            redundancy_level=replication_factor, is_encrypted=True,
        )
        self.shard_count = shard_count
        self.replication_factor = replication_factor
        self.consistency_model = consistency_model
        self.node_urls = node_urls or []

    def is_strongly_consistent(self) -> bool:
        return self.consistency_model == "strong"

    def effective_capacity_gb(self) -> float:
        return self.capacity_gb / self.replication_factor
