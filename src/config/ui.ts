export const UI = {
    box: {
        minWidth: 260,
        maxWidth: 720,
        headerHeight: 32,
        padding: 14,
        sectionGap: 10,
        lineHeight: 20,
        sidePadding: 32,
        borderRadius: 6,
        charWidth: 8.8,
        sectionTopPadding: 25,

        filePathFontSize: 11,
        filePathLineHeight: 16,
        filePathPadding: 4,
        filePathCharWidth: 6.5,
    },

    tree: {
        verticalGap: 150,
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
