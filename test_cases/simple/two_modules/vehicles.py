from base_vehicle import Vehicle
from typing import Optional


class Car(Vehicle):
    num_doors: int
    trunk_volume_liters: float
    has_sunroof: bool
    transmission: str

    def __init__(
        self,
        make: str,
        model: str,
        year: int,
        color: str,
        vin: str,
        num_doors: int = 4,
        trunk_volume_liters: float = 350.0,
        has_sunroof: bool = False,
        transmission: str = "automatic",
        fuel_type: str = "gasoline",
    ) -> None:
        super().__init__(make, model, year, color, vin, fuel_type)
        self.num_doors = num_doors
        self.trunk_volume_liters = trunk_volume_liters
        self.has_sunroof = has_sunroof
        self.transmission = transmission

    def cargo_rating(self) -> str:
        if self.trunk_volume_liters > 500:
            return "Large"
        elif self.trunk_volume_liters > 350:
            return "Medium"
        return "Small"

    def is_sedan(self) -> bool:
        return self.num_doors == 4


class Motorcycle(Vehicle):
    engine_cc: int
    has_sidecar: bool
    style: str
    abs_brakes: bool

    def __init__(
        self,
        make: str,
        model: str,
        year: int,
        color: str,
        vin: str,
        engine_cc: int,
        has_sidecar: bool = False,
        style: str = "cruiser",
        abs_brakes: bool = True,
    ) -> None:
        super().__init__(make, model, year, color, vin, fuel_type="gasoline")
        self.engine_cc = engine_cc
        self.has_sidecar = has_sidecar
        self.style = style
        self.abs_brakes = abs_brakes

    def is_sport(self) -> bool:
        return self.style == "sport"

    def legal_passengers(self) -> int:
        return 2 if not self.has_sidecar else 3


class Truck(Vehicle):
    payload_kg: float
    num_axles: int
    has_refrigeration: bool
    cargo_type: Optional[str]
    sleeper_cab: bool

    def __init__(
        self,
        make: str,
        model: str,
        year: int,
        color: str,
        vin: str,
        payload_kg: float,
        num_axles: int = 2,
        has_refrigeration: bool = False,
        cargo_type: Optional[str] = None,
        sleeper_cab: bool = False,
        fuel_type: str = "diesel",
    ) -> None:
        super().__init__(make, model, year, color, vin, fuel_type)
        self.payload_kg = payload_kg
        self.num_axles = num_axles
        self.has_refrigeration = has_refrigeration
        self.cargo_type = cargo_type
        self.sleeper_cab = sleeper_cab

    def can_carry(self, weight_kg: float) -> bool:
        return weight_kg <= self.payload_kg

    def requires_cdl(self) -> bool:
        return self.payload_kg > 11_793.0
