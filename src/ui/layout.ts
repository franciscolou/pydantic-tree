import type { ClassNode } from '../types';

export function avgX(names: string[], positions: Map<string, number>): number {
    const xs = names.map(n => positions.get(n)).filter((x): x is number => x !== undefined);
    return xs.length > 0 ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

export function orderByParentBarycenter(layer: ClassNode[], parentPositions: Map<string, number>): ClassNode[] {
    return [...layer].sort((a, b) => avgX(a.bases, parentPositions) - avgX(b.bases, parentPositions));
}

export function orderByChildBarycenter(
    layer: ClassNode[],
    childLayer: ClassNode[],
    childPositions: Map<string, number>
): ClassNode[] {
    return [...layer].sort((a, b) => {
        const childrenOf = (node: ClassNode) => childLayer.filter(c => c.bases.includes(node.name)).map(c => c.name);
        return avgX(childrenOf(a), childPositions) - avgX(childrenOf(b), childPositions);
    });
}
