"""
Real-world ORM (3/3): concrete entity models.
Combines: many mixins, attr redefinition, multi-line attr defaults, @classmethod.
"""
from __future__ import annotations
from typing import Any
from base import SoftDeleteModel, TimestampedModel
from fields import ForeignKeyField, IntField, StringField


class User(SoftDeleteModel):
    _table_name: str = "users"

    username: StringField = StringField.char_field(max_length=64, unique=True, index=True)
    email: StringField = StringField.email_field()
    password_hash: StringField = StringField.char_field(max_length=128)
    display_name: StringField = StringField(required=False, nullable=True)
    avatar_url: StringField = StringField(required=False, nullable=True)
    locale: StringField = StringField(required=False, default="en-US")
    timezone: StringField = StringField(required=False, default="UTC")
    is_active: bool = True
    is_staff: bool = False
    is_superuser: bool = False
    last_login_at: StringField = StringField(required=False, nullable=True)
    login_count: IntField = IntField(default=0, min_value=0)

    def __repr__(self) -> str:
        return f"<User {self.username!r}>"

    @classmethod
    def for_email(cls, email: str) -> "User":
        obj = cls.__new__(cls)
        obj.email = email
        return obj

    @staticmethod
    def hash_password(raw: str, salt: str = "") -> str:
        import hashlib
        return hashlib.sha256((raw + salt).encode()).hexdigest()

    @staticmethod
    def validate_username(username: str) -> bool:
        import re
        return bool(re.fullmatch(r"[a-zA-Z0-9_.-]{3,64}", username))


class Product(TimestampedModel):
    _table_name: str = "products"

    name: StringField = StringField.char_field(max_length=256)
    slug: StringField = StringField.char_field(max_length=256, unique=True, index=True)
    description: StringField = StringField.text_field()
    price_cents: IntField = IntField(min_value=0)
    compare_at_price_cents: IntField = IntField(required=False, nullable=True, min_value=0)
    sku: StringField = StringField.char_field(max_length=128, unique=True)
    barcode: StringField = StringField(required=False, nullable=True)
    inventory_quantity: IntField = IntField(default=0, min_value=0)
    is_published: bool = False
    is_digital: bool = False
    weight_grams: IntField = IntField(required=False, nullable=True, min_value=0)
    vendor: StringField = StringField(required=False, nullable=True)
    tags_json: StringField = StringField(required=False, nullable=True)

    def __repr__(self) -> str:
        return f"<Product {self.sku!r}>"

    @property
    def price(self) -> float:
        return self.price_cents / 100.0

    @classmethod
    def draft(cls, name: str, sku: str) -> "Product":
        obj = cls.__new__(cls)
        obj.name = name
        obj.sku = sku
        obj.is_published = False
        return obj

    @classmethod
    def published(cls, name: str, sku: str, price_cents: int) -> "Product":
        obj = cls.draft(name, sku)
        obj.price_cents = price_cents
        obj.is_published = True
        return obj


class Order(SoftDeleteModel):
    _table_name: str = "orders"

    order_number: StringField = StringField.char_field(max_length=64, unique=True)
    user_id: ForeignKeyField = ForeignKeyField("User")
    status: StringField = StringField(
        choices=[
            "pending",
            "confirmed",
            "processing",
            "shipped",
            "delivered",
            "cancelled",
            "refunded",
        ],
        default="pending",
    )
    subtotal_cents: IntField = IntField(min_value=0)
    tax_cents: IntField = IntField(default=0, min_value=0)
    shipping_cents: IntField = IntField(default=0, min_value=0)
    discount_cents: IntField = IntField(default=0, min_value=0)
    currency: StringField = StringField(default="USD")
    shipping_address: StringField = StringField(required=False, nullable=True)
    billing_address: StringField = StringField(required=False, nullable=True)
    notes: StringField = StringField(required=False, nullable=True)
    confirmed_at: StringField = StringField(required=False, nullable=True)
    shipped_at: StringField = StringField(required=False, nullable=True)
    delivered_at: StringField = StringField(required=False, nullable=True)

    def __repr__(self) -> str:
        return f"<Order {self.order_number!r}>"

    @property
    def total_cents(self) -> int:
        return (
            self.subtotal_cents
            + self.tax_cents
            + self.shipping_cents
            - self.discount_cents
        )

    @classmethod
    def pending_for_user(cls, user_id: int) -> "Order":
        obj = cls.__new__(cls)
        obj.user_id = user_id
        obj.status = "pending"
        return obj

    @staticmethod
    def generate_order_number(prefix: str = "ORD") -> str:
        import uuid
        return f"{prefix}-{uuid.uuid4().hex[:8].upper()}"
