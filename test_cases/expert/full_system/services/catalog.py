from core.mixins import ObservableMixin
from domain.products import Product, PhysicalProduct, DigitalProduct, BundleProduct
from typing import Optional, Callable
from datetime import datetime


class CatalogService(ObservableMixin):
    catalog_id: str
    name: str
    products: dict[str, Product]
    categories: dict[str, list[str]]
    is_published: bool
    created_at: datetime

    def __init__(self, catalog_id: str, name: str) -> None:
        self._init_observable()
        self.catalog_id = catalog_id
        self.name = name
        self.products = {}
        self.categories = {}
        self.is_published = False
        self.created_at = datetime.utcnow()

    def add_product(self, product: Product) -> None:
        self.products[product.sku] = product
        self.categories.setdefault(product.category, []).append(product.sku)
        self.emit("product_added", product)

    def remove_product(self, sku: str) -> Optional[Product]:
        product = self.products.pop(sku, None)
        if product:
            cat = self.categories.get(product.category, [])
            if sku in cat:
                cat.remove(sku)
            self.emit("product_removed", product)
        return product

    def get_product(self, sku: str) -> Optional[Product]:
        return self.products.get(sku)

    def products_in_category(self, category: str) -> list[Product]:
        skus = self.categories.get(category, [])
        return [self.products[s] for s in skus if s in self.products]

    def publish(self) -> None:
        self.is_published = True
        self.emit("published", self)

    def product_count(self) -> int:
        return len(self.products)


class SearchableCatalog(CatalogService):
    _index: dict[str, set[str]]
    search_history: list[dict[str, str]]
    max_results: int
    stemming_enabled: bool

    def __init__(
        self,
        catalog_id: str,
        name: str,
        max_results: int = 50,
        stemming_enabled: bool = False,
    ) -> None:
        super().__init__(catalog_id, name)
        self._index = {}
        self.search_history = []
        self.max_results = max_results
        self.stemming_enabled = stemming_enabled

    def add_product(self, product: Product) -> None:
        super().add_product(product)
        self._index_product(product)

    def _index_product(self, product: Product) -> None:
        tokens = (product.name + " " + product.description + " " + product.category).lower().split()
        for token in tokens:
            self._index.setdefault(token, set()).add(product.sku)

    def search(self, query: str, category: Optional[str] = None) -> list[Product]:
        self.search_history.append({"query": query, "at": datetime.utcnow().isoformat()})
        tokens = query.lower().split()
        if not tokens:
            return []
        matching_skus = set.intersection(*[self._index.get(t, set()) for t in tokens])
        results = [self.products[s] for s in matching_skus if s in self.products]
        if category:
            results = [p for p in results if p.category == category]
        return results[: self.max_results]

    def top_searches(self, n: int = 10) -> list[str]:
        from collections import Counter
        queries = [h["query"] for h in self.search_history]
        return [q for q, _ in Counter(queries).most_common(n)]

    def rebuild_index(self) -> None:
        self._index.clear()
        for product in self.products.values():
            self._index_product(product)


class MultiTenantCatalog(SearchableCatalog):
    tenant_id: str
    tenant_name: str
    parent_catalog_id: Optional[str]
    overrides: dict[str, dict[str, str]]
    locale: str
    currency: str

    def __init__(
        self,
        catalog_id: str,
        name: str,
        tenant_id: str,
        tenant_name: str,
        locale: str = "en-US",
        currency: str = "USD",
        parent_catalog_id: Optional[str] = None,
        max_results: int = 50,
    ) -> None:
        super().__init__(catalog_id, name, max_results)
        self.tenant_id = tenant_id
        self.tenant_name = tenant_name
        self.parent_catalog_id = parent_catalog_id
        self.overrides = {}
        self.locale = locale
        self.currency = currency

    def override_product(self, sku: str, overrides: dict[str, str]) -> None:
        self.overrides[sku] = {**self.overrides.get(sku, {}), **overrides}

    def get_localized_name(self, sku: str) -> Optional[str]:
        return self.overrides.get(sku, {}).get("name")

    def is_regional_catalog(self) -> bool:
        return self.parent_catalog_id is not None
