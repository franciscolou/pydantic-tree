export function FindBar(): string {
    return `
<div
    id="find-bar"
    style="
        display: none;
        position: fixed;
        top: 10px;
        left: 50%;
        transform: translateX(-50%);
        background: var(--pt-panel-bg);
        border: 1px solid var(--pt-border);
        border-radius: 6px;
        padding: 6px 10px;
        align-items: center;
        gap: 8px;
        z-index: 1000;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
    "
>
    <input
        id="find-input"
        type="text"
        placeholder="Find in tree…"
        autocomplete="off"
        spellcheck="false"
        style="
            background: var(--pt-bg);
            border: 1px solid var(--pt-border);
            color: var(--pt-text);
            padding: 4px 8px;
            border-radius: 3px;
            outline: none;
            width: 200px;
            font-size: 13px;
            font-family: monospace;
        "
    />

    <span
        id="find-count"
        style="
            color: #888;
            font-size: 12px;
            min-width: 60px;
            text-align: center;
        "
    ></span>

    <button id="find-prev" title="Previous (Shift+Enter)">
        ↑
    </button>

    <button id="find-next" title="Next (Enter)">
        ↓
    </button>

    <button id="find-close" title="Close (Escape)">
        ✕
    </button>
</div>`;
}