import { Messages } from '../../config';

export function WebViewOptions(): string {
    return `
<style>
  #export-btn {
    background: var(--pt-panel-bg);
    transition: background 0.15s ease;
  }
  #export-btn:hover {
    background: var(--pt-border);
  }
  #export-menu {
    position: absolute;
    top: calc(100% + 4px);
    right: 0;
    background: var(--pt-panel-bg);
    border: 1px solid var(--pt-border);
    border-radius: 6px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.5);
    overflow: hidden;
    opacity: 0;
    transform: translateY(-4px);
    pointer-events: none;
    transition: opacity 0.12s ease, transform 0.12s ease;
    white-space: nowrap;
    min-width: 100%;
    z-index: 10;
  }
  #export-menu.open {
    opacity: 1;
    transform: translateY(0);
    pointer-events: auto;
  }
  .export-menu-item {
    padding: 6px 10px;
    display: flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    font-size: 12px;
    color: var(--pt-text);
    user-select: none;
    transition: background 0.1s ease;
  }
  .export-menu-item:hover {
    background: var(--pt-border);
  }
</style>
<div
    style="
        position: fixed;
        top: 10px;
        right: 12px;
        display: flex;
        align-items: center;
        gap: 6px;
        z-index: 1000;
    "
>
    <div style="position: relative;">
        <div
            id="export-btn"
            style="
                border: 1px solid var(--pt-border);
                border-radius: 6px;
                padding: 6px 10px;
                display: flex;
                align-items: center;
                gap: 6px;
                box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
                cursor: pointer;
                color: var(--pt-text);
                font-size: 12px;
                user-select: none;
            "
        >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style="display:block;flex-shrink:0;">
                <path d="M6.5 1.5v6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                <path d="M4 5.5L6.5 8 9 5.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M1.5 11h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
            ${Messages.webView.options.export}
            <svg width="8" height="8" viewBox="0 0 8 8" fill="none" style="display:block;flex-shrink:0;opacity:0.6;">
                <path d="M1.5 2.5L4 5.5 6.5 2.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        </div>

        <div id="export-menu">
            <div id="export-as-svg" class="export-menu-item">
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style="display:block;flex-shrink:0;">
                    <path d="M1.5 10.5C1.5 10.5 4 2.5 6.5 2.5C9 2.5 11.5 7.5 11.5 7.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
                    <circle cx="1.5" cy="10.5" r="1.1" fill="currentColor"/>
                    <circle cx="6.5" cy="2.5" r="1.1" fill="currentColor"/>
                    <circle cx="11.5" cy="7.5" r="1.1" fill="currentColor"/>
                </svg>
                SVG
            </div>
            <div id="export-as-html" class="export-menu-item">
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style="display:block;flex-shrink:0;">
                    <path d="M5 3.5L2 6.5 5 9.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M8 3.5L11 6.5 8 9.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                HTML
            </div>
        </div>
    </div>

    <div
        id="paths-toggle"
        style="
            background: var(--pt-panel-bg);
            border: 1px solid var(--pt-border);
            border-radius: 6px;
            padding: 6px 10px;
            display: flex;
            align-items: center;
            gap: 6px;
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
                cursor: pointer;
                user-select: none;
            "
        >
            ${Messages.webView.options.showAllFilePaths}
        </label>
    </div>
</div>`;
}
