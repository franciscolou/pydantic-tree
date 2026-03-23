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

/* =========================================================
   CLASS BOX RENDERING
========================================================= */

function renderClassBoxSVG(node: ClassNode, x: number, y: number): RenderedBox {
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
     WIDTH CALCULATION
  ===================================================== */

    const attrTexts = node.attributes.map(a => `${a.name}: ${a.type ?? '?'}`);

    const methodTexts = node.methods.map(m => {
        const params = m.params
            .map(p => `${p.name}${p.type ? `: ${p.type}` : ''}`)
            .join(', ');
        return `${m.name}(${params})${m.returnType ? ` -> ${m.returnType}` : ''}`;
    });

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
                        fill: Theme.colors.attribute,
                        children: attr.name,
                    }) +
                    TSpan({ fill: Theme.colors.text, children: ': ' }) +
                    TSpan({
                        fill: Theme.colors.type,
                        children: attr.type ?? '?',
                    }),
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
        .map(method => {
            const paramsSVG = method.params
                .map(
                    p =>
                        TSpan({
                            fill: Theme.colors.attribute,
                            children: p.name,
                        }) +
                        (p.type
                            ? TSpan({
                                  fill: Theme.colors.text,
                                  children: ': ',
                              }) +
                              TSpan({
                                  fill: Theme.colors.type,
                                  children: p.type,
                              })
                            : '')
                )
                .join(
                    TSpan({
                        fill: Theme.colors.text,
                        children: ', ',
                    })
                );

            const returnSVG = method.returnType
                ? TSpan({
                      fill: Theme.colors.text,
                      children: ' → ',
                  }) +
                  TSpan({
                      fill: Theme.colors.type,
                      children: method.returnType,
                  })
                : '';

            const result = Text({
                x: 16,
                y: yCursor,
                fontSize: Theme.font.size.normal,
                children:
                    TSpan({
                        fill: Theme.colors.method,
                        children: method.name,
                    }) +
                    TSpan({
                        fill: Theme.colors.text,
                        children: '(',
                    }) +
                    paramsSVG +
                    TSpan({
                        fill: Theme.colors.text,
                        children: ')',
                    }) +
                    returnSVG,
            });

            yCursor += lineHeight;
            return result;
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

    const group = Group({
        transform: `translate(${x - width / 2}, ${y})`,
        children:
            panel + header + title + attributesSVG + dividerSVG + methodsSVG,
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

    let boxes = '';
    let edges = '';

    const focusRendered = renderClassBoxSVG(focus, 0, 0);
    boxes += focusRendered.svg;

    function renderLayer(layer: ClassNode[], centerY: number) {
        const pre = layer.map(n => renderClassBoxSVG(n, 0, 0));

        const totalWidth =
            pre.reduce((s, r) => s + r.width, 0) +
            (layer.length - 1) * horizontalGap;

        let xCursor = -totalWidth / 2;

        const positioned: BoxMeasures[] = [];

        layer.forEach((node, i) => {
            const x = xCursor + pre[i].width / 2;
            const y = centerY;

            const rendered = renderClassBoxSVG(node, x, y);
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
     ANCESTORS
  ------------------------- */

    let currentY = -verticalGap;

    const ancestorLayerBoxes: BoxMeasures[][] = [];

    for (let i = 0; i < ancestorLayers.length; i++) {
        const layer = ancestorLayers[i];

        currentY -= verticalGap;
        const layerBoxes = renderLayer(layer, currentY);

        const maxHeight = Math.max(...layerBoxes.map(b => b.height));
        currentY -= maxHeight;

        ancestorLayerBoxes.push(layerBoxes);
    }

    /* -------------------------
     EDGES ANCESTORS → FOCUS
  ------------------------- */

    const ancestorMidYs: number[] = ancestorLayerBoxes.map((layer, i) => {
        const layerBottom = Math.max(...layer.map(b => bottomAnchor(b.y, b.height)));
        const childTop = i === 0
            ? topAnchor(0)
            : Math.min(...ancestorLayerBoxes[i - 1].map(b => b.y));
        return (layerBottom + childTop) / 2;
    });

    ancestorLayerBoxes.forEach((layer, i) => {
        const midY = ancestorMidYs[i];
        const stemBottom = i === 0 ? topAnchor(0) : ancestorMidYs[i - 1];

        const xs = layer.map(b => b.x);
        const busX1 = Math.min(...xs, 0);
        const busX2 = Math.max(...xs, 0);

        edges += Line({ x1: busX1, y1: midY, x2: busX2, y2: midY, stroke: Theme.colors.edge });

        layer.forEach(box => {
            edges += Line({
                x1: box.x,
                y1: bottomAnchor(box.y, box.height),
                x2: box.x,
                y2: midY,
                stroke: Theme.colors.edge,
            });
        });

        edges += Line({ x1: 0, y1: midY, x2: 0, y2: stemBottom, stroke: Theme.colors.edge });
    });

    /* -------------------------
     DESCENDANTS
  ------------------------- */

    currentY = bottomAnchor(0, focusRendered.height) + verticalGap;

    const descendantLayerBoxes: BoxMeasures[][] = [];

    descendantLayers.forEach(layer => {
        const layerBoxes = renderLayer(layer, currentY);

        const maxHeight = Math.max(...layerBoxes.map(b => b.height));
        currentY += maxHeight + verticalGap;

        descendantLayerBoxes.push(layerBoxes);
    });

    /* -------------------------
     EDGES FOCUS → DESCENDANTS
  ------------------------- */

    const descendantMidYs: number[] = descendantLayerBoxes.map((layer, i) => {
        const layerTop = Math.min(...layer.map(b => topAnchor(b.y)));
        const parentBottom = i === 0
            ? bottomAnchor(0, focusRendered.height)
            : Math.max(...descendantLayerBoxes[i - 1].map(b => bottomAnchor(b.y, b.height)));
        return (parentBottom + layerTop) / 2;
    });

    descendantLayerBoxes.forEach((layer, i) => {
        const midY = descendantMidYs[i];
        const stemTop = i === 0 ? bottomAnchor(0, focusRendered.height) : descendantMidYs[i - 1];

        const xs = layer.map(b => b.x);
        const busX1 = Math.min(...xs, 0);
        const busX2 = Math.max(...xs, 0);

        edges += Line({ x1: 0, y1: stemTop, x2: 0, y2: midY, stroke: Theme.colors.edge });

        edges += Line({ x1: busX1, y1: midY, x2: busX2, y2: midY, stroke: Theme.colors.edge });

        layer.forEach(box => {
            edges += Line({
                x1: box.x,
                y1: midY,
                x2: box.x,
                y2: topAnchor(box.y),
                stroke: Theme.colors.edge,
            });
        });
    });

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
