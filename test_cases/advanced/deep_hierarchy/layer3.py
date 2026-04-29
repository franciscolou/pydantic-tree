from layer2 import RoadVehicle, WaterVehicle, AirVehicle
from typing import Optional


class PassengerCar(RoadVehicle):
    num_seats: int
    num_doors: int
    has_sunroof: bool
    trunk_liters: float
    safety_rating: Optional[float]

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
        fuel_type: str = "gasoline",
        num_seats: int = 5,
        num_doors: int = 4,
        has_sunroof: bool = False,
        trunk_liters: float = 350.0,
        safety_rating: Optional[float] = None,
        registration_id: Optional[str] = None,
    ) -> None:
        super().__init__(
            name, manufacturer, manufacture_year, max_speed_kmh, weight_kg,
            engine_type, horsepower, fuel_capacity_liters, num_wheels=4,
            fuel_type=fuel_type, registration_id=registration_id,
        )
        self.num_seats = num_seats
        self.num_doors = num_doors
        self.has_sunroof = has_sunroof
        self.trunk_liters = trunk_liters
        self.safety_rating = safety_rating

    def is_family_sized(self) -> bool:
        return self.num_seats >= 5

    def passenger_volume_ratio(self) -> float:
        return self.num_seats / self.weight_kg * 1000


class FreightTruck(RoadVehicle):
    payload_kg: float
    cargo_volume_m3: float
    num_axles: int
    has_refrigeration: bool
    coupling_type: str

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
        payload_kg: float,
        cargo_volume_m3: float,
        num_axles: int = 4,
        has_refrigeration: bool = False,
        coupling_type: str = "fifth_wheel",
        registration_id: Optional[str] = None,
    ) -> None:
        super().__init__(
            name, manufacturer, manufacture_year, max_speed_kmh, weight_kg,
            engine_type, horsepower, fuel_capacity_liters, num_wheels=num_axles * 2,
            fuel_type="diesel", registration_id=registration_id,
        )
        self.payload_kg = payload_kg
        self.cargo_volume_m3 = cargo_volume_m3
        self.num_axles = num_axles
        self.has_refrigeration = has_refrigeration
        self.coupling_type = coupling_type

    def gross_weight_kg(self) -> float:
        return self.weight_kg + self.payload_kg

    def can_haul(self, weight_kg: float) -> bool:
        return weight_kg <= self.payload_kg


class Motorboat(WaterVehicle):
    beam_m: float
    length_m: float
    max_passengers: int
    has_cabin: bool
    berthing_count: int

    def __init__(
        self,
        name: str,
        manufacturer: str,
        manufacture_year: int,
        max_speed_kmh: float,
        weight_kg: float,
        horsepower: float,
        fuel_capacity_liters: float,
        beam_m: float,
        length_m: float,
        max_passengers: int = 6,
        has_cabin: bool = False,
        berthing_count: int = 0,
    ) -> None:
        super().__init__(
            name, manufacturer, manufacture_year, max_speed_kmh, weight_kg,
            engine_type="inboard", horsepower=horsepower,
            fuel_capacity_liters=fuel_capacity_liters,
            hull_type="planing", draft_meters=beam_m * 0.1,
            displacement_tons=weight_kg / 1000,
        )
        self.beam_m = beam_m
        self.length_m = length_m
        self.max_passengers = max_passengers
        self.has_cabin = has_cabin
        self.berthing_count = berthing_count

    def is_yacht(self) -> bool:
        return self.length_m >= 12.0 and self.has_cabin

    def loa_to_beam_ratio(self) -> float:
        return self.length_m / self.beam_m


class Sailplane(AirVehicle):
    glide_ratio: float
    min_sink_rate_ms: float
    water_ballast_liters: float
    has_sustainer: bool

    def __init__(
        self,
        name: str,
        manufacturer: str,
        manufacture_year: int,
        weight_kg: float,
        wingspan_m: float,
        glide_ratio: float,
        min_sink_rate_ms: float,
        service_ceiling_m: float = 8000.0,
        water_ballast_liters: float = 0.0,
        has_sustainer: bool = False,
    ) -> None:
        super().__init__(
            name, manufacturer, manufacture_year,
            max_speed_kmh=280.0, weight_kg=weight_kg,
            engine_type="none" if not has_sustainer else "electric_sustainer",
            horsepower=0.0 if not has_sustainer else 25.0,
            fuel_capacity_liters=0.0,
            service_ceiling_m=service_ceiling_m,
            thrust_kn=0.0,
            num_engines=0 if not has_sustainer else 1,
            wingspan_m=wingspan_m,
        )
        self.glide_ratio = glide_ratio
        self.min_sink_rate_ms = min_sink_rate_ms
        self.water_ballast_liters = water_ballast_liters
        self.has_sustainer = has_sustainer

    def max_glide_distance_m(self, altitude_m: float) -> float:
        return altitude_m * self.glide_ratio

    def aspect_ratio(self) -> Optional[float]:
        if self.wingspan_m is None:
            return None
        return self.wingspan_m**2 / (self.wingspan_m * 0.15)
