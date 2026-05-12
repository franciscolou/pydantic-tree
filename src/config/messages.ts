export const Messages = {
    noClassUnderCursor: 'No class found under cursor.',
    noClassesFound: 'No Python classes found in the workspace.',

    hover: {
        labels: {
            showClassTree: 'Show Class Tree',
            showCompleteTree: 'Show Complete Tree',
        },
    },

    status: {
        scanningFiles: 'PyTree: scanning files...',
    },

    webView: {
        titles: {
            classTree: (name: string) => `PyTree: ${name} Inheritance`,
            completeClassTree: (name: string) =>
                `PyTree: ${name} Complete Inheritance`,
            projectTree: 'PyTree: Project Tree',
            pickedClassesTree: 'PyTree: Picked Classes',
        },
        options: {
            showAllFilePaths: 'Show all file paths',
        },
    },

    ui: {
        abstractIndicator: '(abc)',
    },

    commands: {
        pickClasses: {
            labels: {
                placeholder: 'Select tree type',

                simpleTree: {
                    title: 'Simple Tree',
                    description: 'Ancestors only',
                },
                completeTree: {
                    title: 'Complete Tree',
                    description: 'Ancestors and descendants',
                },
            },
        },
    },
} as const;
