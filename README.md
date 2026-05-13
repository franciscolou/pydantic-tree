# PyTree

**PyTree** is a Visual Studio Code extension that renders interactive class inheritance trees for Python projects. For every class in the hierarchy it shows typed attributes and method signatures, highlights overridden members and abstract elements, and gives reference to all definitions — giving you an instant, accurate and interactive picture of any object model without leaving your editor.

---

## Features

### Simple Tree

Open a tree focused on the class under your cursor, showing all ancestor layers above it.

**Trigger:** `Ctrl + Alt + Space` · Command Palette: `PyTree: Class Tree` · Hover link

![Demo for Simple Tree](https://raw.githubusercontent.com/franciscolou/pytree/main/assets/gifs/simple.gif)

---

### Complete Tree

Same as the Simple Tree, but also scans the entire workspace to find every subclass and renders descendant layers below the focus class.

**Trigger:** `Ctrl + Alt + T` · Command Palette: `PyTree: Complete Class Tree` · Hover link

![Demo for Complete Tree](https://raw.githubusercontent.com/franciscolou/pytree/main/assets/gifs/complete.gif)

---

### Project Tree

Renders **all** Python classes in the workspace at once, grouped by their connected inheritance component and laid out in a grid. Useful for getting an overview of the full object model of a project.

**Trigger:** `Ctrl + Alt + P` · Command Palette: `PyTree: Project Tree`

![Demo for Project Tree](https://raw.githubusercontent.com/franciscolou/pytree/main/assets/gifs/project.gif)

---

### Pick Classes

Lets you hand-pick one or more classes from a searchable list and render them side by side in a single view. You choose the tree type (Simple or Complete) upfront, then select any number of classes from a multi-select quick-pick.

**Trigger:** Command Palette: `PyTree: Pick Classes...`

![Demo for Pick Classes Tree](https://raw.githubusercontent.com/franciscolou/pytree/main/assets/gifs/pick.gif)

---

### Change Inheritance (Drag & Drop)

In any tree view, click and drag an inheritance arrow off its current parent and drop it onto a different class to rewrite the inheritance directly in the source file. A confirmation dialog is always shown before the change is applied. If the new parent introduces attribute or method conflicts with the child, those conflicts are listed upfront so you can decide whether to proceed; otherwise a plain confirmation prompt asks you to verify the change. Cycles (where the new parent is already a descendant of the child) are blocked.

**Trigger:** Drag an inheritance arrow onto a different class

<!-- VIDEO PLACEHOLDER: drag-and-drop inheritance change demo -->

---

### Show All File Paths

A checkbox in the webview header toggles file-path labels on every class box. By default, paths are hidden and only appear on hover; enabling the checkbox keeps them permanently visible — handy when navigating a large workspace with classes spread across many files.

<!-- VIDEO PLACEHOLDER: file paths toggle demo -->

---

### Hover Integration

Hovering over any class name in a Python file shows a small card with two clickable links — **Show Class Tree** and **Show Complete Tree** — that open the corresponding view for that class without moving your cursor to the Command Palette.

<!-- VIDEO PLACEHOLDER: hover demo -->

---

## Colors and Symbols

Every class box uses color and symbols consistently across all tree views.

| Color / Symbol | Meaning |
| --- | --- |
| **Green header** background | Conventional (concrete) class |
| **Yellow-green header** background | Abstract class (`metaclass=ABCMeta` or inherits `ABC`) |
| **Blue** text | Attribute or property name |
| **Yellow** text | Method name |
| `(abc)` prefix before a method | Abstract method (`@abstractmethod`) |
| **Pink / purple** text | Attribute, property, or method overridden from a parent class |

Each class box groups members into labelled sections in order: **Attributes**, **Properties** (for `@property` members), then a divider, followed by **Class Methods**, **Static Methods**, and **Methods**. Only the sections that have members are rendered.

---

## Webview Interaction

Every tree view is fully interactive:

| Action               | How                                                                                |
| -------------------- | ---------------------------------------------------------------------------------- |
| **Pan**                  | Click and drag                                                                     |
| **Zoom**                 | Scroll wheel                                                                       |
| **Find**                 | `Ctrl+F` / `Cmd+F` — searches class names, methods, atributes, any text            |
| **Navigate matches**     | `Enter` / `Shift+Enter`, or the Next / Prev buttons                                |
| **Jump to source**       | Click any class name, attribute, or method — opens the file at the definition line |
| **Change inheritance**   | Drag an inheritance arrow onto a different class — confirms before rewriting       |

Pan position, zoom level, and the file-paths checkbox state are persisted per webview session.

---

## Commands & Shortcuts

| Command                        | Title                       | Shortcut         |
| ------------------------------ | --------------------------- | ---------------- |
| `pytree.showClassTree`         | PyTree: Class Tree          | `Ctrl+Alt+Space` |
| `pytree.showCompleteClassTree` | PyTree: Complete Class Tree | `Ctrl+Alt+T`     |
| `pytree.showProjectTree`       | PyTree: Project Tree        | `Ctrl+Alt+P`     |
| `pytree.pickClasses`           | PyTree: Pick Classes...     | —                |

---

## Requirements

- **Python** extension (for language support)
- **Pylance** (recommended) — PyTree uses VSCode's Language Server API (`DocumentSymbolProvider` and `DefinitionProvider`) to extract class structure and follow base class definitions across files. Pylance provides the richest symbol data, including inferred attribute types.

No additional configuration is needed. The extension activates automatically when you open a Python file.

---

## Limitations

**Only annotated class-level attributes are shown.** PyTree collects attributes declared with a type annotation at class body level (`name: Type` or `name: Type = value`). Attributes assigned only inside methods (`self.x = 42` in `__init__`, for example) without a corresponding class-level annotation are not displayed at all.

To have an attribute appear in the tree, declare it at class level:

```python
# Not shown — assignment only, no class-level annotation:
class MyClass:
    def __init__(self):
        self.value = 42

# Shown — class-level annotation present:
class MyClass:
    value: int

    def __init__(self):
        self.value = 42
```

This is intentional: it encourages explicit, typed class design and keeps the tree uncluttered.

**`@property` members appear in the Properties section, not Methods.** Properties are rendered as `name → ReturnType` to reflect their attribute-like access semantics. Setter and deleter overloads (`@x.setter`, `@x.deleter`) are not shown separately.

**Non-Python base classes are shown by name only.** If a base class is not resolvable within the workspace (e.g. a third-party library class), PyTree displays the name without expanding its members.
