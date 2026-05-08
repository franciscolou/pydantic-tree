import type { ClassNode } from '../../types';

export function avgX(ids: string[], positions: Map<string, number>): number {
    const xs = ids.map(id => positions.get(id)).filter((x): x is number => x !== undefined);
    return xs.length > 0 ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

export function orderByParentBarycenter(layer: ClassNode[], parentPositions: Map<string, number>): ClassNode[] {
    return [...layer].sort((a, b) => {
        const baseIds = (n: ClassNode) => n.bases.map(b => b.id).filter((id): id is string => id !== undefined);
        return avgX(baseIds(a), parentPositions) - avgX(baseIds(b), parentPositions);
    });
}

export function orderByChildBarycenter(
    layer: ClassNode[],
    childLayer: ClassNode[],
    childPositions: Map<string, number>
): ClassNode[] {
    return [...layer].sort((a, b) => {
        const childrenOf = (node: ClassNode) =>
            childLayer.filter(c => c.bases.some(base => base.id === node.id)).map(c => c.id);
        return avgX(childrenOf(a), childPositions) - avgX(childrenOf(b), childPositions);
    });
}
