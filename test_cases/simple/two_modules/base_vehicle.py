from datetime import date
from typing import Optional


class Vehicle:
    make: str
    model: str
    year: int
    color: str
    vin: str
    registration_date: Optional[date]
    mileage_km: float
    fuel_type: str

    def __init__(
        self,
        make: str,
        model: str,
        year: int,
        color: str,
        vin: str,
        fuel_type: str = "gasoline",
        registration_date: Optional[date] = None,
        mileage_km: float = 0.0,
    ) -> None:
        self.make = make
        self.model = model
        self.year = year
        self.color = color
        self.vin = vin
        self.fuel_type = fuel_type
        self.registration_date = registration_date
        self.mileage_km = mileage_km

    def age_years(self) -> int:
        return date.today().year - self.year

    def full_name(self) -> str:
        return f"{self.year} {self.make} {self.model}"

    def add_mileage(self, km: float) -> None:
        if km < 0:
            raise ValueError("Cannot add negative mileage.")
        self.mileage_km += km

    def needs_service(self, interval_km: float = 10_000.0) -> bool:
        return self.mileage_km % interval_km < 500.0

    def __repr__(self) -> str:
        return f"Vehicle({self.full_name()!r}, vin={self.vin!r})"
