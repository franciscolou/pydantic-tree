import type { ClassNode, BoxMeasures } from '../types';
import { Theme } from '../config';
import { Line } from './components';

const LANE_STEP = 18;

/* =========================================================
   EDGE LANE ASSIGNMENT
========================================================= */

interface EdgeConnection {
    parentX: number;
    parentBottom: number;
    childX: number;
    childTop: number;
}

// Assigns a Y offset to each horizontal segment so that overlapping segments
// land on distinct lanes. Non-overlapping segments share lane 0.
// Lanes are ordered center-outward: 0, +STEP, -STEP, +2*STEP, -2*STEP, ...
function assignEdgeLanes(segments: [number, number][], step: number): number[] {
    const n = segments.length;
    if (n <= 1) return new Array(n).fill(0);

    const normalized = segments.map(([a, b]) => [Math.min(a, b), Math.max(a, b)] as [number, number]);

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
            const conflicts = occupied.some(([ol, or_]) => left < or_ && right > ol);
            if (!conflicts) {
                result[i] = offset;
                if (!laneRanges.has(offset)) laneRanges.set(offset, []);
                laneRanges.get(offset)!.push([left, right]);
                break;
            }
        }
    }

    return result;
}

// Draws each connection as three segments (vertical → horizontal → vertical),
// with lane-assigned Y so crossing connections don't overlap.
function drawConnections(connections: EdgeConnection[], busY: number): string {
    if (connections.length === 0) return '';
    const laneOffsets = assignEdgeLanes(connections.map(c => [c.parentX, c.childX]), LANE_STEP);
    let svg = '';
    connections.forEach(({ parentX, parentBottom, childX, childTop }, i) => {
        const edgeY = busY + laneOffsets[i];
        svg += Line({ x1: parentX, y1: parentBottom, x2: parentX, y2: edgeY, stroke: Theme.colors.edge });
        svg += Line({ x1: parentX, y1: edgeY, x2: childX, y2: edgeY, stroke: Theme.colors.edge });
        svg += Line({ x1: childX, y1: edgeY, x2: childX, y2: childTop, stroke: Theme.colors.edge });
    });
    return svg;
}

/* =========================================================
   ANCESTOR EDGES
========================================================= */

export function renderAncestorEdges(
    orderedLayers: ClassNode[][],
    layerBoxes: BoxMeasures[][],
    focusTopY: number
): string {
    let edges = '';

    if (layerBoxes.length === 0) return edges;

    // Layer 0: shared bus — all direct parents connect to the focus via a single horizontal bus
    const layer0Boxes = layerBoxes[0];
    const layer0Bottom = Math.max(...layer0Boxes.map(box => box.y + box.height));
    const busY0 = (layer0Bottom + focusTopY) / 2;
    const centerXs0 = layer0Boxes.map(box => box.x);

    edges += Line({ x1: Math.min(...centerXs0, 0), y1: busY0, x2: Math.max(...centerXs0, 0), y2: busY0, stroke: Theme.colors.edge });
    for (const box of layer0Boxes) {
        edges += Line({ x1: box.x, y1: box.y + box.height, x2: box.x, y2: busY0, stroke: Theme.colors.edge });
    }
    edges += Line({ x1: 0, y1: busY0, x2: 0, y2: focusTopY, stroke: Theme.colors.edge });

    for (let i = 1; i < layerBoxes.length; i++) {
        const parentNodes = orderedLayers[i];
        const parentBoxes = layerBoxes[i];

        const busY = (
            Math.max(...layerBoxes[i].map(box => box.y + box.height)) +
            Math.min(...layerBoxes[i - 1].map(box => box.y))
        ) / 2;

        // Adjacent connections (j === i-1): collect all across every parent, assign lanes, draw.
        const adjacentConnections: EdgeConnection[] = [];
        parentNodes.forEach((parentNode, parentIdx) => {
            const parentBox = parentBoxes[parentIdx];
            const childNodes = orderedLayers[i - 1];
            const childBoxes = layerBoxes[i - 1];
            childNodes.forEach((childNode, ci) => {
                if ((childNode.bases ?? []).includes(parentNode.name)) {
                    adjacentConnections.push({
                        parentX: parentBox.x,
                        parentBottom: parentBox.y + parentBox.height,
                        childX: childBoxes[ci].x,
                        childTop: childBoxes[ci].y,
                    });
                }
            });
        });
        edges += drawConnections(adjacentConnections, busY);

        // Non-adjacent connections (j < i-1): route outside intermediate boxes.
        parentNodes.forEach((parentNode, parentIdx) => {
            const parentBox = parentBoxes[parentIdx];
            let drewVertical = false;

            const drawVerticalIfNeeded = () => {
                if (!drewVertical) {
                    drewVertical = true;
                    edges += Line({ x1: parentBox.x, y1: parentBox.y + parentBox.height, x2: parentBox.x, y2: busY, stroke: Theme.colors.edge });
                }
            };

            for (let j = 0; j < i - 1; j++) {
                const childNodes = orderedLayers[j];
                const childBoxes = layerBoxes[j];

                const children = childNodes
                    .map((childNode, ci) => ({ childNode, childBox: childBoxes[ci] }))
                    .filter(({ childNode }) => (childNode.bases ?? []).includes(parentNode.name));

                if (children.length === 0) continue;

                const childBusY = (
                    Math.max(...layerBoxes[j + 1].map(box => box.y + box.height)) +
                    Math.min(...layerBoxes[j].map(box => box.y))
                ) / 2;

                const nearbyBoxes: BoxMeasures[] = [];
                for (let k = j; k <= i; k++) nearbyBoxes.push(...layerBoxes[k]);
                const margin = 40;

                for (const { childBox } of children) {
                    const routeRight = childBox.x >= 0;
                    const sideX = routeRight
                        ? Math.max(...nearbyBoxes.map(box => box.x + box.width / 2)) + margin
                        : Math.min(...nearbyBoxes.map(box => box.x - box.width / 2)) - margin;

                    drawVerticalIfNeeded();
                    edges += Line({ x1: parentBox.x, y1: busY, x2: sideX, y2: busY, stroke: Theme.colors.edge });
                    edges += Line({ x1: sideX, y1: busY, x2: sideX, y2: childBusY, stroke: Theme.colors.edge });
                    edges += Line({ x1: sideX, y1: childBusY, x2: childBox.x, y2: childBusY, stroke: Theme.colors.edge });
                    edges += Line({ x1: childBox.x, y1: childBusY, x2: childBox.x, y2: childBox.y, stroke: Theme.colors.edge });
                }
            }
        });
    }

    return edges;
}

/* =========================================================
   DESCENDANT EDGES
========================================================= */

export function renderDescendantEdges(
    orderedLayers: ClassNode[][],
    layerBoxes: BoxMeasures[][],
    focusBottomY: number
): string {
    let edges = '';

    if (layerBoxes.length === 0) return edges;

    // Layer 0: shared bus — focus connects to all direct children via a single horizontal bus
    const layer0Boxes = layerBoxes[0];
    const layer0Top = Math.min(...layer0Boxes.map(box => box.y));
    const busY0 = (focusBottomY + layer0Top) / 2;
    const centerXs0 = layer0Boxes.map(box => box.x);

    edges += Line({ x1: 0, y1: focusBottomY, x2: 0, y2: busY0, stroke: Theme.colors.edge });
    edges += Line({ x1: Math.min(...centerXs0, 0), y1: busY0, x2: Math.max(...centerXs0, 0), y2: busY0, stroke: Theme.colors.edge });
    for (const box of layer0Boxes) {
        edges += Line({ x1: box.x, y1: busY0, x2: box.x, y2: box.y, stroke: Theme.colors.edge });
    }

    // Layers i > 0: collect all connections for this gap, assign lanes, draw.
    for (let i = 1; i < layerBoxes.length; i++) {
        const parentLayer = layerBoxes[i - 1];
        const childLayer = layerBoxes[i];
        const parentNodes = orderedLayers[i - 1];
        const childNodes = orderedLayers[i];

        const busY = (
            Math.max(...parentLayer.map(box => box.y + box.height)) +
            Math.min(...childLayer.map(box => box.y))
        ) / 2;

        const connections: EdgeConnection[] = [];
        parentNodes.forEach((parentNode, j) => {
            const parentBox = parentLayer[j];
            childNodes.forEach((childNode, k) => {
                if ((childNode.bases ?? []).includes(parentNode.name)) {
                    connections.push({
                        parentX: parentBox.x,
                        parentBottom: parentBox.y + parentBox.height,
                        childX: childLayer[k].x,
                        childTop: childLayer[k].y,
                    });
                }
            });
        });

        edges += drawConnections(connections, busY);
    }

    return edges;
}
