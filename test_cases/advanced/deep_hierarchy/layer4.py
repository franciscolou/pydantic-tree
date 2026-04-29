from layer3 import PassengerCar, FreightTruck
from typing import Optional


class ElectricCar(PassengerCar):
    battery_kwh: float
    charge_level_pct: float
    max_charge_rate_kw: float
    regen_braking: bool
    range_km: float
    charging_port_type: str

    def __init__(
        self,
        name: str,
        manufacturer: str,
        manufacture_year: int,
        max_speed_kmh: float,
        weight_kg: float,
        battery_kwh: float,
        range_km: float,
        max_charge_rate_kw: float = 50.0,
        num_seats: int = 5,
        num_doors: int = 4,
        has_sunroof: bool = False,
        regen_braking: bool = True,
        charging_port_type: str = "type2",
        registration_id: Optional[str] = None,
    ) -> None:
        super().__init__(
            name, manufacturer, manufacture_year, max_speed_kmh, weight_kg,
            engine_type="electric_motor", horsepower=battery_kwh * 1.34,
            fuel_capacity_liters=battery_kwh,
            fuel_type="electric",
            num_seats=num_seats, num_doors=num_doors, has_sunroof=has_sunroof,
            registration_id=registration_id,
        )
        self.battery_kwh = battery_kwh
        self.charge_level_pct = 100.0
        self.max_charge_rate_kw = max_charge_rate_kw
        self.regen_braking = regen_braking
        self.range_km = range_km
        self.charging_port_type = charging_port_type

    def remaining_range_km(self) -> float:
        return self.range_km * (self.charge_level_pct / 100.0)

    def charge_time_hours(self, target_pct: float = 100.0) -> float:
        needed_kwh = self.battery_kwh * (target_pct - self.charge_level_pct) / 100.0
        return max(0.0, needed_kwh / self.max_charge_rate_kw)

    def is_fast_chargeable(self) -> bool:
        return self.max_charge_rate_kw >= 50.0


class HybridCar(PassengerCar):
    electric_range_km: float
    battery_kwh: float
    combined_range_km: float
    hybrid_mode: str
    regen_braking: bool

    def __init__(
        self,
        name: str,
        manufacturer: str,
        manufacture_year: int,
        max_speed_kmh: float,
        weight_kg: float,
        engine_type: str,
        horsepower: float,
        fuel_capacity_liters: float,
        battery_kwh: float,
        electric_range_km: float,
        combined_range_km: float,
        hybrid_mode: str = "parallel",
        num_seats: int = 5,
        registration_id: Optional[str] = None,
    ) -> None:
        super().__init__(
            name, manufacturer, manufacture_year, max_speed_kmh, weight_kg,
            engine_type=engine_type, horsepower=horsepower,
            fuel_capacity_liters=fuel_capacity_liters,
            fuel_type="hybrid",
            num_seats=num_seats, registration_id=registration_id,
        )
        self.battery_kwh = battery_kwh
        self.electric_range_km = electric_range_km
        self.combined_range_km = combined_range_km
        self.hybrid_mode = hybrid_mode
        self.regen_braking = True

    def ev_ratio(self) -> float:
        return self.electric_range_km / self.combined_range_km

    def is_phev(self) -> bool:
        return self.battery_kwh >= 8.0


class SportsTruck(FreightTruck):
    zero_to_hundred_sec: float
    tow_rating_kg: float
    off_road_package: bool
    suspension_type: str
    bed_length_m: float

    def __init__(
        self,
        name: str,
        manufacturer: str,
        manufacture_year: int,
        max_speed_kmh: float,
        weight_kg: float,
        horsepower: float,
        fuel_capacity_liters: float,
        payload_kg: float,
        bed_length_m: float,
        tow_rating_kg: float = 5000.0,
        zero_to_hundred_sec: float = 6.5,
        off_road_package: bool = False,
        suspension_type: str = "coilover",
        registration_id: Optional[str] = None,
    ) -> None:
        super().__init__(
            name, manufacturer, manufacture_year, max_speed_kmh, weight_kg,
            engine_type="v8", horsepower=horsepower,
            fuel_capacity_liters=fuel_capacity_liters,
            payload_kg=payload_kg, cargo_volume_m3=bed_length_m * 1.5 * 0.5,
            num_axles=2, registration_id=registration_id,
        )
        self.zero_to_hundred_sec = zero_to_hundred_sec
        self.tow_rating_kg = tow_rating_kg
        self.off_road_package = off_road_package
        self.suspension_type = suspension_type
        self.bed_length_m = bed_length_m

    def is_performance_truck(self) -> bool:
        return self.zero_to_hundred_sec < 5.5

    def total_hauling_capacity_kg(self) -> float:
        return self.payload_kg + self.tow_rating_kg
