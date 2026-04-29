from typing import Optional


class Animal:
    name: str
    species: str
    age: int
    weight_kg: float
    is_domesticated: bool
    habitat: str

    def __init__(
        self,
        name: str,
        species: str,
        age: int,
        weight_kg: float,
        is_domesticated: bool = False,
        habitat: str = "unknown",
    ) -> None:
        self.name = name
        self.species = species
        self.age = age
        self.weight_kg = weight_kg
        self.is_domesticated = is_domesticated
        self.habitat = habitat

    def speak(self) -> str:
        return f"{self.name} makes a sound."

    def describe(self) -> str:
        return f"{self.name} is a {self.species}, {self.age} years old, {self.weight_kg}kg."

    def is_adult(self) -> bool:
        return self.age >= 2

    def diet_type(self) -> str:
        return "omnivore"


class Dog(Animal):
    breed: str
    owner_name: Optional[str]
    tricks: list[str]
    is_neutered: bool

    def __init__(
        self,
        name: str,
        age: int,
        weight_kg: float,
        breed: str,
        owner_name: Optional[str] = None,
        is_neutered: bool = False,
    ) -> None:
        super().__init__(name, "Canis lupus familiaris", age, weight_kg, is_domesticated=True, habitat="home")
        self.breed = breed
        self.owner_name = owner_name
        self.tricks = []
        self.is_neutered = is_neutered

    def speak(self) -> str:
        return f"{self.name} barks: Woof!"

    def learn_trick(self, trick: str) -> None:
        self.tricks.append(trick)

    def perform(self) -> list[str]:
        return [f"{self.name} performs: {t}" for t in self.tricks]

    def diet_type(self) -> str:
        return "carnivore"


class Cat(Animal):
    indoor_only: bool
    favorite_toy: Optional[str]
    lives_left: int
    coat_pattern: str

    def __init__(
        self,
        name: str,
        age: int,
        weight_kg: float,
        indoor_only: bool = True,
        favorite_toy: Optional[str] = None,
        coat_pattern: str = "solid",
    ) -> None:
        super().__init__(name, "Felis catus", age, weight_kg, is_domesticated=True, habitat="home")
        self.indoor_only = indoor_only
        self.favorite_toy = favorite_toy
        self.lives_left = 9
        self.coat_pattern = coat_pattern

    def speak(self) -> str:
        return f"{self.name} meows!"

    def purr(self) -> str:
        return f"{self.name} purrs contentedly."

    def diet_type(self) -> str:
        return "carnivore"


class Bird(Animal):
    wingspan_cm: float
    can_fly: bool
    migratory: bool
    song_pattern: Optional[str]

    def __init__(
        self,
        name: str,
        species: str,
        age: int,
        weight_kg: float,
        wingspan_cm: float,
        can_fly: bool = True,
        migratory: bool = False,
        song_pattern: Optional[str] = None,
    ) -> None:
        super().__init__(name, species, age, weight_kg, habitat="sky/forest")
        self.wingspan_cm = wingspan_cm
        self.can_fly = can_fly
        self.migratory = migratory
        self.song_pattern = song_pattern

    def speak(self) -> str:
        if self.song_pattern:
            return f"{self.name} sings: {self.song_pattern}"
        return f"{self.name} chirps."

    def flight_range_km(self) -> Optional[float]:
        if not self.can_fly:
            return None
        return self.wingspan_cm * 10.0
