import type { ClassNode, BoxMeasures } from '../../../types';
import { Theme, UI } from '../../../config';
import { Svg, Group, HtmlRoot, Line } from '../../components';
import {
    renderClassBox,
    measureClassBox,
    collectInheritedNames,
} from '../classBox';
import { renderBaseStyles, renderViewportScript } from '../../utils/viewport';
import { drawConnections, hollowArrow, type EdgeConnection } from '../edges';
import { orderByParentBarycenter } from '../../utils/layout';

const COMPONENT_GAP = 400;

/* =========================================================
   EDGE RENDERING
========================================================= */

// Spreads attachment X positions for connections sharing the same node,
// ordered by the other endpoint's X to minimise crossing at the attachment.
function spreadAttachXs(
    ownXs: number[],
    otherXs: number[],
    step: number
): number[] {
    const result = ownXs.slice();
    const groups = new Map<number, number[]>();
    ownXs.forEach((x, i) => {
        if (!groups.has(x)) {
            groups.set(x, []);
        }
        groups.get(x)!.push(i);
    });
    for (const [ownX, idxs] of groups) {
        if (idxs.length === 1) {
            result[idxs[0]] = ownX;
            continue;
        }
        idxs.sort((a, b) => otherXs[a] - otherXs[b]);
        const half = ((idxs.length - 1) * step) / 2;
        idxs.forEach((idx, pos) => {
            result[idx] = ownX - half + pos * step;
        });
    }
    return result;
}

function renderComponentEdges(
    layers: ClassNode[][],
    layerBoxes: BoxMeasures[][]
): string {
    const SIDE_STEP = 14; // px between parallel highway lanes
    const TOP_OFFSET = 20; // px below parent box for exit horizontal
    const BOT_OFFSET = 10; // px above child box for entry horizontal
    const Y_STEP = 12; // px between stacked exit / entry horizontals
    const MARGIN = 40; // px beyond component boundary for highway
    const ATTACH_STEP = 14; // px between attachment Xs (global, adj + non-adj)
    const ARROW_H = 10; // height of UML arrowhead (must match edges.ts)
    let edges = '';

    // ── Collect ALL connections in one flat list ─────────────────────────────
    // adjGap ≥ 0 means adjacent (gap between layer adjGap and adjGap+1);
    // adjGap = -1 means non-adjacent.
    type Conn = {
        parentX: number;
        parentBottom: number;
        childX: number;
        childTop: number;
        adjGap: number;
    };
    const all: Conn[] = [];

    for (let i = 0; i < layers.length - 1; i++) {
        layers[i].forEach((parent, pi) => {
            layers[i + 1].forEach((child, ci) => {
                if ((child.bases ?? []).some(b => b.id === parent.id)) {
                    all.push({
                        parentX: layerBoxes[i][pi].x,
                        parentBottom:
                            layerBoxes[i][pi].y + layerBoxes[i][pi].height,
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
                    if ((child.bases ?? []).some(b => b.id === parent.id)) {
                        all.push({
                            parentX: layerBoxes[i][pi].x,
                            parentBottom:
                                layerBoxes[i][pi].y + layerBoxes[i][pi].height,
                            childX: layerBoxes[j][ci].x,
                            childTop: layerBoxes[j][ci].y,
                            adjGap: -1,
                        });
                    }
                });
            });
        }
    }
    if (all.length === 0) {
        return edges;
    }

    // Global pX / cX spread across ALL connections from / to each node.
    // Passing pre-computed values as parentX/childX into EdgeConnection makes
    // drawConnections keep them as-is (each value is unique → no further spread).
    const gPX = spreadAttachXs(
        all.map(c => c.parentX),
        all.map(c => c.childX),
        ATTACH_STEP
    );
    const gCX = spreadAttachXs(
        all.map(c => c.childX),
        all.map(c => c.parentX),
        ATTACH_STEP
    );

    // ── Adjacent connections: draw per gap ───────────────────────────────────
    for (let i = 0; i < layers.length - 1; i++) {
        const busY =
            (Math.max(...layerBoxes[i].map(b => b.y + b.height)) +
                Math.min(...layerBoxes[i + 1].map(b => b.y))) /
            2;
        const connections: EdgeConnection[] = [];
        all.forEach((c, k) => {
            if (c.adjGap !== i) {
                return;
            }
            connections.push({
                parentX: gPX[k],
                parentBottom: c.parentBottom,
                childX: gCX[k],
                childTop: c.childTop,
            });
        });
        edges += drawConnections(connections, busY, Theme.colors.edgePalette);
    }

    // ── Non-adjacent connections: lateral routing ────────────────────────────
    const naIdxs = all
        .map((c, k) => ({ c, k }))
        .filter(({ c }) => c.adjGap < 0);
    if (naIdxs.length === 0) {
        return edges;
    }

    const allBoxes = layerBoxes.flat();
    const rightBase =
        Math.max(...allBoxes.map(b => b.x + b.width / 2)) + MARGIN;
    const leftBase = Math.min(...allBoxes.map(b => b.x - b.width / 2)) - MARGIN;

    const componentCenter = rightBase + leftBase;
    const goRight = naIdxs.map(
        ({ c }) => c.childX + c.parentX > componentCenter
    );

    // Y-lane assignment: connections sharing the same base Y get stacked.
    const assignYOffsets = (keys: number[]): number[] => {
        const offsets = new Array<number>(keys.length).fill(0);
        const groups = new Map<number, number[]>();
        keys.forEach((key, i) => {
            if (!groups.has(key)) {
                groups.set(key, []);
            }
            groups.get(key)!.push(i);
        });
        for (const idxs of groups.values()) {
            idxs.forEach((idx, pos) => {
                offsets[idx] = pos * Y_STEP;
            });
        }
        return offsets;
    };

    const topOffsets = assignYOffsets(
        naIdxs.map(({ c }) => Math.round(c.parentBottom))
    );
    const botOffsets = assignYOffsets(
        naIdxs.map(({ c }) => Math.round(c.childTop))
    );
    const topYs = naIdxs.map(
        ({ c }, n) => c.parentBottom + TOP_OFFSET + topOffsets[n]
    );
    const botYs = naIdxs.map(
        ({ c }, n) => c.childTop - BOT_OFFSET - botOffsets[n]
    );

    // Highway vertical lane assignment.
    const rightRanges: [number, number][][] = [];
    const leftRanges: [number, number][][] = [];
    const laneIdx = new Array<number>(naIdxs.length).fill(0);
    naIdxs.forEach((_, n) => {
        const ranges = goRight[n] ? rightRanges : leftRanges;
        let lane = 0;
        for (;;) {
            if (!ranges[lane]) {
                ranges[lane] = [];
            }
            if (!ranges[lane].some(([t, b]) => topYs[n] < b && botYs[n] > t)) {
                ranges[lane].push([topYs[n], botYs[n]]);
                laneIdx[n] = lane;
                break;
            }
            lane++;
        }
    });

    const sideXs = naIdxs.map(
        (_, n) =>
            (goRight[n] ? rightBase : leftBase) +
            (goRight[n] ? 1 : -1) * laneIdx[n] * SIDE_STEP
    );

    const palette = Theme.colors.edgePalette;

    naIdxs.forEach(({ c, k }, n) => {
        const pX = gPX[k];
        const cX = gCX[k];
        const topY = topYs[n];
        const botY = botYs[n];
        const sX = sideXs[n];
        const color = palette[laneIdx[n] % palette.length];

        edges += hollowArrow(pX, c.parentBottom, color);
        edges += Line({
            x1: pX,
            y1: c.parentBottom + ARROW_H,
            x2: pX,
            y2: topY,
            stroke: color,
        });
        edges += Line({ x1: pX, y1: topY, x2: sX, y2: topY, stroke: color });
        edges += Line({ x1: sX, y1: topY, x2: sX, y2: botY, stroke: color });
        edges += Line({ x1: sX, y1: botY, x2: cX, y2: botY, stroke: color });
        edges += Line({
            x1: cX,
            y1: botY,
            x2: cX,
            y2: c.childTop,
            stroke: color,
        });
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
