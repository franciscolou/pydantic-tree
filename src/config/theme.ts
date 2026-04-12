export const Theme = {
    colors: {
        background: '#1e1e1e',
        panelBackground: '#252526',
        border: '#3c3c3c',

        headerBackground: '#4ec9b0',
        headerText: '#000000',

        text: '#d4d4d4',
        type: '#4ec9b0',
        string: '#ce9178',
        attribute: '#9cdcfe',
        method: '#dccd79',

        edge: '#6a6a6a',
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
