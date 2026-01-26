import type { ClassNode, RenderedBox } from '../types';
import { Theme, UI } from '../config';
/* =========================================================
   EDGE RENDERING (SVG)
   ========================================================= */

function renderVerticalEdge(fromY: number, toY: number): string {
    return `
    <line
      x1="0"
      y1="${fromY}"
      x2="0"
      y2="${toY}"
      stroke="${Theme.colors.edge}"
    />
  `;
}

function bottomAnchor(y: number, boxHeight: number): number {
    return y + boxHeight;
}

function topAnchor(y: number): number {
    return y;
}

/* =========================================================
   CLASS BOX RENDERING (SVG)
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

    /* -------------------------
     Width calculation
     ------------------------- */

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

    /* -------------------------
     Attributes
     ------------------------- */

    let yCursor = headerHeight + padding;

    const attributesSVG = node.attributes
        .map(attr => {
            const svg = `
        <text x="16" y="${yCursor}" font-size="${Theme.font.size.normal}">
          <tspan fill="${Theme.colors.attribute}">${attr.name}</tspan>
          <tspan fill="${Theme.colors.text}">: </tspan>
          <tspan fill="${Theme.colors.type}">
            ${attr.type ?? '?'}
          </tspan>
        </text>
      `;
            yCursor += lineHeight;
            return svg;
        })
        .join('');

    /* -------------------------
     Divider
     ------------------------- */

    let dividerSVG = '';

    if (node.attributes.length && node.methods.length) {
        const dividerY = yCursor + sectionGap / 2;
        dividerSVG = `
      <line
        x1="12"
        y1="${dividerY}"
        x2="${width - 12}"
        y2="${dividerY}"
        stroke="${Theme.colors.border}"
      />
    `;
        yCursor = dividerY + UI.box.methodTopPadding;
    }

    /* -------------------------
     Methods
     ------------------------- */

    const methodsSVG = node.methods
        .map(method => {
            const paramsSVG = method.params
                .map(p => {
                    let s = `<tspan fill="${Theme.colors.attribute}">${p.name}</tspan>`;
                    if (p.type) {
                        s += `<tspan fill="${Theme.colors.text}">: </tspan>`;
                        s += `<tspan fill="${Theme.colors.type}">${p.type}</tspan>`;
                    }
                    return s;
                })
                .join(`<tspan fill="${Theme.colors.text}">, </tspan>`);

            const returnSVG = method.returnType
                ? `<tspan fill="${Theme.colors.text}"> → </tspan>
           <tspan fill="${Theme.colors.type}">
             ${method.returnType}
           </tspan>`
                : '';

            const svg = `
        <text x="16" y="${yCursor}" font-size="${Theme.font.size.normal}">
          <tspan fill="${Theme.colors.method}">
            ${method.name}
          </tspan>
          <tspan fill="${Theme.colors.text}">(</tspan>
          ${paramsSVG}
          <tspan fill="${Theme.colors.text}">)</tspan>
          ${returnSVG}
        </text>
      `;

            yCursor += lineHeight;
            return svg;
        })
        .join('');

    const height = yCursor + padding;

    /* -------------------------
     Box SVG
     ------------------------- */

    const svg = `
<g transform="translate(${x - width / 2}, ${y})">
  <rect
    x="0"
    y="0"
    width="${width}"
    height="${height}"
    rx="${borderRadius}"
    ry="${borderRadius}"
    fill="${Theme.colors.panelBackground}"
    stroke="${Theme.colors.border}"
  />

  <rect
    x="0"
    y="0"
    width="${width}"
    height="${headerHeight}"
    fill="${Theme.colors.headerBackground}"
  />

  <text
    x="${width / 2}"
    y="22"
    text-anchor="middle"
    font-size="${Theme.font.size.header}"
    font-weight="${Theme.font.weight.bold}"
    fill="${Theme.colors.headerText}"
  >
    ${node.name}
  </text>

  ${attributesSVG}
  ${dividerSVG}
  ${methodsSVG}
</g>
`;
    return {
        svg,
        width,
        height,
    };
}

/* =========================================================
   ÁRVORE DE HERANÇA (HTML + SVG)
   ========================================================= */

export function renderClassTreeSVG(
    focus: ClassNode,
    ancestors: ClassNode[],
    descendants: ClassNode[]
): string {
    const gap = UI.tree.verticalGap;

    let boxes = '';
    let edges = '';

    /* =========================
   ANCESTORS
   ========================= */

    const ancestorBoxes: { y: number; height: number }[] = [];

    // over focus
    let currentY = -gap;

    ancestors
        .slice()
        .reverse() // upside-down rendering
        .forEach(node => {
            // temporary render to get height
            const rendered = renderClassBoxSVG(node, 0, 0);

            // position the box above maintaining fixed GAP
            const y = currentY - rendered.height;

            // final render
            const finalRendered = renderClassBoxSVG(node, 0, y);
            boxes += finalRendered.svg;

            ancestorBoxes.push({ y, height: finalRendered.height });

            // next ancestor goes up maintaining GAP
            currentY = y - gap;
        });

    /* =========================
   FOCUS
   ========================= */

    const focusRendered = renderClassBoxSVG(focus, 0, 0);
    boxes += focusRendered.svg;

    /* =========================
   EDGES: ANCESTORS → FOCUS
   ========================= */

    ancestorBoxes.forEach(box => {
        edges += renderVerticalEdge(
            bottomAnchor(box.y, box.height),
            topAnchor(0)
        );
    });

    /* =========================
   DESCENDANTS
   ========================= */

    const descendantBoxes: { y: number; height: number }[] = [];

    currentY = bottomAnchor(0, focusRendered.height) + gap;

    descendants.forEach(node => {
        const y = currentY;

        const rendered = renderClassBoxSVG(node, 0, y);
        boxes += rendered.svg;

        descendantBoxes.push({ y, height: rendered.height });

        currentY = bottomAnchor(y, rendered.height) + gap;
    });

    /* =========================
   EDGES: FOCUS → DESCENDANTS
   ========================= */

    descendantBoxes.forEach(box => {
        edges += renderVerticalEdge(
            bottomAnchor(0, focusRendered.height),
            topAnchor(box.y)
        );
    });

    return `
<!DOCTYPE html>
<html>
<body
  style="
    margin: 0;
    overflow: hidden;
    background: ${Theme.colors.background};
  "
>
<svg
  id="svgRoot"
  width="100%"
  height="100%"
  viewBox="0 0 2000 2000"
  xmlns="http://www.w3.org/2000/svg"
>
  <style>
    text {
      font-family: ${Theme.font.family};
    }
  </style>

  <g
    id="viewport"
    transform="
      translate(${UI.tree.initialTranslate.x},
                ${UI.tree.initialTranslate.y})
      scale(1)
    "
  >
    ${edges}
    ${boxes}
  </g>

  ${renderViewportScript()}
</svg>
</body>
</html>
`;
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
