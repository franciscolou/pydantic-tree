import type { ClassNode } from '../types';

export function renderClassHover(node: ClassNode): string {
    const ref = encodeURIComponent(JSON.stringify([{ fileUri: node.fileUri, line: node.definedAtLine }]));
    return [
        `**PyTree** · \`${node.name}\``,
        '',
        `[Show Class Tree](command:pytree.showClassTree?${ref})`,
        '',
        `[Show Complete Tree](command:pytree.showCompleteClassTree?${ref})`,
    ].join('\n');
}
