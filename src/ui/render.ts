import type { ClassNode, BoxMeasures } from '../types';
import { UI } from '../config';
import { Svg, Group, HtmlRoot } from './components';
import { renderClassBox, measureClassBox, collectInheritedNames } from './classBox';
import { renderAncestorEdges, renderDescendantEdges } from './edges';
import { orderByParentBarycenter, orderByChildBarycenter } from './layout';
import { renderBaseStyles, renderViewportScript } from './viewport';

function measureLayerMaxHeight(layer: ClassNode[], allNodes: Map<string, ClassNode>): number {
    return Math.max(...layer.map(node => measureClassBox(node, collectInheritedNames(node, allNodes)).height));
}

function positionLayer(
    layer: ClassNode[],
    topY: number,
    allNodes: Map<string, ClassNode>,
    horizontalGap: number
): { svgs: string[]; positions: BoxMeasures[] } {
    const inherited = layer.map(node => collectInheritedNames(node, allNodes));
    const sizes = layer.map((node, i) => measureClassBox(node, inherited[i]));

    const totalWidth = sizes.reduce((sum, s) => sum + s.width, 0) + (layer.length - 1) * horizontalGap;
    let xCursor = -totalWidth / 2;

    const svgs: string[] = [];
    const positions: BoxMeasures[] = [];

    layer.forEach((node, i) => {
        const x = xCursor + sizes[i].width / 2;
        const rendered = renderClassBox(node, x, topY, inherited[i]);
        svgs.push(rendered.svg);
        positions.push({ x, y: topY, width: sizes[i].width, height: sizes[i].height });
        xCursor += sizes[i].width + horizontalGap;
    });

    return { svgs, positions };
}

/* =========================================================
   TREE RENDERING
========================================================= */

export function renderClassTreeSVG(
    focus: ClassNode,
    ancestorLayers: ClassNode[][],
    descendantLayers: ClassNode[][]
): string {
    const { verticalGap, horizontalGap } = UI.tree;

    const allNodes = new Map<string, ClassNode>();
    allNodes.set(focus.name, focus);
    for (const layer of ancestorLayers) for (const node of layer) allNodes.set(node.name, node);
    for (const layer of descendantLayers) for (const node of layer) allNodes.set(node.name, node);

    // Focus box at origin
    const focusRendered = renderClassBox(focus, 0, 0, collectInheritedNames(focus, allNodes));

    // Position ancestor layers — order each layer by the average x of its children in the layer below,
    // so ancestors land horizontally close to the descendants they connect to.
    let currentY = 0;
    const ancestorLayerBoxes: BoxMeasures[][] = [];
    const orderedAncestorLayers: ClassNode[][] = [];
    let boxesSvg = focusRendered.svg;

    let prevAncestorLayer: ClassNode[] = [focus];
    let prevAncestorPositions = new Map<string, number>([[focus.name, 0]]);

    for (const layer of ancestorLayers) {
        const ordered = orderByChildBarycenter(layer, prevAncestorLayer, prevAncestorPositions);
        orderedAncestorLayers.push(ordered);
        currentY -= verticalGap + measureLayerMaxHeight(ordered, allNodes);
        const { svgs, positions } = positionLayer(ordered, currentY, allNodes, horizontalGap);
        boxesSvg += svgs.join('');
        ancestorLayerBoxes.push(positions);
        prevAncestorPositions = new Map(ordered.map((node, i) => [node.name, positions[i].x]));
        prevAncestorLayer = ordered;
    }

    // Position descendant layers — order each layer by the average x of its parents in the layer above,
    // so children land horizontally close to their parents.
    currentY = focusRendered.height + verticalGap;
    const descendantLayerBoxes: BoxMeasures[][] = [];
    const orderedDescendantLayers: ClassNode[][] = [];

    let parentPositions = new Map<string, number>([[focus.name, 0]]);

    for (const layer of descendantLayers) {
        const ordered = orderByParentBarycenter(layer, parentPositions);
        orderedDescendantLayers.push(ordered);
        const { svgs, positions } = positionLayer(ordered, currentY, allNodes, horizontalGap);
        boxesSvg += svgs.join('');
        currentY += Math.max(...positions.map(box => box.height)) + verticalGap;
        descendantLayerBoxes.push(positions);
        parentPositions = new Map(ordered.map((node, i) => [node.name, positions[i].x]));
    }

    // Draw edges
    const edgesSvg =
        renderAncestorEdges(orderedAncestorLayers, ancestorLayerBoxes, 0) +
        renderDescendantEdges(orderedDescendantLayers, descendantLayerBoxes, focusRendered.height);

    return HtmlRoot(
        Svg({
            width: '100%',
            height: '100vh',
            children:
                renderBaseStyles() +
                Group({
                    id: 'viewport',
                    transform: 'translate(0,0) scale(1)',
                    children: edgesSvg + boxesSvg,
                }),
        }) +
        renderViewportScript()
    );
}

