import type { ClassNode } from '../types';

export function collectAncestors(
    className: string,
    classes: Map<string, ClassNode>
): string[][] {
    // Collect all reachable ancestors
    const allAncestors = new Set<string>();
    const stack: string[] = [className];
    while (stack.length > 0) {
        const curr = stack.pop()!;
        for (const base of classes.get(curr)?.bases ?? []) {
            if (classes.has(base) && !allAncestors.has(base)) {
                allAncestors.add(base);
                stack.push(base);
            }
        }
    }
    if (allAncestors.size === 0) return [];

    // Assign each ancestor its longest-path depth from className via Kahn's topological sort.
    // Longest path ensures that if A is an ancestor of B, A is always placed in a higher layer than B,
    // even when A is also reachable via a shorter path (e.g. diamond inheritance).
    const subgraph = new Set([className, ...allAncestors]);

    // in-degree = number of children each node has within the subgraph
    const inDegree = new Map<string, number>();
    for (const n of subgraph) inDegree.set(n, 0);
    for (const n of subgraph) {
        for (const base of classes.get(n)?.bases ?? []) {
            if (subgraph.has(base)) inDegree.set(base, inDegree.get(base)! + 1);
        }
    }

    const dist = new Map<string, number>();
    for (const n of subgraph) dist.set(n, 0);

    const queue: string[] = [];
    for (const [n, deg] of inDegree) {
        if (deg === 0) queue.push(n); // only className starts here
    }

    while (queue.length > 0) {
        const curr = queue.shift()!;
        const d = dist.get(curr)!;
        for (const base of classes.get(curr)?.bases ?? []) {
            if (!subgraph.has(base)) continue;
            if (d + 1 > dist.get(base)!) dist.set(base, d + 1);
            const newDeg = inDegree.get(base)! - 1;
            inDegree.set(base, newDeg);
            if (newDeg === 0) queue.push(base);
        }
    }

    // Group by depth (depth 1 = layer 0, depth 2 = layer 1, …)
    const layerMap = new Map<number, string[]>();
    for (const ancestor of allAncestors) {
        const d = dist.get(ancestor)!;
        if (!layerMap.has(d)) layerMap.set(d, []);
        layerMap.get(d)!.push(ancestor);
    }

    const maxDist = Math.max(...dist.values());
    const layers: string[][] = [];
    for (let d = 1; d <= maxDist; d++) {
        const layer = layerMap.get(d);
        if (layer?.length) layers.push(layer);
    }
    return layers;
}

export function collectDescendants(
    className: string,
    classes: Map<string, ClassNode>
): string[][] {
    const layers: string[][] = [];
    const visited = new Set<string>();

    let currentLevelSet = new Set([className]);

    while (true) {
        const nextLevel: string[] = [];

        for (const [name, node] of classes.entries()) {
            if (visited.has(name)) continue;

            if (node.bases?.some(base => currentLevelSet.has(base))) {
                visited.add(name);
                nextLevel.push(name);
            }
        }

        if (!nextLevel.length) break;

        layers.push(nextLevel);
        currentLevelSet = new Set(nextLevel);
    }

    return layers;
}
