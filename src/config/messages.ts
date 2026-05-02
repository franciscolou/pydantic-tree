export const Messages = {
    noClassUnderCursor: 'Nenhuma classe encontrada sob o cursor.',
    noClassesFound: 'Nenhuma classe Python encontrada no workspace.',

    hover: {
        noBases: 'nenhuma',
        noAttributes: '_nenhum_',
        noMethods: '_nenhum_',
    },

    titles: {
        classTree: (name: string) => `Herança: ${name}`,
        projectTree: 'Pydantic: Árvore do Projeto',
        scanningFiles: 'Pydantic Tree: escaneando arquivos...',
    },
} as const;
