export const UI = {
    box: {
        minWidth: 260,
        maxWidth: 720,
        headerHeight: 32,
        padding: 14,
        sectionGap: 20,
        lineHeight: 20,
        sidePadding: 32,
        borderRadius: 6,
        charWidth: 8.8,
        methodTopPadding: 12,
    },

    tree: {
        verticalGap: 120,
        horizontalGap: 160,
        initialTranslate: {
            x: 1000,
            y: 1000,
        },
    },

    zoom: {
        min: 0.3,
        max: 3,
        step: 0.1,
    },

    pan: {
        sensitivity: 0.9,
    },
} as const;
