from enum import Enum
from typing import Optional, Callable, Any


class Alignment(Enum):
    LEFT = "left"
    CENTER = "center"
    RIGHT = "right"
    JUSTIFY = "justify"


class SizePolicy(Enum):
    FIXED = "fixed"
    EXPANDING = "expanding"
    MINIMUM = "minimum"
    PREFERRED = "preferred"


class EventType(Enum):
    CLICK = "click"
    DOUBLE_CLICK = "double_click"
    HOVER = "hover"
    FOCUS = "focus"
    BLUR = "blur"
    KEY_PRESS = "key_press"


class Widget:
    widget_id: str
    visible: bool
    enabled: bool
    width: int
    height: int
    background_color: Optional[str]
    tooltip: Optional[str]
    css_classes: list[str]

    def __init__(
        self,
        widget_id: str,
        width: int = 100,
        height: int = 30,
        background_color: Optional[str] = None,
        tooltip: Optional[str] = None,
    ) -> None:
        self.widget_id = widget_id
        self.visible = True
        self.enabled = True
        self.width = width
        self.height = height
        self.background_color = background_color
        self.tooltip = tooltip
        self.css_classes = []

    def show(self) -> None:
        self.visible = True

    def hide(self) -> None:
        self.visible = False

    def resize(self, width: int, height: int) -> None:
        self.width = width
        self.height = height

    def add_class(self, css_class: str) -> None:
        if css_class not in self.css_classes:
            self.css_classes.append(css_class)

    def bounding_box(self) -> tuple[int, int, int, int]:
        return (0, 0, self.width, self.height)

    def __repr__(self) -> str:
        return f"{self.__class__.__name__}({self.widget_id!r})"


class ClickableMixin:
    on_click: Optional[Callable[[], None]]
    on_double_click: Optional[Callable[[], None]]
    click_count: int
    is_pressed: bool

    def _init_clickable(
        self,
        on_click: Optional[Callable[[], None]] = None,
        on_double_click: Optional[Callable[[], None]] = None,
    ) -> None:
        self.on_click = on_click
        self.on_double_click = on_double_click
        self.click_count = 0
        self.is_pressed = False

    def handle_click(self) -> None:
        self.click_count += 1
        if self.on_click:
            self.on_click()

    def handle_double_click(self) -> None:
        if self.on_double_click:
            self.on_double_click()


class TextMixin:
    text: str
    font_size: int
    font_family: str
    text_color: str
    alignment: Alignment
    bold: bool
    italic: bool

    def _init_text(
        self,
        text: str = "",
        font_size: int = 12,
        font_family: str = "Arial",
        text_color: str = "#000000",
        alignment: Alignment = Alignment.LEFT,
        bold: bool = False,
        italic: bool = False,
    ) -> None:
        self.text = text
        self.font_size = font_size
        self.font_family = font_family
        self.text_color = text_color
        self.alignment = alignment
        self.bold = bold
        self.italic = italic

    def set_text(self, text: str) -> None:
        self.text = text

    def word_count(self) -> int:
        return len(self.text.split())

    def char_count(self) -> int:
        return len(self.text)


class FocusableMixin:
    is_focused: bool
    tab_index: int
    on_focus: Optional[Callable[[], None]]
    on_blur: Optional[Callable[[], None]]

    def _init_focusable(
        self,
        tab_index: int = 0,
        on_focus: Optional[Callable[[], None]] = None,
        on_blur: Optional[Callable[[], None]] = None,
    ) -> None:
        self.is_focused = False
        self.tab_index = tab_index
        self.on_focus = on_focus
        self.on_blur = on_blur

    def focus(self) -> None:
        self.is_focused = True
        if self.on_focus:
            self.on_focus()

    def blur(self) -> None:
        self.is_focused = False
        if self.on_blur:
            self.on_blur()


class Label(Widget, TextMixin):
    wrapping: bool
    max_lines: Optional[int]
    selectable: bool

    def __init__(
        self,
        widget_id: str,
        text: str = "",
        width: int = 200,
        height: int = 30,
        wrapping: bool = False,
        max_lines: Optional[int] = None,
        font_size: int = 12,
        alignment: Alignment = Alignment.LEFT,
        selectable: bool = False,
    ) -> None:
        Widget.__init__(self, widget_id, width, height)
        self._init_text(text, font_size, alignment=alignment)
        self.wrapping = wrapping
        self.max_lines = max_lines
        self.selectable = selectable

    def truncated_text(self, max_chars: int) -> str:
        if len(self.text) <= max_chars:
            return self.text
        return self.text[: max_chars - 3] + "..."


class Button(Widget, TextMixin, ClickableMixin, FocusableMixin):
    size_policy: SizePolicy
    is_default: bool
    icon_path: Optional[str]
    shortcut: Optional[str]

    def __init__(
        self,
        widget_id: str,
        text: str = "Button",
        width: int = 100,
        height: int = 35,
        on_click: Optional[Callable[[], None]] = None,
        size_policy: SizePolicy = SizePolicy.PREFERRED,
        is_default: bool = False,
        icon_path: Optional[str] = None,
        shortcut: Optional[str] = None,
    ) -> None:
        Widget.__init__(self, widget_id, width, height)
        self._init_text(text, alignment=Alignment.CENTER)
        self._init_clickable(on_click)
        self._init_focusable()
        self.size_policy = size_policy
        self.is_default = is_default
        self.icon_path = icon_path
        self.shortcut = shortcut


class TextInput(Widget, FocusableMixin):
    value: str
    placeholder: str
    max_length: Optional[int]
    is_password: bool
    on_change: Optional[Callable[[str], None]]

    def __init__(
        self,
        widget_id: str,
        placeholder: str = "",
        max_length: Optional[int] = None,
        is_password: bool = False,
        on_change: Optional[Callable[[str], None]] = None,
        width: int = 200,
        height: int = 30,
    ) -> None:
        Widget.__init__(self, widget_id, width, height)
        self._init_focusable()
        self.value = ""
        self.placeholder = placeholder
        self.max_length = max_length
        self.is_password = is_password
        self.on_change = on_change

    def set_value(self, text: str) -> None:
        if self.max_length is not None:
            text = text[: self.max_length]
        self.value = text
        if self.on_change:
            self.on_change(self.value)

    def clear(self) -> None:
        self.set_value("")

    def display_value(self) -> str:
        return "*" * len(self.value) if self.is_password else self.value


class Container(Widget):
    children: list[Widget]
    padding: tuple[int, int, int, int]
    spacing: int
    background_color: Optional[str]

    def __init__(
        self,
        widget_id: str,
        width: int = 400,
        height: int = 300,
        padding: tuple[int, int, int, int] = (8, 8, 8, 8),
        spacing: int = 4,
    ) -> None:
        super().__init__(widget_id, width, height)
        self.children = []
        self.padding = padding
        self.spacing = spacing

    def add_child(self, widget: Widget) -> None:
        self.children.append(widget)

    def remove_child(self, widget_id: str) -> Optional[Widget]:
        for i, child in enumerate(self.children):
            if child.widget_id == widget_id:
                return self.children.pop(i)
        return None

    def find_child(self, widget_id: str) -> Optional[Widget]:
        for child in self.children:
            if child.widget_id == widget_id:
                return child
        return None

    def child_count(self) -> int:
        return len(self.children)


class ScrollableContainer(Container):
    scroll_x: int
    scroll_y: int
    max_scroll_x: int
    max_scroll_y: int
    scroll_speed: float
    show_scrollbar: bool

    def __init__(
        self,
        widget_id: str,
        width: int = 400,
        height: int = 300,
        scroll_speed: float = 3.0,
        show_scrollbar: bool = True,
    ) -> None:
        super().__init__(widget_id, width, height)
        self.scroll_x = 0
        self.scroll_y = 0
        self.max_scroll_x = 0
        self.max_scroll_y = 0
        self.scroll_speed = scroll_speed
        self.show_scrollbar = show_scrollbar

    def scroll_to(self, x: int, y: int) -> None:
        self.scroll_x = max(0, min(x, self.max_scroll_x))
        self.scroll_y = max(0, min(y, self.max_scroll_y))

    def scroll_by(self, dx: int, dy: int) -> None:
        self.scroll_to(self.scroll_x + dx, self.scroll_y + dy)

    def scroll_to_top(self) -> None:
        self.scroll_to(self.scroll_x, 0)


class ModalContainer(Container, FocusableMixin):
    title: str
    is_open: bool
    on_close: Optional[Callable[[], None]]
    backdrop_click_closes: bool
    z_index: int

    def __init__(
        self,
        widget_id: str,
        title: str,
        width: int = 500,
        height: int = 400,
        on_close: Optional[Callable[[], None]] = None,
        backdrop_click_closes: bool = True,
        z_index: int = 1000,
    ) -> None:
        Container.__init__(self, widget_id, width, height)
        self._init_focusable()
        self.title = title
        self.is_open = False
        self.on_close = on_close
        self.backdrop_click_closes = backdrop_click_closes
        self.z_index = z_index

    def open(self) -> None:
        self.is_open = True
        self.show()
        self.focus()

    def close(self) -> None:
        self.is_open = False
        self.hide()
        self.blur()
        if self.on_close:
            self.on_close()
