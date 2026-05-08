import { UI } from '../../../config';
import { BoxMeasures, ClassNode } from '../../../types';
import {
    collectInheritedNames,
    measureClassBox,
    renderClassBox,
} from '../classBox';
import { Group, HtmlRoot, Svg } from '../../components';
import { renderAncestorEdges, renderDescendantEdges } from '../edges';
import {
    orderByChildBarycenter,
    orderByParentBarycenter,
} from '../../utils/layout';
import { renderBaseStyles, renderViewportScript } from '../../utils/viewport';

function measureLayerMaxHeight(
    layer: ClassNode[],
    allNodes: Map<string, ClassNode>
): number {
    return Math.max(
        ...layer.map(
            node =>
                measureClassBox(node, collectInheritedNames(node, allNodes))
                    .height
        )
    );
}

function positionLayer(
    layer: ClassNode[],
    topY: number,
    allNodes: Map<string, ClassNode>,
    horizontalGap: number
): { svgs: string[]; positions: BoxMeasures[] } {
    const inherited = layer.map(node => collectInheritedNames(node, allNodes));
    const sizes = layer.map((node, i) => measureClassBox(node, inherited[i]));

    const totalWidth =
        sizes.reduce((sum, s) => sum + s.width, 0) +
        (layer.length - 1) * horizontalGap;
    let xCursor = -totalWidth / 2;

    const svgs: string[] = [];
    const positions: BoxMeasures[] = [];

    layer.forEach((node, i) => {
        const x = xCursor + sizes[i].width / 2;
        const rendered = renderClassBox(node, x, topY, inherited[i]);
        svgs.push(rendered.svg);
        positions.push({
            x,
            y: topY,
            width: sizes[i].width,
            height: sizes[i].height,
        });
        xCursor += sizes[i].width + horizontalGap;
    });

    return { svgs, positions };
}

export interface TreeLayout {
    svg: string;
    halfWidth: number;
    topY: number;
    bottomY: number;
}

export function buildTreeLayout(
    focus: ClassNode,
    ancestorLayers: ClassNode[][],
    descendantLayers: ClassNode[][]
): TreeLayout {
    const { verticalGap, horizontalGap } = UI.tree;

    const allNodes = new Map<string, ClassNode>();
    allNodes.set(focus.id, focus);
    for (const layer of ancestorLayers) {
        for (const node of layer) {
            allNodes.set(node.id, node);
        }
    }
    for (const layer of descendantLayers) {
        for (const node of layer) {
            allNodes.set(node.id, node);
        }
    }

    const layerHalfWidth = (layer: ClassNode[]): number => {
        const sizes = layer.map(node =>
            measureClassBox(node, collectInheritedNames(node, allNodes))
        );
        const total =
            sizes.reduce((sum, s) => sum + s.width, 0) +
            (layer.length - 1) * horizontalGap;
        return total / 2;
    };

    const focusRendered = renderClassBox(
        focus,
        0,
        0,
        collectInheritedNames(focus, allNodes)
    );
    let halfWidth = layerHalfWidth([focus]);
    let boxesSvg = focusRendered.svg;

    let currentY = 0;
    const ancestorLayerBoxes: BoxMeasures[][] = [];
    const orderedAncestorLayers: ClassNode[][] = [];
    let prevAncestorLayer: ClassNode[] = [focus];
    let prevAncestorPositions = new Map<string, number>([[focus.id, 0]]);

    for (const layer of ancestorLayers) {
        const ordered = orderByChildBarycenter(
            layer,
            prevAncestorLayer,
            prevAncestorPositions
        );
        orderedAncestorLayers.push(ordered);
        halfWidth = Math.max(halfWidth, layerHalfWidth(ordered));
        currentY -= verticalGap + measureLayerMaxHeight(ordered, allNodes);
        const { svgs, positions } = positionLayer(
            ordered,
            currentY,
            allNodes,
            horizontalGap
        );
        boxesSvg += svgs.join('');
        ancestorLayerBoxes.push(positions);
        prevAncestorPositions = new Map(
            ordered.map((node, i) => [node.id, positions[i].x])
        );
        prevAncestorLayer = ordered;
    }
    const topY = currentY;

    currentY = focusRendered.height + verticalGap;
    const descendantLayerBoxes: BoxMeasures[][] = [];
    const orderedDescendantLayers: ClassNode[][] = [];
    let parentPositions = new Map<string, number>([[focus.id, 0]]);

    for (const layer of descendantLayers) {
        const ordered = orderByParentBarycenter(layer, parentPositions);
        orderedDescendantLayers.push(ordered);
        halfWidth = Math.max(halfWidth, layerHalfWidth(ordered));
        const { svgs, positions } = positionLayer(
            ordered,
            currentY,
            allNodes,
            horizontalGap
        );
        boxesSvg += svgs.join('');
        currentY += Math.max(...positions.map(box => box.height)) + verticalGap;
        descendantLayerBoxes.push(positions);
        parentPositions = new Map(
            ordered.map((node, i) => [node.id, positions[i].x])
        );
    }
    const bottomY =
        descendantLayers.length > 0
            ? currentY - verticalGap
            : focusRendered.height;

    const edgesSvg =
        renderAncestorEdges(orderedAncestorLayers, ancestorLayerBoxes, 0) +
        renderDescendantEdges(
            orderedDescendantLayers,
            descendantLayerBoxes,
            focusRendered.height
        );

    return { svg: edgesSvg + boxesSvg, halfWidth, topY, bottomY };
}

export function renderClassTree(
    focus: ClassNode,
    ancestorLayers: ClassNode[][],
    descendantLayers: ClassNode[][]
): string {
    const { svg } = buildTreeLayout(focus, ancestorLayers, descendantLayers);

    return HtmlRoot(
        Svg({
            width: '100%',
            height: '100vh',
            children:
                renderBaseStyles() +
                Group({
                    id: 'viewport',
                    transform: 'translate(0,0) scale(1)',
                    children: svg,
                }),
        }) + renderViewportScript()
    );
}
