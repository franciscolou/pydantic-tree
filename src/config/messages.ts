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
        sections: {
            attributes: 'Attributes',
            classMethods: 'Class Methods',
            staticMethods: 'Static Methods',
            methods: 'Methods',
        },
    },

    inheritance: {
        cycleError: (child: string, parent: string) =>
            `Cannot change inheritance: ${parent} is already a descendant of ${child}, which would create a circular inheritance.`,
        alreadyInheritsError: (child: string, parent: string) =>
            `Cannot change inheritance: ${child} already inherits from ${parent}.`,
        sameParent: 'The selected class is already the current parent.',
        confirmTitle: (child: string, oldParent: string, newParent: string) =>
            `Change ${child}'s base from ${oldParent} to ${newParent}?`,
        confirmApply: 'Apply',
        conflictTitle: (child: string, newParent: string) =>
            `Changing ${child}'s parent to ${newParent} introduces conflicts:`,
        conflictAttrs: (names: string[]) =>
            `Attributes: ${names.join(', ')}`,
        conflictMethods: (names: string[]) =>
            `Methods: ${names.join(', ')}`,
        conflictFooter:
            'Apply anyway? You can resolve the conflicts manually in the source file afterwards.',
        applyAnyway: 'Apply Anyway',
        cancel: 'Cancel',
        rewriteFailed:
            'Could not rewrite the source: please check the class declaration is well-formed.',
        appliedNotice: (child: string, parent: string) =>
            `Changed ${child}'s base class to ${parent}.`,
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
