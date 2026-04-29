from typing import Optional


class NetworkInterface:
    interface_id: str
    name: str
    mac_address: str
    mtu: int
    is_up: bool
    rx_bytes: int
    tx_bytes: int

    def __init__(
        self,
        interface_id: str,
        name: str,
        mac_address: str,
        mtu: int = 1500,
    ) -> None:
        self.interface_id = interface_id
        self.name = name
        self.mac_address = mac_address
        self.mtu = mtu
        self.is_up = False
        self.rx_bytes = 0
        self.tx_bytes = 0

    def bring_up(self) -> None:
        self.is_up = True

    def bring_down(self) -> None:
        self.is_up = False

    def total_traffic_bytes(self) -> int:
        return self.rx_bytes + self.tx_bytes

    def __repr__(self) -> str:
        return f"{self.__class__.__name__}({self.name!r}, mac={self.mac_address!r})"


class EthernetInterface(NetworkInterface):
    speed_mbps: int
    duplex: str
    autoneg: bool
    vlan_id: Optional[int]
    poe_enabled: bool

    def __init__(
        self,
        interface_id: str,
        name: str,
        mac_address: str,
        speed_mbps: int = 1000,
        duplex: str = "full",
        autoneg: bool = True,
        vlan_id: Optional[int] = None,
        poe_enabled: bool = False,
        mtu: int = 1500,
    ) -> None:
        super().__init__(interface_id, name, mac_address, mtu)
        self.speed_mbps = speed_mbps
        self.duplex = duplex
        self.autoneg = autoneg
        self.vlan_id = vlan_id
        self.poe_enabled = poe_enabled

    def is_gigabit(self) -> bool:
        return self.speed_mbps >= 1000

    def is_full_duplex(self) -> bool:
        return self.duplex == "full"


class WifiInterface(NetworkInterface):
    ssid: Optional[str]
    frequency_ghz: float
    channel: int
    signal_dbm: int
    standard: str
    encryption: str

    def __init__(
        self,
        interface_id: str,
        name: str,
        mac_address: str,
        frequency_ghz: float = 5.0,
        channel: int = 36,
        signal_dbm: int = -65,
        standard: str = "802.11ax",
        encryption: str = "WPA3",
        mtu: int = 1500,
    ) -> None:
        super().__init__(interface_id, name, mac_address, mtu)
        self.ssid = None
        self.frequency_ghz = frequency_ghz
        self.channel = channel
        self.signal_dbm = signal_dbm
        self.standard = standard
        self.encryption = encryption

    def connect(self, ssid: str) -> None:
        self.ssid = ssid
        self.is_up = True

    def disconnect(self) -> None:
        self.ssid = None
        self.is_up = False

    def signal_quality_pct(self) -> int:
        return min(100, max(0, 2 * (self.signal_dbm + 100)))

    def is_wifi6(self) -> bool:
        return self.standard in ("802.11ax", "802.11be")


class InfinibandInterface(NetworkInterface):
    speed_gbps: float
    port_width: int
    lid: int
    guid: str
    subnet_prefix: str

    def __init__(
        self,
        interface_id: str,
        name: str,
        mac_address: str,
        speed_gbps: float = 200.0,
        port_width: int = 4,
        lid: int = 0,
        guid: str = "",
        subnet_prefix: str = "0xfe80000000000000",
    ) -> None:
        super().__init__(interface_id, name, mac_address, mtu=4096)
        self.speed_gbps = speed_gbps
        self.port_width = port_width
        self.lid = lid
        self.guid = guid
        self.subnet_prefix = subnet_prefix

    def effective_bandwidth_gbps(self) -> float:
        return self.speed_gbps * self.port_width

    def is_hdr(self) -> bool:
        return self.speed_gbps >= 200.0
