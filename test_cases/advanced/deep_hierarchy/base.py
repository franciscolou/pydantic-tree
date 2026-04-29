from typing import Optional
from datetime import date


class Transport:
    name: str
    manufacturer: str
    manufacture_year: int
    max_speed_kmh: float
    max_range_km: Optional[float]
    weight_kg: float
    registration_id: Optional[str]

    def __init__(
        self,
        name: str,
        manufacturer: str,
        manufacture_year: int,
        max_speed_kmh: float,
        weight_kg: float,
        max_range_km: Optional[float] = None,
        registration_id: Optional[str] = None,
    ) -> None:
        self.name = name
        self.manufacturer = manufacturer
        self.manufacture_year = manufacture_year
        self.max_speed_kmh = max_speed_kmh
        self.weight_kg = weight_kg
        self.max_range_km = max_range_km
        self.registration_id = registration_id

    def age_years(self) -> int:
        return date.today().year - self.manufacture_year

    def is_registered(self) -> bool:
        return self.registration_id is not None

    def speed_class(self) -> str:
        if self.max_speed_kmh >= 300:
            return "supersonic"
        if self.max_speed_kmh >= 150:
            return "fast"
        if self.max_speed_kmh >= 60:
            return "moderate"
        return "slow"

    def __repr__(self) -> str:
        return f"{self.__class__.__name__}({self.name!r}, {self.manufacturer!r})"
