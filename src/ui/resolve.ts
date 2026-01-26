import type { ClassNode } from '../types';

export function collectAncestors(
    className: string,
    classes: Map<string, ClassNode>
): string[] {
    const result: string[] = [];
    let current = classes.get(className);

    while (current?.bases.length) {
        const base = current.bases[0];
        const parent = classes.get(base);
        if (!parent) break;

        result.push(base);
        current = parent;
    }

    return result;
}

export function collectDescendants(
    className: string,
    classes: Map<string, ClassNode>
): string[] {
    const result: string[] = [];

    for (const [name, node] of classes) {
        if (node.bases.includes(className)) {
            result.push(name);
            result.push(...collectDescendants(name, classes));
        }
    }

    return result;
}
