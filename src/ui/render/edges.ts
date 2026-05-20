import type { ClassNode, BoxMeasures } from '../../types';
import { Theme } from '../../config';
import { Line } from '../components';

const LANE_STEP = 18;
const ATTACH_STEP = 14;
const ARROW_W = 12;
const ARROW_H = 10;

export function hollowArrow(x: number, y: number, color: string): string {
    return `<polygon points="${x},${y} ${x - ARROW_W / 2},${y + ARROW_H} ${x + ARROW_W / 2},${y + ARROW_H}" fill="none" stroke="${color}" stroke-width="1.5"/>`;
}

function escapeAttr(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;');
}

// Interactive arrow: emits an enlarged transparent hit area plus the visible
// polygon, wrapped in a group carrying the child/parent class IDs so the
// webview can detect drag-and-drop of the inheritance arrow.
function interactiveHollowArrow(
    x: number,
    y: number,
    color: string,
    childId: string,
    parentId: string,
    childName?: string,
    parentName?: string
): string {
    const pad = 6;
    const hitArea = `<polygon points="${x},${y - pad} ${x - ARROW_W / 2 - pad},${y + ARROW_H + pad} ${x + ARROW_W / 2 + pad},${y + ARROW_H + pad}" fill="transparent" stroke="none"/>`;
    const arrow = hollowArrow(x, y, color);
    const nameAttrs =
        childName && parentName
            ? ` data-pt-edge-child-name="${escapeAttr(childName)}" data-pt-edge-parent-name="${escapeAttr(parentName)}"`
            : '';
    return `<g data-pt-edge="1" data-pt-edge-child="${escapeAttr(childId)}" data-pt-edge-parent="${escapeAttr(parentId)}"${nameAttrs} style="cursor: grab">${hitArea}${arrow}</g>`;
}

/* =========================================================
   EDGE LANE ASSIGNMENT
========================================================= */

export interface EdgeConnection {
    parentX: number;
    parentBottom: number;
    childX: number;
    childTop: number;
    parentId?: string;
    childId?: string;
    parentName?: string;
    childName?: string;
}

// Assigns a Y offset to each horizontal segment so that overlapping segments
// land on distinct lanes. Non-overlapping segments share lane 0.
// Lanes are ordered center-outward: 0, +STEP, -STEP, +2*STEP, -2*STEP, ...
function assignEdgeLanes(segments: [number, number][], step: number): number[] {
    const n = segments.length;
    if (n <= 1) {
        return new Array(n).fill(0);
    }

    const normalized = segments.map(
        ([a, b]) => [Math.min(a, b), Math.max(a, b)] as [number, number]
    );

    const laneOrder: number[] = [0];
    for (let i = 1; i <= n; i++) {
        laneOrder.push(i * step, -(i * step));
    }

    const laneRanges = new Map<number, [number, number][]>();
    const result = new Array<number>(n).fill(0);

    for (let i = 0; i < n; i++) {
        const [left, right] = normalized[i];
        for (const offset of laneOrder) {
            const occupied = laneRanges.get(offset) ?? [];
            const conflicts = occupied.some(
                ([ol, rangeEnd]) => left < rangeEnd && right > ol
            );
            if (!conflicts) {
                result[i] = offset;
                if (!laneRanges.has(offset)) {
                    laneRanges.set(offset, []);
                }
                laneRanges.get(offset)!.push([left, right]);
                break;
            }
        }
    }

    return result;
}

/* =========================================================
   INTERSECTION DETECTION
========================================================= */

// Returns true if a horizontal segment (at y=hy, from hx1 to hx2) strictly
// crosses a vertical segment (at x=vx, from vy1 to vy2) in the interior.
function hVIntersect(
    hy: number,
    hx1: number,
    hx2: number,
    vx: number,
    vy1: number,
    vy2: number
): boolean {
    const minHX = Math.min(hx1, hx2),
        maxHX = Math.max(hx1, hx2);
    const minVY = Math.min(vy1, vy2),
        maxVY = Math.max(vy1, vy2);
    return minHX < vx && vx < maxHX && minVY < hy && hy < maxVY;
}

// Returns true if two Y-ranges strictly overlap (share more than an endpoint).
function rangesOverlap(
    a1: number,
    a2: number,
    b1: number,
    b2: number
): boolean {
    const minA = Math.min(a1, a2),
        maxA = Math.max(a1, a2);
    const minB = Math.min(b1, b2),
        maxB = Math.max(b1, b2);
    return minA < maxB && minB < maxA;
}

// Two connections collide if any of their 3-segment paths cross geometrically.
// Checks H vs V crossings and V vs V overlaps (same-parent or same-child).
function connectionsIntersect(
    ci: EdgeConnection,
    eyi: number,
    cj: EdgeConnection,
    eyj: number
): boolean {
    // H_i vs parent-vertical_j and child-vertical_j
    if (
        hVIntersect(
            eyi,
            ci.parentX,
            ci.childX,
            cj.parentX,
            cj.parentBottom,
            eyj
        )
    ) {
        return true;
    }
    if (hVIntersect(eyi, ci.parentX, ci.childX, cj.childX, eyj, cj.childTop)) {
        return true;
    }
    // H_j vs parent-vertical_i and child-vertical_i
    if (
        hVIntersect(
            eyj,
            cj.parentX,
            cj.childX,
            ci.parentX,
            ci.parentBottom,
            eyi
        )
    ) {
        return true;
    }
    if (hVIntersect(eyj, cj.parentX, cj.childX, ci.childX, eyi, ci.childTop)) {
        return true;
    }
    // Same parent → parent verticals overlap on the same X
    if (
        ci.parentX === cj.parentX &&
        rangesOverlap(ci.parentBottom, eyi, cj.parentBottom, eyj)
    ) {
        return true;
    }
    // Same child → child verticals overlap on the same X
    if (
        ci.childX === cj.childX &&
        rangesOverlap(eyi, ci.childTop, eyj, cj.childTop)
    ) {
        return true;
    }
    return false;
}

/* =========================================================
   CONNECTION DRAWING
========================================================= */

// Spreads attachment X positions for connections sharing the same node,
// ordered by the other endpoint's X to minimise crossing at the attachment.
export function spreadAttachXs(
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

function computeAttachXs(ownXs: number[], otherXs: number[]): number[] {
    return spreadAttachXs(ownXs, otherXs, ATTACH_STEP);
}

// Draws each connection as three segments (vertical → horizontal → vertical).
// Colors are assigned via greedy graph coloring on the geometric intersection graph,
// ensuring no two visually crossing connections share a color.
// Attachment points on each node are spread horizontally when multiple edges share
// the same node, ordered to mirror the other endpoint to minimise extra crossings.
export function drawConnections(
    connections: EdgeConnection[],
    busY: number,
    palette: readonly string[]
): string {
    if (connections.length === 0) {
        return '';
    }

    const n = connections.length;
    const laneOffsets = assignEdgeLanes(
        connections.map(c => [c.parentX, c.childX]),
        LANE_STEP
    );
    const edgeYs = laneOffsets.map(lo => busY + lo);

    const parentAttachXs = computeAttachXs(
        connections.map(c => c.parentX),
        connections.map(c => c.childX)
    );
    const childAttachXs = computeAttachXs(
        connections.map(c => c.childX),
        connections.map(c => c.parentX)
    );

    const colorIndices = new Array<number>(n).fill(0);
    for (let i = 0; i < n; i++) {
        const used = new Set<number>();
        for (let j = 0; j < i; j++) {
            if (
                connectionsIntersect(
                    connections[i],
                    edgeYs[i],
                    connections[j],
                    edgeYs[j]
                )
            ) {
                used.add(colorIndices[j]);
            }
        }
        let c = 0;
        while (used.has(c)) {
            c++;
        }
        colorIndices[i] = c;
    }

    let svg = '';
    connections.forEach((conn, i) => {
        const {
            parentBottom,
            childTop,
            parentId,
            childId,
            parentName,
            childName,
        } = conn;
        const edgeY = edgeYs[i];
        const color = palette[colorIndices[i] % palette.length];
        const pX = parentAttachXs[i];
        const cX = childAttachXs[i];
        svg +=
            parentId && childId
                ? interactiveHollowArrow(
                      pX,
                      parentBottom,
                      color,
                      childId,
                      parentId,
                      childName,
                      parentName
                  )
                : hollowArrow(pX, parentBottom, color);
        svg += Line({
            x1: pX,
            y1: parentBottom + ARROW_H,
            x2: pX,
            y2: edgeY,
            stroke: color,
        });
        svg += Line({ x1: pX, y1: edgeY, x2: cX, y2: edgeY, stroke: color });
        svg += Line({ x1: cX, y1: edgeY, x2: cX, y2: childTop, stroke: color });
    });
    return svg;
}

/* =========================================================
   LAYERED EDGES — unified renderer for any layered DAG.
   Used by the project tree directly and by the ancestor/descendant
   renderers below (which inject the focus class as a layer of size 1).
   Handles:
     - adjacent-layer connections via drawConnections (with lanes, palette)
     - non-adjacent (skip-layer) connections routed through a lateral
       highway, with vertical Y offsets per shared parent/child and
       horizontal lane offsets per side.
========================================================= */

export function renderLayeredEdges(
    layers: ClassNode[][],
    layerBoxes: BoxMeasures[][]
): string {
    const SIDE_STEP = 14;
    const TOP_OFFSET = 20;
    const BOT_OFFSET = 10;
    const Y_STEP = 12;
    const MARGIN = 40;

    let edges = '';

    type Conn = {
        parentX: number;
        parentBottom: number;
        childX: number;
        childTop: number;
        adjGap: number;
        parentId: string;
        childId: string;
        parentName: string;
        childName: string;
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
                        parentId: parent.id,
                        childId: child.id,
                        parentName: parent.name,
                        childName: child.name,
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
                            parentId: parent.id,
                            childId: child.id,
                            parentName: parent.name,
                            childName: child.name,
                        });
                    }
                });
            });
        }
    }
    if (all.length === 0) {
        return edges;
    }

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
                parentId: c.parentId,
                childId: c.childId,
                parentName: c.parentName,
                childName: c.childName,
            });
        });
        edges += drawConnections(connections, busY, Theme.colors.edgePalette);
    }

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

        edges += interactiveHollowArrow(
            pX,
            c.parentBottom,
            color,
            c.childId,
            c.parentId,
            c.childName,
            c.parentName
        );
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
   ANCESTOR / DESCENDANT EDGES
   Thin wrappers around renderLayeredEdges. They inject the focus
   class as a layer of size 1 so it participates in lane assignment
   and highway routing exactly like any other class.
========================================================= */

export function renderAncestorEdges(
    orderedLayers: ClassNode[][],
    layerBoxes: BoxMeasures[][],
    focus: ClassNode,
    focusBox: BoxMeasures
): string {
    // orderedLayers[0] = depth-1 ancestors (closest to focus, largest y).
    // Reverse so deepest ancestor (most negative y) comes first; focus is the
    // last layer (largest y).
    const layers = [...orderedLayers].reverse();
    layers.push([focus]);
    const boxes = [...layerBoxes].reverse();
    boxes.push([focusBox]);
    return renderLayeredEdges(layers, boxes);
}

export function renderDescendantEdges(
    orderedLayers: ClassNode[][],
    layerBoxes: BoxMeasures[][],
    focus: ClassNode,
    focusBox: BoxMeasures
): string {
    // orderedLayers[0] = depth-1 descendants. Focus is the first layer (smallest y).
    const layers = [[focus], ...orderedLayers];
    const boxes = [[focusBox], ...layerBoxes];
    return renderLayeredEdges(layers, boxes);
}
