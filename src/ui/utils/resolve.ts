import type { ClassNode } from '../../types';

export function buildConnectedComponents(classes: Map<string, ClassNode>): ClassNode[][] {
    const parent = new Map<string, string>();
    for (const id of classes.keys()) parent.set(id, id);

    const find = (x: string): string => {
        while (parent.get(x) !== x) {
            parent.set(x, parent.get(parent.get(x)!)!);
            x = parent.get(x)!;
        }
        return x;
    };

    for (const [id, node] of classes.entries()) {
        for (const base of node.bases) {
            if (base.id && classes.has(base.id)) {
                const rx = find(id), ry = find(base.id);
                if (rx !== ry) parent.set(rx, ry);
            }
        }
    }

    const groups = new Map<string, ClassNode[]>();
    for (const [id, node] of classes.entries()) {
        const root = find(id);
        if (!groups.has(root)) groups.set(root, []);
        groups.get(root)!.push(node);
    }

    return [...groups.values()].sort((a, b) => b.length - a.length);
}

export function buildComponentLayers(component: ClassNode[]): ClassNode[][] {
    const idSet = new Set(component.map(n => n.id));

    const inDeg = new Map<string, number>();
    const children = new Map<string, string[]>();
    for (const node of component) {
        inDeg.set(node.id, node.bases.filter(b => b.id !== undefined && idSet.has(b.id)).length);
        for (const base of node.bases) {
            if (base.id && idSet.has(base.id)) {
                if (!children.has(base.id)) children.set(base.id, []);
                children.get(base.id)!.push(node.id);
            }
        }
    }

    const dist = new Map<string, number>();
    for (const node of component) dist.set(node.id, 0);

    const queue: string[] = [];
    for (const [id, deg] of inDeg) {
        if (deg === 0) queue.push(id);
    }

    while (queue.length > 0) {
        const curr = queue.shift()!;
        const d = dist.get(curr)!;
        for (const child of (children.get(curr) ?? [])) {
            if (d + 1 > (dist.get(child) ?? 0)) dist.set(child, d + 1);
            inDeg.set(child, inDeg.get(child)! - 1);
            if (inDeg.get(child) === 0) queue.push(child);
        }
    }

    const layerMap = new Map<number, ClassNode[]>();
    const nodeById = new Map(component.map(n => [n.id, n]));
    for (const id of dist.keys()) {
        const d = dist.get(id)!;
        if (!layerMap.has(d)) layerMap.set(d, []);
        layerMap.get(d)!.push(nodeById.get(id)!);
    }

    const maxDist = dist.size > 0 ? Math.max(...dist.values()) : 0;
    const layers: ClassNode[][] = [];
    for (let d = 0; d <= maxDist; d++) {
        const layer = layerMap.get(d);
        if (layer?.length) layers.push(layer);
    }
    return layers;
}


export function collectAncestors(
    classId: string,
    classes: Map<string, ClassNode>
): string[][] {
    // Collect all reachable ancestors
    const allAncestors = new Set<string>();
    const stack: string[] = [classId];
    while (stack.length > 0) {
        const curr = stack.pop()!;
        for (const base of classes.get(curr)?.bases ?? []) {
            if (base.id && classes.has(base.id) && !allAncestors.has(base.id)) {
                allAncestors.add(base.id);
                stack.push(base.id);
            }
        }
    }
    if (allAncestors.size === 0) return [];

    // Assign each ancestor its longest-path depth from classId via Kahn's topological sort.
    // Longest path ensures that if A is an ancestor of B, A is always placed in a higher layer than B,
    // even when A is also reachable via a shorter path (e.g. diamond inheritance).
    const subgraph = new Set([classId, ...allAncestors]);

    // in-degree = number of children each node has within the subgraph
    const inDegree = new Map<string, number>();
    for (const n of subgraph) inDegree.set(n, 0);
    for (const n of subgraph) {
        for (const base of classes.get(n)?.bases ?? []) {
            if (base.id && subgraph.has(base.id)) inDegree.set(base.id, inDegree.get(base.id)! + 1);
        }
    }

    const dist = new Map<string, number>();
    for (const n of subgraph) dist.set(n, 0);

    const queue: string[] = [];
    for (const [n, deg] of inDegree) {
        if (deg === 0) queue.push(n); // only classId starts here
    }

    while (queue.length > 0) {
        const curr = queue.shift()!;
        const d = dist.get(curr)!;
        for (const base of classes.get(curr)?.bases ?? []) {
            if (!base.id || !subgraph.has(base.id)) continue;
            if (d + 1 > dist.get(base.id)!) dist.set(base.id, d + 1);
            const newDeg = inDegree.get(base.id)! - 1;
            inDegree.set(base.id, newDeg);
            if (newDeg === 0) queue.push(base.id);
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
    classId: string,
    classes: Map<string, ClassNode>
): string[][] {
    const layers: string[][] = [];
    const visited = new Set<string>();

    let currentLevelSet = new Set([classId]);

    while (true) {
        const nextLevel: string[] = [];

        for (const [id, node] of classes.entries()) {
            if (visited.has(id)) continue;

            if (node.bases?.some(b => b.id !== undefined && currentLevelSet.has(b.id))) {
                visited.add(id);
                nextLevel.push(id);
            }
        }

        if (!nextLevel.length) break;

        layers.push(nextLevel);
        currentLevelSet = new Set(nextLevel);
    }

    return layers;
}
