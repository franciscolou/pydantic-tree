from typing import Optional


class ComputeUnit:
    unit_id: str
    model_name: str
    architecture: str
    core_count: int
    clock_speed_ghz: float
    tdp_watts: float
    memory_gb: float

    def __init__(
        self,
        unit_id: str,
        model_name: str,
        architecture: str,
        core_count: int,
        clock_speed_ghz: float,
        tdp_watts: float,
        memory_gb: float,
    ) -> None:
        self.unit_id = unit_id
        self.model_name = model_name
        self.architecture = architecture
        self.core_count = core_count
        self.clock_speed_ghz = clock_speed_ghz
        self.tdp_watts = tdp_watts
        self.memory_gb = memory_gb

    def performance_score(self) -> float:
        return self.core_count * self.clock_speed_ghz

    def efficiency_ratio(self) -> float:
        return self.performance_score() / self.tdp_watts

    def __repr__(self) -> str:
        return f"{self.__class__.__name__}({self.model_name!r})"


class CPU(ComputeUnit):
    thread_count: int
    cache_mb: float
    supports_ecc: bool
    socket_type: str
    turbo_boost_ghz: Optional[float]

    def __init__(
        self,
        unit_id: str,
        model_name: str,
        architecture: str,
        core_count: int,
        clock_speed_ghz: float,
        tdp_watts: float,
        memory_gb: float,
        thread_count: int,
        cache_mb: float,
        socket_type: str,
        supports_ecc: bool = False,
        turbo_boost_ghz: Optional[float] = None,
    ) -> None:
        super().__init__(unit_id, model_name, architecture, core_count, clock_speed_ghz, tdp_watts, memory_gb)
        self.thread_count = thread_count
        self.cache_mb = cache_mb
        self.supports_ecc = supports_ecc
        self.socket_type = socket_type
        self.turbo_boost_ghz = turbo_boost_ghz

    def max_clock_ghz(self) -> float:
        return self.turbo_boost_ghz or self.clock_speed_ghz

    def smt_ratio(self) -> float:
        return self.thread_count / self.core_count


class GPU(ComputeUnit):
    vram_gb: float
    compute_units: int
    memory_bandwidth_gbps: float
    pcie_lanes: int
    supports_raytracing: bool
    cuda_cores: Optional[int]

    def __init__(
        self,
        unit_id: str,
        model_name: str,
        architecture: str,
        core_count: int,
        clock_speed_ghz: float,
        tdp_watts: float,
        memory_gb: float,
        vram_gb: float,
        compute_units: int,
        memory_bandwidth_gbps: float,
        pcie_lanes: int = 16,
        supports_raytracing: bool = True,
        cuda_cores: Optional[int] = None,
    ) -> None:
        super().__init__(unit_id, model_name, architecture, core_count, clock_speed_ghz, tdp_watts, memory_gb)
        self.vram_gb = vram_gb
        self.compute_units = compute_units
        self.memory_bandwidth_gbps = memory_bandwidth_gbps
        self.pcie_lanes = pcie_lanes
        self.supports_raytracing = supports_raytracing
        self.cuda_cores = cuda_cores

    def is_workstation_grade(self) -> bool:
        return self.vram_gb >= 24.0

    def fp32_tflops(self) -> float:
        ops_per_cycle = self.cuda_cores or self.compute_units * 64
        return ops_per_cycle * self.clock_speed_ghz * 2 / 1000


class NPU(ComputeUnit):
    tops: float
    supported_precisions: list[str]
    on_chip_memory_mb: float
    batch_size: int

    def __init__(
        self,
        unit_id: str,
        model_name: str,
        architecture: str,
        core_count: int,
        clock_speed_ghz: float,
        tdp_watts: float,
        memory_gb: float,
        tops: float,
        supported_precisions: Optional[list[str]] = None,
        on_chip_memory_mb: float = 32.0,
        batch_size: int = 8,
    ) -> None:
        super().__init__(unit_id, model_name, architecture, core_count, clock_speed_ghz, tdp_watts, memory_gb)
        self.tops = tops
        self.supported_precisions = supported_precisions or ["int8", "fp16"]
        self.on_chip_memory_mb = on_chip_memory_mb
        self.batch_size = batch_size

    def supports_int4(self) -> bool:
        return "int4" in self.supported_precisions

    def efficiency_tops_per_watt(self) -> float:
        return self.tops / self.tdp_watts
