import type { ClassNode } from '../../types';
import { Messages } from '../../config';

export function renderClassHover(node: ClassNode): string {
    const ref = encodeURIComponent(
        JSON.stringify([{ fileUri: node.fileUri, line: node.definedAtLine }])
    );
    return [
        `[${Messages.hover.labels.showClassTree}](command:pytree.showClassTree?${ref})`,
        '',
        `[${Messages.hover.labels.showCompleteTree}](command:pytree.showCompleteClassTree?${ref})`,
    ].join('\n');
}
