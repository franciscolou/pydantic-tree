"""
Tier 4-5 — concrete widgets.

By longest path:
- Button, Menu, ProgressBar, Slider, TextField -> tier 4
- IconButton                                    -> tier 5

The naive (first-parent) layering will pull ProgressBar to tier 1
(Drawable + 1), distorting most of the tree.

Layer 4 has 5 siblings whose parents are spread across layer 3
(Container left, Widget right) — without the barycenter heuristic
their alphabetical order causes many edge crossings.
"""
from entities import Container, OrderedEntity, Sprite, Tracked, Widget
from protocols import Drawable


class Button(Widget):
    pass


class Slider(Widget):
    pass


class TextField(Widget, OrderedEntity):
    # Skip-edge: OrderedEntity is at tier 2, TextField at tier 4.
    pass


class Menu(Container, Tracked):
    pass


class ProgressBar(Container, Drawable):
    # Long skip-edge: Drawable is at tier 0, ProgressBar at tier 4.
    pass


class IconButton(Button, Sprite):
    # Diamond on VisibleEntity (Button -> Widget -> VisibleEntity;
    # Sprite -> VisibleEntity).
    pass
