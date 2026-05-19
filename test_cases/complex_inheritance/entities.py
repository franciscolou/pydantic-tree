"""
Tier 1-3 — entities and composites.

Layering by longest path:
- Entity              -> tier 1
- OrderedEntity       -> tier 2
- StoredEntity        -> tier 2
- VisibleEntity       -> tier 2
- Widget, Sprite,
  Container, Tracked  -> tier 3

The naive (first-parent) layering will collapse:
- Sprite to tier 1 (Drawable + 1) — should be tier 3.
- Tracked to tier 1 (Base + 1) — should be tier 3.
"""
from protocols import Base, Comparable, Drawable, Serializable


class Entity(Base):
    pass


class StoredEntity(Entity, Serializable):
    pass


class OrderedEntity(Entity, Comparable):
    pass


class VisibleEntity(Entity, Drawable):
    pass


# --- Composites: each one is a diamond or skip-edge. ---

class Widget(VisibleEntity, StoredEntity):
    # Diamond on Entity (and on Base).
    pass


class Sprite(Drawable, VisibleEntity):
    # Diamond on Drawable — VisibleEntity already carries Drawable.
    pass


class Container(VisibleEntity, StoredEntity, OrderedEntity):
    # Triple diamond on Entity.
    pass


class Tracked(StoredEntity, Base):
    # Skip-edge: Base is already inherited via Entity. Naive layering will
    # mis-place this class right under Base.
    pass
