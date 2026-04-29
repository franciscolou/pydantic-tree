from enum import Enum


class LengthUnit(Enum):
    METER = "m"
    CENTIMETER = "cm"
    MILLIMETER = "mm"
    INCH = "in"
    FOOT = "ft"
    KILOMETER = "km"


class WeightUnit(Enum):
    KILOGRAM = "kg"
    GRAM = "g"
    MILLIGRAM = "mg"
    POUND = "lb"
    OUNCE = "oz"


class TemperatureUnit(Enum):
    CELSIUS = "°C"
    FAHRENHEIT = "°F"
    KELVIN = "K"


class Length:
    value: float
    unit: LengthUnit

    _TO_METERS: dict[LengthUnit, float] = {
        LengthUnit.METER: 1.0,
        LengthUnit.CENTIMETER: 0.01,
        LengthUnit.MILLIMETER: 0.001,
        LengthUnit.INCH: 0.0254,
        LengthUnit.FOOT: 0.3048,
        LengthUnit.KILOMETER: 1000.0,
    }

    def __init__(self, value: float, unit: LengthUnit = LengthUnit.METER) -> None:
        self.value = value
        self.unit = unit

    def to(self, target: LengthUnit) -> "Length":
        meters = self.value * self._TO_METERS[self.unit]
        return Length(meters / self._TO_METERS[target], target)

    def __add__(self, other: "Length") -> "Length":
        total_m = self.to(LengthUnit.METER).value + other.to(LengthUnit.METER).value
        return Length(total_m, LengthUnit.METER)

    def __lt__(self, other: "Length") -> bool:
        return self.to(LengthUnit.METER).value < other.to(LengthUnit.METER).value

    def __repr__(self) -> str:
        return f"Length({self.value} {self.unit.value})"


class Weight:
    value: float
    unit: WeightUnit

    _TO_KG: dict[WeightUnit, float] = {
        WeightUnit.KILOGRAM: 1.0,
        WeightUnit.GRAM: 0.001,
        WeightUnit.MILLIGRAM: 1e-6,
        WeightUnit.POUND: 0.453592,
        WeightUnit.OUNCE: 0.0283495,
    }

    def __init__(self, value: float, unit: WeightUnit = WeightUnit.KILOGRAM) -> None:
        self.value = value
        self.unit = unit

    def to(self, target: WeightUnit) -> "Weight":
        kg = self.value * self._TO_KG[self.unit]
        return Weight(kg / self._TO_KG[target], target)

    def __add__(self, other: "Weight") -> "Weight":
        total_kg = self.to(WeightUnit.KILOGRAM).value + other.to(WeightUnit.KILOGRAM).value
        return Weight(total_kg, WeightUnit.KILOGRAM)

    def __repr__(self) -> str:
        return f"Weight({self.value} {self.unit.value})"


class Temperature:
    value: float
    unit: TemperatureUnit

    def __init__(self, value: float, unit: TemperatureUnit = TemperatureUnit.CELSIUS) -> None:
        self.value = value
        self.unit = unit

    def to_celsius(self) -> float:
        if self.unit == TemperatureUnit.CELSIUS:
            return self.value
        if self.unit == TemperatureUnit.FAHRENHEIT:
            return (self.value - 32) * 5 / 9
        return self.value - 273.15

    def to(self, target: TemperatureUnit) -> "Temperature":
        c = self.to_celsius()
        if target == TemperatureUnit.CELSIUS:
            return Temperature(c, target)
        if target == TemperatureUnit.FAHRENHEIT:
            return Temperature(c * 9 / 5 + 32, target)
        return Temperature(c + 273.15, target)

    def is_freezing(self) -> bool:
        return self.to_celsius() <= 0.0

    def __repr__(self) -> str:
        return f"Temperature({self.value}{self.unit.value})"
