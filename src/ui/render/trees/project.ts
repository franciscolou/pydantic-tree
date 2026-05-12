import type { ClassNode, BoxMeasures } from '../../../types';
import { Theme, UI } from '../../../config';
import { Svg, Group, HtmlRoot } from '../../components';
import {
    renderClassBox,
    measureClassBox,
    collectInheritedNames,
} from '../classBox';
import { renderBaseStyles, renderViewportScript } from '../../utils/viewport';
import { renderComponentEdges } from '../edges';
import { orderByParentBarycenter } from '../../utils/layout';

const COMPONENT_GAP = 400;

/* =========================================================
   COMPONENT LAYOUT
========================================================= */

function computeComponentWidth(
    layers: ClassNode[][],
    allNodes: Map<string, ClassNode>,
    horizontalGap: number
): number {
    return Math.max(
        ...layers.map(layer => {
            const sizes = layer.map(node =>
                measureClassBox(node, collectInheritedNames(node, allNodes))
            );
            return (
                sizes.reduce((sum, s) => sum + s.width, 0) +
                Math.max(0, layer.length - 1) * horizontalGap
            );
        })
    );
}

function computeComponentHeight(
    layers: ClassNode[][],
    allNodes: Map<string, ClassNode>,
    verticalGap: number
): number {
    const layerHeights = layers.map(layer =>
        Math.max(
            ...layer.map(
                node =>
                    measureClassBox(node, collectInheritedNames(node, allNodes))
                        .height
            )
        )
    );
    return (
        layerHeights.reduce((sum, h) => sum + h, 0) +
        Math.max(0, layers.length - 1) * verticalGap
    );
}

function positionLayerAt(
    layer: ClassNode[],
    topY: number,
    centerX: number,
    allNodes: Map<string, ClassNode>,
    horizontalGap: number
): { svgs: string[]; positions: BoxMeasures[] } {
    const inherited = layer.map(node => collectInheritedNames(node, allNodes));
    const sizes = layer.map((node, i) => measureClassBox(node, inherited[i]));
    const totalWidth =
        sizes.reduce((sum, s) => sum + s.width, 0) +
        Math.max(0, layer.length - 1) * horizontalGap;
    let xCursor = centerX - totalWidth / 2;

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

/* =========================================================
   FOREST RENDERING
========================================================= */

export function renderProjectTree(
    componentLayers: ClassNode[][][],
    allNodes: Map<string, ClassNode>
): string {
    const { verticalGap, horizontalGap } = UI.tree;

    const N = componentLayers.length;
    const cols = Math.max(1, Math.ceil(Math.sqrt(N)));
    const rows = Math.ceil(N / cols);

    const widths = componentLayers.map(layers =>
        computeComponentWidth(layers, allNodes, horizontalGap)
    );
    const heights = componentLayers.map(layers =>
        computeComponentHeight(layers, allNodes, verticalGap)
    );

    const colWidths = Array.from({ length: cols }, (_, c) =>
        Math.max(
            0,
            ...Array.from(
                { length: rows },
                (__, r) => widths[r * cols + c] ?? 0
            )
        )
    );
    const rowHeights = Array.from({ length: rows }, (_, r) =>
        Math.max(
            0,
            ...Array.from(
                { length: cols },
                (__, c) => heights[r * cols + c] ?? 0
            )
        )
    );

    const colXs = colWidths.reduce<number[]>(
        (acc, _, i) => [
            ...acc,
            i === 0 ? 0 : acc[i - 1] + colWidths[i - 1] + COMPONENT_GAP,
        ],
        []
    );
    const rowYs = rowHeights.reduce<number[]>(
        (acc, _, i) => [
            ...acc,
            i === 0 ? 0 : acc[i - 1] + rowHeights[i - 1] + COMPONENT_GAP,
        ],
        []
    );

    let boxesSvg = '';
    let edgesSvg = '';

    for (let ci = 0; ci < componentLayers.length; ci++) {
        const rawLayers = componentLayers[ci];
        const col = ci % cols;
        const row = Math.floor(ci / cols);
        const centerX = colXs[col] + colWidths[col] / 2;

        const layers: ClassNode[][] = [];
        const layerBoxes: BoxMeasures[][] = [];
        let currentY = rowYs[row];
        let parentPositions = new Map<string, number>();

        for (const rawLayer of rawLayers) {
            const ordered =
                parentPositions.size > 0
                    ? orderByParentBarycenter(rawLayer, parentPositions)
                    : [...rawLayer];
            layers.push(ordered);
            const { svgs, positions } = positionLayerAt(
                ordered,
                currentY,
                centerX,
                allNodes,
                horizontalGap
            );
            boxesSvg += svgs.join('');
            layerBoxes.push(positions);
            currentY += Math.max(...positions.map(p => p.height)) + verticalGap;
            parentPositions = new Map(
                ordered.map((node, i) => [node.id, positions[i].x])
            );
        }

        edgesSvg += renderComponentEdges(layers, layerBoxes);
    }

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
        }) + renderViewportScript({ initialScale: 0.5 })
    );
}
