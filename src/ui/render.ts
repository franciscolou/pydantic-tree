import type { ClassNode, RenderedBox, BoxMeasures } from '../types';
import { Theme, UI } from '../config';
import {
    ClassBox,
    Line,
    Svg,
    Group,
    Text,
    TSpan,
    HtmlRoot,
} from './components';
/* =========================================================
   HELPERS
========================================================= */

function bottomAnchor(y: number, boxHeight: number): number {
    return y + boxHeight;
}

function topAnchor(y: number): number {
    return y;
}

function collectInheritedNames(
    node: ClassNode,
    allNodes: Map<string, ClassNode>
): { attrs: Set<string>; methods: Set<string> } {
    const attrs = new Set<string>();
    const methods = new Set<string>();
    const visited = new Set<string>();
    const stack = [...node.bases];
    while (stack.length) {
        const name = stack.pop()!;
        if (visited.has(name)) continue;
        visited.add(name);
        const base = allNodes.get(name);
        if (!base) continue;
        for (const a of base.attributes) attrs.add(a.name);
        for (const m of base.methods) methods.add(m.name);
        stack.push(...base.bases);
    }
    return { attrs, methods };
}

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

/* =========================================================
   TYPE SPAN RENDERING
========================================================= */

function renderTypeSpans(typeStr: string): string {
    // Split on quoted string literals and square brackets, preserving the delimiters
    const tokens = typeStr.split(/((?:'[^']*')|(?:"[^"]*")|[\[\]])/);
    return tokens
        .map(token => {
            if (!token) return '';
            if ((token.startsWith("'") && token.endsWith("'")) ||
                (token.startsWith('"') && token.endsWith('"'))) {
                return TSpan({ fill: Theme.colors.string, children: token });
            }
            if (token === '[' || token === ']') {
                return TSpan({ fill: Theme.colors.text, children: token });
            }
            return TSpan({ fill: Theme.colors.type, children: token });
        })
        .join('');
}

/* =========================================================
   CLASS BOX RENDERING
========================================================= */

function renderClassBoxSVG(
    node: ClassNode,
    x: number,
    y: number,
    inherited: { attrs: Set<string>; methods: Set<string> }
): RenderedBox {
    const {
        lineHeight,
        headerHeight,
        padding,
        sectionGap,
        sidePadding,
        minWidth,
        maxWidth,
        charWidth,
        borderRadius,
    } = UI.box;

    /* =====================================================
     METHOD LAYOUT (wrap vs single-line)
  ===================================================== */

    const wrapAt = Math.floor((maxWidth - sidePadding) / charWidth);
    const indentStr = '    ';
    const indentPx  = indentStr.length * charWidth;

    interface MethodLayout { wrapped: boolean; measureLines: string[]; }

    const methodLayouts: MethodLayout[] = node.methods.map(m => {
        const singleLine =
            `${m.name}(${m.params.map(p => `${p.name}${p.type ? `: ${p.type}` : ''}`).join(', ')})` +
            `${m.returnType ? ` -> ${m.returnType}` : ''}`;
        if (singleLine.length <= wrapAt) return { wrapped: false, measureLines: [singleLine] };
        return {
            wrapped: true,
            measureLines: [
                `${m.name}(`,
                ...m.params.map(p => `${indentStr}${p.name}${p.type ? `: ${p.type}` : ''},`),
                `) -> ${m.returnType ?? ''}`,
            ],
        };
    });

    /* =====================================================
     WIDTH CALCULATION
  ===================================================== */

    const attrTexts   = node.attributes.map(a => `${a.name}: ${a.type ?? '?'}`);
    const methodTexts = methodLayouts.flatMap(ml => ml.measureLines);

    const longestLineLength = Math.max(
        node.name.length,
        ...attrTexts.map(t => t.length),
        ...methodTexts.map(t => t.length),
        10
    );

    const width = Math.min(
        maxWidth,
        Math.max(minWidth, longestLineLength * charWidth + sidePadding)
    );

    /* =====================================================
     CONTENT RENDERING
  ===================================================== */

    let yCursor = headerHeight + padding;

    const attributesSVG = node.attributes
        .map(attr => {
            const result = Text({
                x: 16,
                y: yCursor,
                fontSize: Theme.font.size.normal,
                children:
                    TSpan({
                        fill: inherited.attrs.has(attr.name) ? Theme.colors.override : Theme.colors.attribute,
                        children: attr.name,
                    }) +
                    TSpan({ fill: Theme.colors.text, children: ': ' }) +
                    renderTypeSpans(attr.type ?? '?'),
            });

            yCursor += lineHeight;
            return result;
        })
        .join('');

    let dividerSVG = '';

    if (node.attributes.length && node.methods.length) {
        const dividerY = yCursor + sectionGap / 2;

        dividerSVG = Line({
            x1: 12,
            y1: dividerY,
            x2: width - 12,
            y2: dividerY,
            stroke: Theme.colors.border,
        });

        yCursor = dividerY + UI.box.methodTopPadding;
    }

    const methodsSVG = node.methods
        .map((method, i) => {
            const methodColor = inherited.methods.has(method.name)
                ? Theme.colors.override
                : Theme.colors.method;

            if (!methodLayouts[i].wrapped) {
                const paramsSVG = method.params
                    .map(p =>
                        TSpan({ fill: Theme.colors.attribute, children: p.name }) +
                        (p.type
                            ? TSpan({ fill: Theme.colors.text, children: ': ' }) + renderTypeSpans(p.type)
                            : '')
                    )
                    .join(TSpan({ fill: Theme.colors.text, children: ', ' }));

                const returnSVG = method.returnType
                    ? TSpan({ fill: Theme.colors.text, children: ' → ' }) + renderTypeSpans(method.returnType)
                    : '';

                const result = Text({
                    x: 16, y: yCursor, fontSize: Theme.font.size.normal,
                    children:
                        TSpan({ fill: methodColor, children: method.name }) +
                        TSpan({ fill: Theme.colors.text, children: '(' }) +
                        paramsSVG +
                        TSpan({ fill: Theme.colors.text, children: ')' }) +
                        returnSVG,
                });
                yCursor += lineHeight;
                return result;
            }

            // Wrapped: name( / indented params / ) → ReturnType
            const lines: string[] = [];

            lines.push(Text({
                x: 16, y: yCursor, fontSize: Theme.font.size.normal,
                children:
                    TSpan({ fill: methodColor, children: method.name }) +
                    TSpan({ fill: Theme.colors.text, children: '(' }),
            }));
            yCursor += lineHeight;

            for (const p of method.params) {
                lines.push(Text({
                    x: 16 + indentPx, y: yCursor, fontSize: Theme.font.size.normal,
                    children:
                        TSpan({ fill: Theme.colors.attribute, children: p.name }) +
                        (p.type
                            ? TSpan({ fill: Theme.colors.text, children: ': ' }) + renderTypeSpans(p.type)
                            : '') +
                        TSpan({ fill: Theme.colors.text, children: ',' }),
                }));
                yCursor += lineHeight;
            }

            lines.push(Text({
                x: 16, y: yCursor, fontSize: Theme.font.size.normal,
                children:
                    TSpan({ fill: Theme.colors.text, children: ')' }) +
                    (method.returnType
                        ? TSpan({ fill: Theme.colors.text, children: ' → ' }) + renderTypeSpans(method.returnType)
                        : ''),
            }));
            yCursor += lineHeight;

            return lines.join('');
        })
        .join('');

    const height = yCursor + padding;

    /* =====================================================
     STRUCTURE
  ===================================================== */

    const panel = ClassBox({
        x: 0,
        y: 0,
        width,
        height,
        borderRadius,
        fill: Theme.colors.panelBackground,
        stroke: Theme.colors.border,
    });

    const header = ClassBox({
        x: 0,
        y: 0,
        width,
        height: headerHeight,
        fill: Theme.colors.headerBackground,
        stroke: 'none',
    });

    const title = Text({
        x: width / 2,
        y: 22,
        textAnchor: 'middle',
        fontSize: Theme.font.size.header,
        fontWeight: Theme.font.weight.bold,
        fill: Theme.colors.headerText,
        children: node.name,
    });

    const clipId = `clip-${node.name.replace(/\W/g, '_')}`;
    const clipDef =
        `<defs><clipPath id="${clipId}">` +
        `<rect x="0" y="${headerHeight}" width="${width}" height="${height - headerHeight}"/>` +
        `</clipPath></defs>`;
    const clippedContent =
        `<g clip-path="url(#${clipId})">${attributesSVG}${dividerSVG}${methodsSVG}</g>`;

    const group = Group({
        transform: `translate(${x - width / 2}, ${y})`,
        children: clipDef + panel + header + title + clippedContent,
    });

    return {
        svg: group,
        width,
        height,
    };
}

/* =========================================================
   TREE RENDERING
========================================================= */

export function renderClassTreeSVG(
    focus: ClassNode,
    ancestorLayers: ClassNode[][],
    descendantLayers: ClassNode[][]
): string {
    const verticalGap = UI.tree.verticalGap;
    const horizontalGap = UI.tree.horizontalGap ?? 120;

    const allNodes = new Map<string, ClassNode>();
    allNodes.set(focus.name, focus);
    for (const layer of ancestorLayers) for (const n of layer) allNodes.set(n.name, n);
    for (const layer of descendantLayers) for (const n of layer) allNodes.set(n.name, n);

    let boxes = '';
    let edges = '';

    const focusRendered = renderClassBoxSVG(focus, 0, 0, collectInheritedNames(focus, allNodes));
    boxes += focusRendered.svg;

    function renderLayer(layer: ClassNode[], centerY: number) {
        const inheritedPerNode = layer.map(n => collectInheritedNames(n, allNodes));
        const pre = layer.map((n, i) => renderClassBoxSVG(n, 0, 0, inheritedPerNode[i]));

        const totalWidth =
            pre.reduce((s, r) => s + r.width, 0) +
            (layer.length - 1) * horizontalGap;

        let xCursor = -totalWidth / 2;

        const positioned: BoxMeasures[] = [];

        layer.forEach((node, i) => {
            const x = xCursor + pre[i].width / 2;
            const y = centerY;

            const rendered = renderClassBoxSVG(node, x, y, inheritedPerNode[i]);
            boxes += rendered.svg;

            positioned.push({
                x,
                y,
                width: rendered.width,
                height: rendered.height,
            });

            xCursor += pre[i].width + horizontalGap;
        });

        return positioned;
    }

    /* -------------------------
     LAYER ORDERING
  ------------------------- */

    // Chain depth for ancestors: how many more layers above each node exist in the tree.
    // Checks ALL layers above i (not just i+1) to handle non-adjacent inheritance edges that
    // arise from longest-path layering (e.g. SizedObject at layer 0 whose parent FileSystemObject
    // is at layer 3 rather than layer 1).
    const ancestorChainDepths: number[][] = new Array(ancestorLayers.length);
    for (let i = ancestorLayers.length - 1; i >= 0; i--) {
        ancestorChainDepths[i] = ancestorLayers[i].map(node => {
            let maxDepth = 0;
            for (let j = i + 1; j < ancestorLayers.length; j++) {
                ancestorLayers[j].forEach((p, k) => {
                    if ((node.bases ?? []).includes(p.name)) {
                        maxDepth = Math.max(maxDepth, ancestorChainDepths[j][k] + 1);
                    }
                });
            }
            return maxDepth;
        });
    }
    const orderedAncestorLayers = ancestorLayers.map((layer, i) =>
        centerOutSort(layer, ancestorChainDepths[i])
    );

    // Chain depth for descendants: how many more layers below each node exist in the tree.
    const descendantChainDepths: number[][] = new Array(descendantLayers.length);
    for (let i = descendantLayers.length - 1; i >= 0; i--) {
        descendantChainDepths[i] = descendantLayers[i].map(node => {
            if (i === descendantLayers.length - 1) return 0;
            const childDepths = descendantLayers[i + 1]
                .map((c, j) => ({ d: descendantChainDepths[i + 1][j], match: (c.bases ?? []).includes(node.name) }))
                .filter(x => x.match)
                .map(x => x.d);
            return childDepths.length > 0 ? 1 + Math.max(...childDepths) : 0;
        });
    }
    const orderedDescendantLayers = descendantLayers.map((layer, i) =>
        centerOutSort(layer, descendantChainDepths[i])
    );

    /* -------------------------
     ANCESTORS
  ------------------------- */

    let currentY = 0;

    const ancestorLayerBoxes: BoxMeasures[][] = [];

    for (const layer of orderedAncestorLayers) {
        const inherited = layer.map(n => collectInheritedNames(n, allNodes));
        const maxH = Math.max(...layer.map((n, j) => renderClassBoxSVG(n, 0, 0, inherited[j]).height));
        currentY -= verticalGap + maxH;
        ancestorLayerBoxes.push(renderLayer(layer, currentY));
    }

    /* -------------------------
     EDGES ANCESTORS → FOCUS
  ------------------------- */

    // Layer 0: shared bus — all direct parents connect to the focus via a single bus at x=0
    if (ancestorLayerBoxes.length > 0) {
        const layer = ancestorLayerBoxes[0];
        const layerBottom = Math.max(...layer.map(b => bottomAnchor(b.y, b.height)));
        const midY = (layerBottom + topAnchor(0)) / 2;
        const xs = layer.map(b => b.x);
        edges += Line({ x1: Math.min(...xs, 0), y1: midY, x2: Math.max(...xs, 0), y2: midY, stroke: Theme.colors.edge });
        layer.forEach(box => {
            edges += Line({ x1: box.x, y1: bottomAnchor(box.y, box.height), x2: box.x, y2: midY, stroke: Theme.colors.edge });
        });
        edges += Line({ x1: 0, y1: midY, x2: 0, y2: topAnchor(0), stroke: Theme.colors.edge });
    }

    // Layers i > 0: each parent connects to ALL children in any lower layer j < i.
    // - Adjacent (j = i-1): use a shared bus in the gap just below layer i.
    // - Non-adjacent (j < i-1): route around the outside of the diagram to avoid
    //   passing through intermediate boxes, which would create false visual connections.
    for (let i = 1; i < ancestorLayerBoxes.length; i++) {
        const parentNodes = orderedAncestorLayers[i];
        const parentBoxes = ancestorLayerBoxes[i];

        // adjacentBusY: gap between layer i (above) and layer i-1 (below)
        const adjacentBusY = (
            Math.max(...ancestorLayerBoxes[i].map(b => bottomAnchor(b.y, b.height))) +
            Math.min(...ancestorLayerBoxes[i - 1].map(b => b.y))
        ) / 2;

        parentNodes.forEach((pNode, pIdx) => {
            const p = parentBoxes[pIdx];
            let drewVertical = false;

            const drawVerticalIfNeeded = () => {
                if (!drewVertical) {
                    drewVertical = true;
                    edges += Line({ x1: p.x, y1: bottomAnchor(p.y, p.height), x2: p.x, y2: adjacentBusY, stroke: Theme.colors.edge });
                }
            };

            for (let j = 0; j < i; j++) {
                const childNodes = orderedAncestorLayers[j];
                const childBoxes = ancestorLayerBoxes[j];

                const children = childNodes
                    .map((cNode, ci) => ({ cNode, cBox: childBoxes[ci] }))
                    .filter(({ cNode }) => (cNode.bases ?? []).includes(pNode.name));

                if (children.length === 0) continue;

                if (j === i - 1) {
                    // Adjacent: drop straight from the shared bus to the child
                    drawVerticalIfNeeded();
                    children.forEach(({ cBox }) => {
                        edges += Line({ x1: p.x, y1: adjacentBusY, x2: cBox.x, y2: adjacentBusY, stroke: Theme.colors.edge });
                        edges += Line({ x1: cBox.x, y1: adjacentBusY, x2: cBox.x, y2: cBox.y, stroke: Theme.colors.edge });
                    });
                } else {
                    // Non-adjacent: route outside all intermediate boxes to avoid crossing them.
                    // Path: parent → adjacentBusY → sideX → childBusY (alongside the outside) → child
                    const childBusY = (
                        Math.max(...ancestorLayerBoxes[j + 1].map(b => bottomAnchor(b.y, b.height))) +
                        Math.min(...ancestorLayerBoxes[j].map(b => b.y))
                    ) / 2;

                    // Collect all boxes from layer j to layer i that the route passes near
                    const nearbyBoxes: BoxMeasures[] = [];
                    for (let k = j; k <= i; k++) nearbyBoxes.push(...ancestorLayerBoxes[k]);

                    const margin = 40;

                    children.forEach(({ cBox }) => {
                        const routeRight = cBox.x >= 0;
                        const sideX = routeRight
                            ? Math.max(...nearbyBoxes.map(b => b.x + b.width / 2)) + margin
                            : Math.min(...nearbyBoxes.map(b => b.x - b.width / 2)) - margin;

                        drawVerticalIfNeeded();
                        // parent's bus → outside column → child's bus → child top
                        edges += Line({ x1: p.x, y1: adjacentBusY, x2: sideX, y2: adjacentBusY, stroke: Theme.colors.edge });
                        edges += Line({ x1: sideX, y1: adjacentBusY, x2: sideX, y2: childBusY, stroke: Theme.colors.edge });
                        edges += Line({ x1: sideX, y1: childBusY, x2: cBox.x, y2: childBusY, stroke: Theme.colors.edge });
                        edges += Line({ x1: cBox.x, y1: childBusY, x2: cBox.x, y2: cBox.y, stroke: Theme.colors.edge });
                    });
                }
            }
        });
    }

    /* -------------------------
     DESCENDANTS
  ------------------------- */

    currentY = bottomAnchor(0, focusRendered.height) + verticalGap;

    const descendantLayerBoxes: BoxMeasures[][] = [];

    orderedDescendantLayers.forEach(layer => {
        const layerBoxes = renderLayer(layer, currentY);

        const maxHeight = Math.max(...layerBoxes.map(b => b.height));
        currentY += maxHeight + verticalGap;

        descendantLayerBoxes.push(layerBoxes);
    });

    /* -------------------------
     EDGES FOCUS → DESCENDANTS
  ------------------------- */

    // Layer 0: shared bus — focus connects to all direct children via a single bus at x=0
    if (descendantLayerBoxes.length > 0) {
        const layer = descendantLayerBoxes[0];
        const layerTop = Math.min(...layer.map(b => topAnchor(b.y)));
        const midY = (bottomAnchor(0, focusRendered.height) + layerTop) / 2;
        const xs = layer.map(b => b.x);
        edges += Line({ x1: 0, y1: bottomAnchor(0, focusRendered.height), x2: 0, y2: midY, stroke: Theme.colors.edge });
        edges += Line({ x1: Math.min(...xs, 0), y1: midY, x2: Math.max(...xs, 0), y2: midY, stroke: Theme.colors.edge });
        layer.forEach(box => {
            edges += Line({ x1: box.x, y1: midY, x2: box.x, y2: topAnchor(box.y), stroke: Theme.colors.edge });
        });
    }

    // Layers i > 0: each node connects only to its actual children in the layer below
    for (let i = 1; i < descendantLayerBoxes.length; i++) {
        const parentLayer = descendantLayerBoxes[i - 1];
        const childLayer  = descendantLayerBoxes[i];
        const parentNodes = orderedDescendantLayers[i - 1];
        const childNodes  = orderedDescendantLayers[i];
        const midY = (
            Math.max(...parentLayer.map(b => bottomAnchor(b.y, b.height))) +
            Math.min(...childLayer.map(b => b.y))
        ) / 2;

        parentNodes.forEach((pNode, j) => {
            const p = parentLayer[j];
            const children = childNodes
                .map((cNode, k) => ({ cNode, cBox: childLayer[k] }))
                .filter(({ cNode }) => (cNode.bases ?? []).includes(pNode.name));

            if (children.length === 0) return;

            edges += Line({ x1: p.x, y1: bottomAnchor(p.y, p.height), x2: p.x, y2: midY, stroke: Theme.colors.edge });
            children.forEach(({ cBox }) => {
                edges += Line({ x1: p.x, y1: midY, x2: cBox.x, y2: midY, stroke: Theme.colors.edge });
                edges += Line({ x1: cBox.x, y1: midY, x2: cBox.x, y2: cBox.y, stroke: Theme.colors.edge });
            });
        });
    }

    return HtmlRoot(
        Svg({
            width: '100%',
            height: '100%',
            viewBox: '0 0 2000 2000',
            children:
                `<style>text{font-family:${Theme.font.family};}</style>` +
                Group({
                    transform: `translate(${UI.tree.initialTranslate.x},
                                  ${UI.tree.initialTranslate.y}) scale(1)`,
                    children: edges + boxes,
                }) +
                renderViewportScript(),
        })
    );
}

/* =========================================================
   VIEWPORT SCRIPT
   ========================================================= */

function renderViewportScript(): string {
    return `
<script>
  const svg = document.getElementById("svgRoot");
  const viewport = document.getElementById("viewport");

  let isPanning = false;
  let lastX = 0;
  let lastY = 0;

  let tx = ${UI.tree.initialTranslate.x};
  let ty = ${UI.tree.initialTranslate.y};
  let scale = 1;

  const PAN_SENSITIVITY = ${UI.pan.sensitivity};
  const MIN_SCALE = ${UI.zoom.min};
  const MAX_SCALE = ${UI.zoom.max};
  const ZOOM_STEP = ${UI.zoom.step};

  function update() {
    viewport.setAttribute(
      "transform",
      "translate(" + tx + "," + ty + ") scale(" + scale + ")"
    );
  }

  svg.style.cursor = "grab";
  svg.style.userSelect = "none";

  svg.addEventListener("pointerdown", e => {
    if (e.button !== 0) return;
    isPanning = true;
    lastX = e.clientX;
    lastY = e.clientY;
    svg.setPointerCapture(e.pointerId);
    svg.style.cursor = "grabbing";
  });

  svg.addEventListener("pointermove", e => {
    if (!isPanning) return;
    tx += (e.clientX - lastX) * PAN_SENSITIVITY;
    ty += (e.clientY - lastY) * PAN_SENSITIVITY;
    lastX = e.clientX;
    lastY = e.clientY;
    update();
  });

  function endPan(e) {
    isPanning = false;
    svg.style.cursor = "grab";
    try { svg.releasePointerCapture(e.pointerId); } catch {}
  }

  svg.addEventListener("pointerup", endPan);
  svg.addEventListener("pointercancel", endPan);

  svg.addEventListener("wheel", e => {
    e.preventDefault();

    const r = svg.getBoundingClientRect();
    const mx = e.clientX - r.left;
    const my = e.clientY - r.top;

    const dir = e.deltaY < 0 ? 1 : -1;
    const factor = 1 + dir * ZOOM_STEP;

    const newScale = Math.min(
      MAX_SCALE,
      Math.max(MIN_SCALE, scale * factor)
    );

    tx = mx - (mx - tx) * (newScale / scale);
    ty = my - (my - ty) * (newScale / scale);
    scale = newScale;

    update();
  }, { passive: false });

  update();
</script>
`;
}
