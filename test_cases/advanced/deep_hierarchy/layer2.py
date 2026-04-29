from layer1 import MotorizedTransport, NonMotorizedTransport
from typing import Optional


class RoadVehicle(MotorizedTransport):
    num_wheels: int
    has_abs: bool
    transmission: str
    drive_type: str

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
        num_wheels: int,
        fuel_type: str = "gasoline",
        has_abs: bool = True,
        transmission: str = "automatic",
        drive_type: str = "fwd",
        registration_id: Optional[str] = None,
    ) -> None:
        super().__init__(
            name, manufacturer, manufacture_year, max_speed_kmh, weight_kg,
            engine_type, horsepower, fuel_capacity_liters, fuel_type,
            registration_id=registration_id,
        )
        self.num_wheels = num_wheels
        self.has_abs = has_abs
        self.transmission = transmission
        self.drive_type = drive_type

    def is_awd(self) -> bool:
        return self.drive_type == "awd"

    def stopping_distance_m(self, speed_kmh: float) -> float:
        factor = 0.5 if self.has_abs else 0.7
        return (speed_kmh / 100) ** 2 * 100 * factor


class WaterVehicle(MotorizedTransport):
    hull_type: str
    draft_meters: float
    displacement_tons: float
    is_submersible: bool
    max_depth_meters: Optional[float]

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
        hull_type: str,
        draft_meters: float,
        displacement_tons: float,
        is_submersible: bool = False,
        max_depth_meters: Optional[float] = None,
    ) -> None:
        super().__init__(
            name, manufacturer, manufacture_year, max_speed_kmh, weight_kg,
            engine_type, horsepower, fuel_capacity_liters,
        )
        self.hull_type = hull_type
        self.draft_meters = draft_meters
        self.displacement_tons = displacement_tons
        self.is_submersible = is_submersible
        self.max_depth_meters = max_depth_meters

    def buoyancy_ratio(self) -> float:
        return self.displacement_tons * 1000 / self.weight_kg

    def is_seaworthy(self) -> bool:
        return self.buoyancy_ratio() > 1.0


class AirVehicle(MotorizedTransport):
    wingspan_m: Optional[float]
    service_ceiling_m: float
    thrust_kn: float
    num_engines: int
    is_vtol: bool

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
        service_ceiling_m: float,
        thrust_kn: float,
        num_engines: int = 2,
        wingspan_m: Optional[float] = None,
        is_vtol: bool = False,
        max_range_km: Optional[float] = None,
    ) -> None:
        super().__init__(
            name, manufacturer, manufacture_year, max_speed_kmh, weight_kg,
            engine_type, horsepower, fuel_capacity_liters, max_range_km=max_range_km,
        )
        self.wingspan_m = wingspan_m
        self.service_ceiling_m = service_ceiling_m
        self.thrust_kn = thrust_kn
        self.num_engines = num_engines
        self.is_vtol = is_vtol

    def thrust_to_weight_ratio(self) -> float:
        return (self.thrust_kn * 1000) / (self.weight_kg * 9.81)

    def is_supersonic(self) -> bool:
        return self.max_speed_kmh > 1235.0


class Bicycle(NonMotorizedTransport):
    num_gears: int
    frame_material: str
    has_electric_assist: bool
    assist_range_km: Optional[float]

    def __init__(
        self,
        name: str,
        manufacturer: str,
        manufacture_year: int,
        max_speed_kmh: float,
        weight_kg: float,
        num_gears: int = 21,
        frame_material: str = "aluminum",
        has_electric_assist: bool = False,
        assist_range_km: Optional[float] = None,
    ) -> None:
        super().__init__(
            name, manufacturer, manufacture_year, max_speed_kmh, weight_kg,
            propulsion="pedal" if not has_electric_assist else "pedal+electric",
        )
        self.num_gears = num_gears
        self.frame_material = frame_material
        self.has_electric_assist = has_electric_assist
        self.assist_range_km = assist_range_km

    def is_ebike(self) -> bool:
        return self.has_electric_assist

    def effective_range_km(self, rider_fitness: str = "average") -> float:
        base = {"low": 20.0, "average": 40.0, "high": 80.0}.get(rider_fitness, 40.0)
        if self.has_electric_assist and self.assist_range_km:
            return base + self.assist_range_km
        return base
