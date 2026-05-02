import type { ClassNode, BoxMeasures } from '../types';
import { Theme, UI } from '../config';
import { Svg, Group, HtmlRoot } from './components';
import { renderClassBox, measureClassBox, collectInheritedNames } from './classBox';
import { renderViewportScript } from './render';
import { drawConnections, type EdgeConnection } from './edges';

const COMPONENT_GAP = 400;

/* =========================================================
   HELPERS
========================================================= */

function centerOutSort<T>(items: T[], priorities: number[]): T[] {
    if (items.length <= 1) return [...items];
    const indexed = items.map((item, i) => ({ item, priority: priorities[i] }));
    indexed.sort((a, b) => b.priority - a.priority);
    const result = new Array<T>(items.length);
    const center = Math.floor((items.length - 1) / 2);
    result[center] = indexed[0].item;
    let r = 1, l = 1;
    for (let i = 1; i < indexed.length; i++) {
        if (i % 2 === 1) result[center + r++] = indexed[i].item;
        else              result[center - l++] = indexed[i].item;
    }
    return result;
}

function sortLayersCenterOut(
    layers: ClassNode[],
    allLayers: ClassNode[][],
    layerIndex: number
): ClassNode[] {
    const childCounts = layers.map(node => {
        if (layerIndex >= allLayers.length - 1) return 0;
        return allLayers[layerIndex + 1].filter(c => (c.bases ?? []).includes(node.name)).length;
    });
    return centerOutSort(layers, childCounts);
}

/* =========================================================
   EDGE RENDERING
========================================================= */

function renderComponentEdges(layers: ClassNode[][], layerBoxes: BoxMeasures[][]): string {
    let edges = '';
    for (let i = 0; i < layers.length - 1; i++) {
        const parentLayer = layers[i];
        const parentBoxes = layerBoxes[i];
        const childLayer = layers[i + 1];
        const childBoxes = layerBoxes[i + 1];

        const busY = (
            Math.max(...parentBoxes.map(b => b.y + b.height)) +
            Math.min(...childBoxes.map(b => b.y))
        ) / 2;

        const connections: EdgeConnection[] = [];
        parentLayer.forEach((parent, pi) => {
            childLayer.forEach((child, ci) => {
                if ((child.bases ?? []).includes(parent.name)) {
                    connections.push({
                        parentX: parentBoxes[pi].x,
                        parentBottom: parentBoxes[pi].y + parentBoxes[pi].height,
                        childX: childBoxes[ci].x,
                        childTop: childBoxes[ci].y,
                    });
                }
            });
        });
        edges += drawConnections(connections, busY, Theme.colors.edgePalette);
    }
    return edges;
}

/* =========================================================
   COMPONENT LAYOUT
========================================================= */

function computeComponentWidth(
    layers: ClassNode[][],
    allNodes: Map<string, ClassNode>,
    horizontalGap: number
): number {
    return Math.max(...layers.map(layer => {
        const sizes = layer.map(node => measureClassBox(node, collectInheritedNames(node, allNodes)));
        return sizes.reduce((sum, s) => sum + s.width, 0) + Math.max(0, layer.length - 1) * horizontalGap;
    }));
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
    const totalWidth = sizes.reduce((sum, s) => sum + s.width, 0) + Math.max(0, layer.length - 1) * horizontalGap;
    let xCursor = centerX - totalWidth / 2;

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
   FOREST RENDERING
========================================================= */

export function renderForestSVG(
    componentLayers: ClassNode[][][],
    allNodes: Map<string, ClassNode>
): string {
    const { verticalGap, horizontalGap } = UI.tree;

    const widths = componentLayers.map(layers =>
        computeComponentWidth(layers, allNodes, horizontalGap)
    );

    // Lay components left-to-right, each centered at its own X
    const centerXs: number[] = [];
    let currentLeft = 0;
    for (let ci = 0; ci < widths.length; ci++) {
        centerXs.push(currentLeft + widths[ci] / 2);
        currentLeft += widths[ci] + COMPONENT_GAP;
    }

    let boxesSvg = '';
    let edgesSvg = '';

    for (let ci = 0; ci < componentLayers.length; ci++) {
        const rawLayers = componentLayers[ci];
        const centerX = centerXs[ci];

        // Sort each layer center-out by child count for visual clarity
        const layers = rawLayers.map((layer, li) => sortLayersCenterOut(layer, rawLayers, li));

        const layerBoxes: BoxMeasures[][] = [];
        let currentY = 0;

        for (const layer of layers) {
            const { svgs, positions } = positionLayerAt(layer, currentY, centerX, allNodes, horizontalGap);
            boxesSvg += svgs.join('');
            layerBoxes.push(positions);
            currentY += Math.max(...positions.map(p => p.height)) + verticalGap;
        }

        edgesSvg += renderComponentEdges(layers, layerBoxes);
    }

    return HtmlRoot(
        Svg({
            width: '100%',
            height: '100vh',
            children:
                `<style>text{font-family:${Theme.font.family};}body,svg{background:${Theme.colors.background};}[data-line]:hover text{text-decoration:underline;text-decoration-color:rgba(255,255,255,0.85);}[data-line].nav-member:hover text{text-decoration-color:rgba(255,255,255,0.3);}</style>` +
                Group({
                    id: 'viewport',
                    transform: 'translate(0,0) scale(1)',
                    children: edgesSvg + boxesSvg,
                }),
        }) +
        renderViewportScript({ initialScale: 0.5 })
    );
}
