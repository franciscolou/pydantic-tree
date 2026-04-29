from base import Transport
from typing import Optional


class MotorizedTransport(Transport):
    engine_type: str
    horsepower: float
    fuel_capacity_liters: float
    fuel_type: str
    current_fuel_liters: float

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
        max_range_km: Optional[float] = None,
        registration_id: Optional[str] = None,
    ) -> None:
        super().__init__(name, manufacturer, manufacture_year, max_speed_kmh, weight_kg, max_range_km, registration_id)
        self.engine_type = engine_type
        self.horsepower = horsepower
        self.fuel_capacity_liters = fuel_capacity_liters
        self.fuel_type = fuel_type
        self.current_fuel_liters = fuel_capacity_liters

    def fuel_percentage(self) -> float:
        return self.current_fuel_liters / self.fuel_capacity_liters * 100

    def refuel(self, liters: float) -> None:
        self.current_fuel_liters = min(
            self.fuel_capacity_liters,
            self.current_fuel_liters + liters,
        )

    def is_electric(self) -> bool:
        return self.fuel_type == "electric"

    def power_to_weight_ratio(self) -> float:
        return self.horsepower / self.weight_kg


class NonMotorizedTransport(Transport):
    propulsion: str
    requires_operator: bool
    passenger_capacity: int

    def __init__(
        self,
        name: str,
        manufacturer: str,
        manufacture_year: int,
        max_speed_kmh: float,
        weight_kg: float,
        propulsion: str,
        passenger_capacity: int = 1,
        requires_operator: bool = True,
    ) -> None:
        super().__init__(name, manufacturer, manufacture_year, max_speed_kmh, weight_kg)
        self.propulsion = propulsion
        self.requires_operator = requires_operator
        self.passenger_capacity = passenger_capacity

    def is_human_powered(self) -> bool:
        return self.propulsion in ("pedal", "rowing", "sail", "human")

    def eco_score(self) -> int:
        return 10 if self.is_human_powered() else 6
