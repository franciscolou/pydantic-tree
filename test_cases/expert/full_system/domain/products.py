from core.base import AggregateRoot
from core.mixins import ObservableMixin
from typing import Optional
from datetime import datetime


class Product(AggregateRoot, ObservableMixin):
    sku: str
    name: str
    description: str
    price: float
    currency: str
    category: str
    tags: list[str]
    is_active: bool
    created_at: datetime
    stock_count: int

    def __init__(
        self,
        sku: str,
        name: str,
        description: str,
        price: float,
        category: str,
        currency: str = "USD",
        stock_count: int = 0,
        object_id: Optional[str] = None,
    ) -> None:
        AggregateRoot.__init__(self, object_id)
        self._init_observable()
        self.sku = sku
        self.name = name
        self.description = description
        self.price = price
        self.currency = currency
        self.category = category
        self.tags = []
        self.is_active = True
        self.created_at = datetime.utcnow()
        self.stock_count = stock_count

    def update_price(self, new_price: float) -> None:
        old_price = self.price
        self.price = new_price
        self.apply({"type": "price_changed", "from": old_price, "to": new_price})
        self.emit("price_changed", old_price, new_price)

    def add_tag(self, tag: str) -> None:
        if tag not in self.tags:
            self.tags.append(tag)

    def deactivate(self) -> None:
        self.is_active = False
        self.apply({"type": "deactivated"})

    def is_in_stock(self) -> bool:
        return self.stock_count > 0


class PhysicalProduct(Product):
    weight_kg: float
    dimensions_cm: tuple[float, float, float]
    requires_shipping: bool
    fragile: bool
    country_of_origin: str
    hs_code: Optional[str]

    def __init__(
        self,
        sku: str,
        name: str,
        description: str,
        price: float,
        category: str,
        weight_kg: float,
        dimensions_cm: tuple[float, float, float],
        country_of_origin: str = "US",
        fragile: bool = False,
        hs_code: Optional[str] = None,
        stock_count: int = 0,
    ) -> None:
        super().__init__(sku, name, description, price, category, stock_count=stock_count)
        self.weight_kg = weight_kg
        self.dimensions_cm = dimensions_cm
        self.requires_shipping = True
        self.fragile = fragile
        self.country_of_origin = country_of_origin
        self.hs_code = hs_code

    def volume_cm3(self) -> float:
        l, w, h = self.dimensions_cm
        return l * w * h

    def shipping_class(self) -> str:
        if self.weight_kg > 30:
            return "freight"
        if self.weight_kg > 5:
            return "heavy"
        return "standard"


class DigitalProduct(Product):
    download_url: Optional[str]
    file_size_mb: float
    file_format: str
    license_type: str
    max_downloads: Optional[int]
    version: str

    def __init__(
        self,
        sku: str,
        name: str,
        description: str,
        price: float,
        category: str,
        file_size_mb: float,
        file_format: str,
        license_type: str = "single_user",
        version: str = "1.0.0",
        max_downloads: Optional[int] = None,
        download_url: Optional[str] = None,
    ) -> None:
        super().__init__(sku, name, description, price, category, stock_count=99999)
        self.download_url = download_url
        self.file_size_mb = file_size_mb
        self.file_format = file_format
        self.license_type = license_type
        self.max_downloads = max_downloads
        self.version = version

    def is_unlimited_downloads(self) -> bool:
        return self.max_downloads is None

    def is_enterprise_license(self) -> bool:
        return self.license_type in ("enterprise", "site", "unlimited")


class BundleProduct(Product):
    items: list[Product]
    discount_pct: float
    requires_all_in_stock: bool

    def __init__(
        self,
        sku: str,
        name: str,
        description: str,
        category: str,
        items: Optional[list[Product]] = None,
        discount_pct: float = 0.0,
        requires_all_in_stock: bool = True,
    ) -> None:
        items = items or []
        base_price = sum(i.price for i in items) * (1 - discount_pct / 100)
        super().__init__(sku, name, description, base_price, category, stock_count=0)
        self.items = items
        self.discount_pct = discount_pct
        self.requires_all_in_stock = requires_all_in_stock

    def is_in_stock(self) -> bool:
        if self.requires_all_in_stock:
            return all(i.is_in_stock() for i in self.items)
        return any(i.is_in_stock() for i in self.items)

    def savings(self) -> float:
        return sum(i.price for i in self.items) - self.price

    def item_count(self) -> int:
        return len(self.items)
