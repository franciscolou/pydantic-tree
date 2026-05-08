import { Messages } from '../../config';

export function PathsToggle(): string {
    return `
<div
    id="paths-toggle"
    style="
        position: fixed;
        top: 10px;
        right: 12px;
        background: var(--pt-panel-bg);
        border: 1px solid var(--pt-border);
        border-radius: 6px;
        padding: 6px 10px;
        display: flex;
        align-items: center;
        gap: 6px;
        z-index: 1000;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
    "
>
    <input
        type="checkbox"
        id="show-paths-cb"
        style="outline: none;"
    />

    <label
        for="show-paths-cb"
        style="
            color: var(--pt-text);
            font-size: 12px;
        "
    >
        ${Messages.options.showAllFilePaths}
    </label>
</div>`;
}