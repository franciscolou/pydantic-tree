export const Theme = {
    colors: {
        background:   'var(--pt-bg)',
        panelBackground: 'var(--pt-panel-bg)',
        border:       'var(--pt-border)',

        headerBackground: 'var(--pt-header-bg)',
        headerText:   'var(--pt-header-text)',

        text:         'var(--pt-text)',
        type:         'var(--pt-type)',
        string:       'var(--pt-string)',
        attribute:    'var(--pt-attribute)',
        method:       'var(--pt-method)',
        override:     'var(--pt-override)',

        edge:         'var(--pt-edge)',
        edgePalette: [
            'var(--pt-edge-0)',
            'var(--pt-edge-1)',
            'var(--pt-edge-2)',
            'var(--pt-edge-3)',
            'var(--pt-edge-4)',
            'var(--pt-edge-5)',
        ] as const,
    },

    font: {
        family: 'var(--vscode-editor-font-family)',
        size: {
            small: 13,
            normal: 14,
            header: 15,
        },
        weight: {
            normal: 'normal',
            bold: 'bold',
        },
    },
} as const;
