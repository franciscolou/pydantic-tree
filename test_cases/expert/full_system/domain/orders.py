from core.base import DomainObject, AggregateRoot
from core.mixins import ObservableMixin, StateMachineMixin, EventSourcedMixin
from domain.products import Product
from typing import Optional
from datetime import datetime


class OrderLine(DomainObject):
    product: Product
    quantity: int
    unit_price: float
    discount_pct: float
    notes: Optional[str]

    def __init__(
        self,
        product: Product,
        quantity: int,
        unit_price: Optional[float] = None,
        discount_pct: float = 0.0,
        notes: Optional[str] = None,
    ) -> None:
        super().__init__()
        self.product = product
        self.quantity = quantity
        self.unit_price = unit_price if unit_price is not None else product.price
        self.discount_pct = discount_pct
        self.notes = notes

    def subtotal(self) -> float:
        return self.unit_price * self.quantity * (1 - self.discount_pct / 100)

    def effective_unit_price(self) -> float:
        return self.unit_price * (1 - self.discount_pct / 100)

    def update_quantity(self, qty: int) -> None:
        if qty <= 0:
            raise ValueError("Quantity must be positive.")
        self.quantity = qty


class Order(AggregateRoot, ObservableMixin, EventSourcedMixin):
    order_number: str
    customer_id: str
    lines: list[OrderLine]
    shipping_address: str
    billing_address: str
    currency: str
    placed_at: Optional[datetime]
    notes: Optional[str]
    coupon_code: Optional[str]
    discount_amount: float

    def __init__(
        self,
        order_number: str,
        customer_id: str,
        shipping_address: str,
        billing_address: str,
        currency: str = "USD",
        coupon_code: Optional[str] = None,
        object_id: Optional[str] = None,
    ) -> None:
        AggregateRoot.__init__(self, object_id)
        self._init_observable()
        self._init_event_sourced()
        self.order_number = order_number
        self.customer_id = customer_id
        self.lines = []
        self.shipping_address = shipping_address
        self.billing_address = billing_address
        self.currency = currency
        self.placed_at = None
        self.notes = None
        self.coupon_code = coupon_code
        self.discount_amount = 0.0

    def add_line(self, line: OrderLine) -> None:
        self.lines.append(line)
        self.record_event("line_added", {"product_sku": line.product.sku, "qty": line.quantity})

    def remove_line(self, product_sku: str) -> Optional[OrderLine]:
        for i, line in enumerate(self.lines):
            if line.product.sku == product_sku:
                removed = self.lines.pop(i)
                self.record_event("line_removed", {"product_sku": product_sku})
                return removed
        return None

    def subtotal(self) -> float:
        return sum(line.subtotal() for line in self.lines)

    def total(self) -> float:
        return max(0.0, self.subtotal() - self.discount_amount)

    def place(self) -> None:
        self.placed_at = datetime.utcnow()
        self.apply({"type": "order_placed", "order_number": self.order_number})
        self.record_event("placed", {"total": self.total(), "customer_id": self.customer_id})
        self.emit("placed", self)

    def line_count(self) -> int:
        return len(self.lines)


class SubscriptionOrder(Order, StateMachineMixin):
    plan_id: str
    billing_cycle: str
    next_billing_date: Optional[datetime]
    trial_ends_at: Optional[datetime]
    renewal_count: int
    auto_renew: bool
    cancel_at_period_end: bool

    def __init__(
        self,
        order_number: str,
        customer_id: str,
        plan_id: str,
        shipping_address: str,
        billing_address: str,
        billing_cycle: str = "monthly",
        auto_renew: bool = True,
        currency: str = "USD",
        object_id: Optional[str] = None,
    ) -> None:
        Order.__init__(
            self, order_number, customer_id, shipping_address, billing_address,
            currency, object_id=object_id,
        )
        self._init_state_machine("pending")
        self.add_transition("pending", "activate", "active")
        self.add_transition("active", "pause", "paused")
        self.add_transition("paused", "resume", "active")
        self.add_transition("active", "cancel", "cancelled")
        self.add_transition("paused", "cancel", "cancelled")
        self.add_transition("active", "expire", "expired")
        self.plan_id = plan_id
        self.billing_cycle = billing_cycle
        self.next_billing_date = None
        self.trial_ends_at = None
        self.renewal_count = 0
        self.auto_renew = auto_renew
        self.cancel_at_period_end = False

    def activate(self, next_billing: datetime, trial_ends: Optional[datetime] = None) -> bool:
        if not self.trigger("activate"):
            return False
        self.next_billing_date = next_billing
        self.trial_ends_at = trial_ends
        self.record_event("activated", {"plan_id": self.plan_id})
        self.emit("activated", self)
        return True

    def renew(self, next_billing: datetime) -> None:
        self.renewal_count += 1
        self.next_billing_date = next_billing
        self.record_event("renewed", {"renewal_count": self.renewal_count})

    def is_trial(self) -> bool:
        if self.trial_ends_at is None:
            return False
        return datetime.utcnow() < self.trial_ends_at

    def is_annual(self) -> bool:
        return self.billing_cycle == "annual"
