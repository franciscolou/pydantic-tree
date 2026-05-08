import type { ClassNode } from '../../types';

// Kahn's topological sort for longest-path layering.
// edges: adjacency list — node → nodes it propagates distance to.
// Returns node → longest-path depth from any source (in-degree 0) node.
function longestPathLayers(
    nodes: string[],
    edges: Map<string, string[]>
): Map<string, number> {
    const inDeg = new Map<string, number>();
    for (const n of nodes) {
        inDeg.set(n, 0);
    }
    for (const targets of edges.values()) {
        for (const t of targets) {
            inDeg.set(t, (inDeg.get(t) ?? 0) + 1);
        }
    }

    const dist = new Map<string, number>();
    for (const n of nodes) {
        dist.set(n, 0);
    }

    const queue: string[] = [];
    for (const [n, deg] of inDeg) {
        if (deg === 0) {
            queue.push(n);
        }
    }

    while (queue.length > 0) {
        const curr = queue.shift()!;
        const d = dist.get(curr)!;
        for (const next of edges.get(curr) ?? []) {
            if (d + 1 > dist.get(next)!) {
                dist.set(next, d + 1);
            }
            const newDeg = inDeg.get(next)! - 1;
            inDeg.set(next, newDeg);
            if (newDeg === 0) {
                queue.push(next);
            }
        }
    }

    return dist;
}

export function buildConnectedComponents(
    classes: Map<string, ClassNode>
): ClassNode[][] {
    const parent = new Map<string, string>();
    for (const id of classes.keys()) {
        parent.set(id, id);
    }

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
                const rx = find(id),
                    ry = find(base.id);
                if (rx !== ry) {
                    parent.set(rx, ry);
                }
            }
        }
    }

    const groups = new Map<string, ClassNode[]>();
    for (const [id, node] of classes.entries()) {
        const root = find(id);
        if (!groups.has(root)) {
            groups.set(root, []);
        }
        groups.get(root)!.push(node);
    }

    return [...groups.values()].sort((a, b) => b.length - a.length);
}

export function buildComponentLayers(component: ClassNode[]): ClassNode[][] {
    const idSet = new Set(component.map(n => n.id));
    const nodeById = new Map(component.map(n => [n.id, n]));

    // Edges go from base class → derived classes (root-to-leaf direction)
    const edges = new Map<string, string[]>();
    for (const node of component) {
        for (const base of node.bases) {
            if (base.id && idSet.has(base.id)) {
                if (!edges.has(base.id)) {
                    edges.set(base.id, []);
                }
                edges.get(base.id)!.push(node.id);
            }
        }
    }

    const dist = longestPathLayers(
        component.map(n => n.id),
        edges
    );

    const layerMap = new Map<number, ClassNode[]>();
    for (const [id, d] of dist) {
        if (!layerMap.has(d)) {
            layerMap.set(d, []);
        }
        layerMap.get(d)!.push(nodeById.get(id)!);
    }

    const maxDist = dist.size > 0 ? Math.max(...dist.values()) : 0;
    const layers: ClassNode[][] = [];
    for (let d = 0; d <= maxDist; d++) {
        const layer = layerMap.get(d);
        if (layer?.length) {
            layers.push(layer);
        }
    }
    return layers;
}

export function collectAncestors(
    classId: string,
    classes: Map<string, ClassNode>
): string[][] {
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
    if (allAncestors.size === 0) {
        return [];
    }

    const subgraph = new Set([classId, ...allAncestors]);

    // Edges go from derived class → base classes (focus-to-ancestor direction).
    // Longest-path ensures diamond ancestors are placed above all paths that reach them.
    const edges = new Map<string, string[]>();
    for (const n of subgraph) {
        const targets = (classes.get(n)?.bases ?? [])
            .filter(b => b.id && subgraph.has(b.id))
            .map(b => b.id!);
        if (targets.length) {
            edges.set(n, targets);
        }
    }

    const dist = longestPathLayers([...subgraph], edges);

    const layerMap = new Map<number, string[]>();
    for (const ancestor of allAncestors) {
        const d = dist.get(ancestor)!;
        if (!layerMap.has(d)) {
            layerMap.set(d, []);
        }
        layerMap.get(d)!.push(ancestor);
    }

    const maxDist = Math.max(...dist.values());
    const layers: string[][] = [];
    for (let d = 1; d <= maxDist; d++) {
        const layer = layerMap.get(d);
        if (layer?.length) {
            layers.push(layer);
        }
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
            if (visited.has(id)) {
                continue;
            }

            if (
                node.bases?.some(
                    b => b.id !== undefined && currentLevelSet.has(b.id)
                )
            ) {
                visited.add(id);
                nextLevel.push(id);
            }
        }

        if (!nextLevel.length) {
            break;
        }

        layers.push(nextLevel);
        currentLevelSet = new Set(nextLevel);
    }

    return layers;
}
