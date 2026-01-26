export const Messages = {
    noClassUnderCursor: 'Nenhuma classe encontrada sob o cursor.',

    hover: {
        noBases: 'nenhuma',
        noAttributes: '_nenhum_',
        noMethods: '_nenhum_',
    },

    titles: {
        classTree: (name: string) => `Herança: ${name}`,
    },
} as const;
