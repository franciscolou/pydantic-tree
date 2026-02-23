import type { ClassNode } from '../types';

export function collectAncestors(
    className: string,
    classes: Map<string, ClassNode>
): string[][] {
    const layers: string[][] = [];
    const visited = new Set<string>();

    let currentLevel = [className];

    while (true) {
        const nextLevel: string[] = [];

        for (const name of currentLevel) {
            const node = classes.get(name);
            if (!node) continue;

            for (const base of node.bases ?? []) {
                if (!visited.has(base) && classes.has(base)) {
                    visited.add(base);
                    nextLevel.push(base);
                }
            }
        }

        if (!nextLevel.length) break;

        layers.push(nextLevel);
        currentLevel = nextLevel;
    }

    return layers;
}

export function collectDescendants(
    className: string,
    classes: Map<string, ClassNode>
): string[][] {
    const layers: string[][] = [];
    const visited = new Set<string>();

    let currentLevel = [className];

    while (true) {
        const nextLevel: string[] = [];

        for (const [name, node] of classes.entries()) {
            if (visited.has(name)) continue;

            if (node.bases?.some(base => currentLevel.includes(base))) {
                visited.add(name);
                nextLevel.push(name);
            }
        }

        if (!nextLevel.length) break;

        layers.push(nextLevel);
        currentLevel = nextLevel;
    }

    return layers;
}
