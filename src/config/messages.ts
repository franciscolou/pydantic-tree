export const Messages = {
    noClassUnderCursor: 'No class found under cursor.',
    noClassesFound: 'No Python classes found in the workspace.',

    hover: {
        noBases: 'nenhuma',
        noAttributes: '_nenhum_',
        noMethods: '_nenhum_',
    },

    titles: {
        classTree: (name: string) => `Inheritance: ${name}`,
        projectTree: 'PyTree: Project Tree',
        scanningFiles: 'PyTree Tree: scanning files...',
    },
} as const;
