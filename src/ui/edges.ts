import type { ClassNode, BoxMeasures } from '../types';
import { Theme } from '../config';
import { Line } from './components';

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

    // Layers i > 0: each parent connects to all children in any lower layer j < i.
    // Adjacent (j === i-1): shared bus in the gap between those two layers.
    // Non-adjacent (j < i-1): route outside all intermediate boxes to avoid false visual connections.
    for (let i = 1; i < layerBoxes.length; i++) {
        const parentNodes = orderedLayers[i];
        const parentBoxes = layerBoxes[i];

        const busY = (
            Math.max(...layerBoxes[i].map(box => box.y + box.height)) +
            Math.min(...layerBoxes[i - 1].map(box => box.y))
        ) / 2;

        parentNodes.forEach((parentNode, parentIdx) => {
            const parentBox = parentBoxes[parentIdx];
            let drewVertical = false;

            const drawVerticalIfNeeded = () => {
                if (!drewVertical) {
                    drewVertical = true;
                    edges += Line({ x1: parentBox.x, y1: parentBox.y + parentBox.height, x2: parentBox.x, y2: busY, stroke: Theme.colors.edge });
                }
            };

            for (let j = 0; j < i; j++) {
                const childNodes = orderedLayers[j];
                const childBoxes = layerBoxes[j];

                const children = childNodes
                    .map((childNode, ci) => ({ childNode, childBox: childBoxes[ci] }))
                    .filter(({ childNode }) => (childNode.bases ?? []).includes(parentNode.name));

                if (children.length === 0) continue;

                if (j === i - 1) {
                    drawVerticalIfNeeded();
                    for (const { childBox } of children) {
                        edges += Line({ x1: parentBox.x, y1: busY, x2: childBox.x, y2: busY, stroke: Theme.colors.edge });
                        edges += Line({ x1: childBox.x, y1: busY, x2: childBox.x, y2: childBox.y, stroke: Theme.colors.edge });
                    }
                } else {
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

    // Layers i > 0: each parent connects to its actual children in the layer directly below
    for (let i = 1; i < layerBoxes.length; i++) {
        const parentLayer = layerBoxes[i - 1];
        const childLayer = layerBoxes[i];
        const parentNodes = orderedLayers[i - 1];
        const childNodes = orderedLayers[i];

        const busY = (
            Math.max(...parentLayer.map(box => box.y + box.height)) +
            Math.min(...childLayer.map(box => box.y))
        ) / 2;

        parentNodes.forEach((parentNode, j) => {
            const parentBox = parentLayer[j];
            const children = childNodes
                .map((childNode, k) => ({ childNode, childBox: childLayer[k] }))
                .filter(({ childNode }) => (childNode.bases ?? []).includes(parentNode.name));

            if (children.length === 0) return;

            edges += Line({ x1: parentBox.x, y1: parentBox.y + parentBox.height, x2: parentBox.x, y2: busY, stroke: Theme.colors.edge });
            for (const { childBox } of children) {
                edges += Line({ x1: parentBox.x, y1: busY, x2: childBox.x, y2: busY, stroke: Theme.colors.edge });
                edges += Line({ x1: childBox.x, y1: busY, x2: childBox.x, y2: childBox.y, stroke: Theme.colors.edge });
            }
        });
    }

    return edges;
}
