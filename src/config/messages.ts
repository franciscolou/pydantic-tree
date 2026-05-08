export const Messages = {
    noClassUnderCursor: 'No class found under cursor.',
    noClassesFound: 'No Python classes found in the workspace.',

    hover: {
        labels: {
            showClassTree: "Show Class Tree",
            showCompleteTree: "Show Complete Tree"
        }
    },

    status: {
        scanningFiles: 'PyTree Tree: scanning files...',
    },

    webView: {
        titles: {
            classTree: (name: string) => `Inheritance: ${name}`,
            projectTree: 'PyTree: Project Tree',
        },
        options: {
            showAllFilePaths: "Show all file paths"
        },
    },

    commands: {
        pickClasses: {
            labels: {
                placeholder: "Select tree type",

                simpleTree: {
                    title: "Simple Tree",
                    description: "Ancestors only"
                },
                completeTree: {
                    title: "Complete Tree",
                    description: "Ancestors and descendants"
                }
        }
        }
    }
} as const;
