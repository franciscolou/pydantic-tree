import type { ClassNode, BoxMeasures } from '../types';
import { Theme, UI } from '../config';
import { Svg, Group, HtmlRoot, Line } from './components';
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

// Spreads attachment X positions for connections sharing the same node,
// ordered by the other endpoint's X to minimise crossing at the attachment.
function spreadAttachXs(ownXs: number[], otherXs: number[], step: number): number[] {
    const result = ownXs.slice();
    const groups = new Map<number, number[]>();
    ownXs.forEach((x, i) => { if (!groups.has(x)) groups.set(x, []); groups.get(x)!.push(i); });
    for (const [ownX, idxs] of groups) {
        if (idxs.length === 1) { result[idxs[0]] = ownX; continue; }
        idxs.sort((a, b) => otherXs[a] - otherXs[b]);
        const half = ((idxs.length - 1) * step) / 2;
        idxs.forEach((idx, pos) => { result[idx] = ownX - half + pos * step; });
    }
    return result;
}

function renderComponentEdges(layers: ClassNode[][], layerBoxes: BoxMeasures[][]): string {
    const SIDE_STEP   = 14; // px between parallel highway lanes
    const TOP_OFFSET  = 20; // px below parent box for exit horizontal
    const BOT_OFFSET  = 10; // px above child box for entry horizontal
    const Y_STEP      = 12; // px between stacked exit / entry horizontals
    const MARGIN      = 40; // px beyond component boundary for highway
    const ATTACH_STEP = 8;  // px between attachment Xs (global, adj + non-adj)
    let edges = '';

    // ── Collect ALL connections in one flat list ─────────────────────────────
    // adjGap ≥ 0 means adjacent (gap between layer adjGap and adjGap+1);
    // adjGap = -1 means non-adjacent.
    type Conn = { parentX: number; parentBottom: number; childX: number; childTop: number; adjGap: number };
    const all: Conn[] = [];

    for (let i = 0; i < layers.length - 1; i++) {
        layers[i].forEach((parent, pi) => {
            layers[i + 1].forEach((child, ci) => {
                if ((child.bases ?? []).includes(parent.name)) {
                    all.push({
                        parentX: layerBoxes[i][pi].x,
                        parentBottom: layerBoxes[i][pi].y + layerBoxes[i][pi].height,
                        childX: layerBoxes[i + 1][ci].x,
                        childTop: layerBoxes[i + 1][ci].y,
                        adjGap: i,
                    });
                }
            });
        });
    }
    for (let i = 0; i < layers.length; i++) {
        for (let j = i + 2; j < layers.length; j++) {
            layers[i].forEach((parent, pi) => {
                layers[j].forEach((child, ci) => {
                    if ((child.bases ?? []).includes(parent.name)) {
                        all.push({
                            parentX: layerBoxes[i][pi].x,
                            parentBottom: layerBoxes[i][pi].y + layerBoxes[i][pi].height,
                            childX: layerBoxes[j][ci].x,
                            childTop: layerBoxes[j][ci].y,
                            adjGap: -1,
                        });
                    }
                });
            });
        }
    }
    if (all.length === 0) return edges;

    // Global pX / cX spread across ALL connections from / to each node.
    // Passing pre-computed values as parentX/childX into EdgeConnection makes
    // drawConnections keep them as-is (each value is unique → no further spread).
    const gPX = spreadAttachXs(all.map(c => c.parentX), all.map(c => c.childX), ATTACH_STEP);
    const gCX = spreadAttachXs(all.map(c => c.childX),  all.map(c => c.parentX), ATTACH_STEP);

    // ── Adjacent connections: draw per gap ───────────────────────────────────
    for (let i = 0; i < layers.length - 1; i++) {
        const busY = (
            Math.max(...layerBoxes[i].map(b => b.y + b.height)) +
            Math.min(...layerBoxes[i + 1].map(b => b.y))
        ) / 2;
        const connections: EdgeConnection[] = [];
        all.forEach((c, k) => {
            if (c.adjGap !== i) return;
            connections.push({ parentX: gPX[k], parentBottom: c.parentBottom, childX: gCX[k], childTop: c.childTop });
        });
        edges += drawConnections(connections, busY, Theme.colors.edgePalette);
    }

    // ── Non-adjacent connections: lateral routing ────────────────────────────
    const naIdxs = all.map((c, k) => ({ c, k })).filter(({ c }) => c.adjGap < 0);
    if (naIdxs.length === 0) return edges;

    const allBoxes = layerBoxes.flat();
    const rightBase = Math.max(...allBoxes.map(b => b.x + b.width / 2)) + MARGIN;
    const leftBase  = Math.min(...allBoxes.map(b => b.x - b.width / 2)) - MARGIN;

    const goRight = naIdxs.map(({ c }) => c.childX >= c.parentX);

    // Y-lane assignment: connections sharing the same base Y get stacked.
    const assignYOffsets = (keys: number[]): number[] => {
        const offsets = new Array<number>(keys.length).fill(0);
        const groups = new Map<number, number[]>();
        keys.forEach((key, i) => { if (!groups.has(key)) groups.set(key, []); groups.get(key)!.push(i); });
        for (const idxs of groups.values()) idxs.forEach((idx, pos) => { offsets[idx] = pos * Y_STEP; });
        return offsets;
    };

    const topOffsets = assignYOffsets(naIdxs.map(({ c }) => Math.round(c.parentBottom)));
    const botOffsets = assignYOffsets(naIdxs.map(({ c }) => Math.round(c.childTop)));
    const topYs = naIdxs.map(({ c }, n) => c.parentBottom + TOP_OFFSET + topOffsets[n]);
    const botYs = naIdxs.map(({ c }, n) => c.childTop    - BOT_OFFSET - botOffsets[n]);

    // Highway vertical lane assignment.
    const rightRanges: [number, number][][] = [];
    const leftRanges:  [number, number][][] = [];
    const laneIdx = new Array<number>(naIdxs.length).fill(0);
    naIdxs.forEach((_, n) => {
        const ranges = goRight[n] ? rightRanges : leftRanges;
        let lane = 0;
        for (;;) {
            if (!ranges[lane]) ranges[lane] = [];
            if (!ranges[lane].some(([t, b]) => topYs[n] < b && botYs[n] > t)) {
                ranges[lane].push([topYs[n], botYs[n]]);
                laneIdx[n] = lane;
                break;
            }
            lane++;
        }
    });

    const sideXs = naIdxs.map((_, n) =>
        (goRight[n] ? rightBase : leftBase) + (goRight[n] ? 1 : -1) * laneIdx[n] * SIDE_STEP
    );

    const palette = Theme.colors.edgePalette;

    naIdxs.forEach(({ c, k }, n) => {
        const pX    = gPX[k];
        const cX    = gCX[k];
        const topY  = topYs[n];
        const botY  = botYs[n];
        const sX    = sideXs[n];
        const color = palette[laneIdx[n] % palette.length];

        edges += Line({ x1: pX, y1: c.parentBottom, x2: pX, y2: topY,       stroke: color });
        edges += Line({ x1: pX, y1: topY,            x2: sX, y2: topY,       stroke: color });
        edges += Line({ x1: sX, y1: topY,            x2: sX, y2: botY,       stroke: color });
        edges += Line({ x1: sX, y1: botY,            x2: cX, y2: botY,       stroke: color });
        edges += Line({ x1: cX, y1: botY,            x2: cX, y2: c.childTop, stroke: color });
    });

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
