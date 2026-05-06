import type { ClassNode, BoxMeasures } from '../types';
import { Theme, UI } from '../config';
import { Svg, Group, HtmlRoot } from './components';
import { renderClassBox, measureClassBox, collectInheritedNames } from './classBox';
import { renderAncestorEdges, renderDescendantEdges } from './edges';
import { orderByParentBarycenter, orderByChildBarycenter } from './layout';

function measureLayerMaxHeight(layer: ClassNode[], allNodes: Map<string, ClassNode>): number {
    return Math.max(...layer.map(node => measureClassBox(node, collectInheritedNames(node, allNodes)).height));
}

function positionLayer(
    layer: ClassNode[],
    topY: number,
    allNodes: Map<string, ClassNode>,
    horizontalGap: number
): { svgs: string[]; positions: BoxMeasures[] } {
    const inherited = layer.map(node => collectInheritedNames(node, allNodes));
    const sizes = layer.map((node, i) => measureClassBox(node, inherited[i]));

    const totalWidth = sizes.reduce((sum, s) => sum + s.width, 0) + (layer.length - 1) * horizontalGap;
    let xCursor = -totalWidth / 2;

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
   TREE RENDERING
========================================================= */

export function renderClassTreeSVG(
    focus: ClassNode,
    ancestorLayers: ClassNode[][],
    descendantLayers: ClassNode[][]
): string {
    const { verticalGap, horizontalGap } = UI.tree;

    const allNodes = new Map<string, ClassNode>();
    allNodes.set(focus.name, focus);
    for (const layer of ancestorLayers) for (const node of layer) allNodes.set(node.name, node);
    for (const layer of descendantLayers) for (const node of layer) allNodes.set(node.name, node);

    // Focus box at origin
    const focusRendered = renderClassBox(focus, 0, 0, collectInheritedNames(focus, allNodes));

    // Position ancestor layers — order each layer by the average x of its children in the layer below,
    // so ancestors land horizontally close to the descendants they connect to.
    let currentY = 0;
    const ancestorLayerBoxes: BoxMeasures[][] = [];
    const orderedAncestorLayers: ClassNode[][] = [];
    let boxesSvg = focusRendered.svg;

    let prevAncestorLayer: ClassNode[] = [focus];
    let prevAncestorPositions = new Map<string, number>([[focus.name, 0]]);

    for (const layer of ancestorLayers) {
        const ordered = orderByChildBarycenter(layer, prevAncestorLayer, prevAncestorPositions);
        orderedAncestorLayers.push(ordered);
        currentY -= verticalGap + measureLayerMaxHeight(ordered, allNodes);
        const { svgs, positions } = positionLayer(ordered, currentY, allNodes, horizontalGap);
        boxesSvg += svgs.join('');
        ancestorLayerBoxes.push(positions);
        prevAncestorPositions = new Map(ordered.map((node, i) => [node.name, positions[i].x]));
        prevAncestorLayer = ordered;
    }

    // Position descendant layers — order each layer by the average x of its parents in the layer above,
    // so children land horizontally close to their parents.
    currentY = focusRendered.height + verticalGap;
    const descendantLayerBoxes: BoxMeasures[][] = [];
    const orderedDescendantLayers: ClassNode[][] = [];

    let parentPositions = new Map<string, number>([[focus.name, 0]]);

    for (const layer of descendantLayers) {
        const ordered = orderByParentBarycenter(layer, parentPositions);
        orderedDescendantLayers.push(ordered);
        const { svgs, positions } = positionLayer(ordered, currentY, allNodes, horizontalGap);
        boxesSvg += svgs.join('');
        currentY += Math.max(...positions.map(box => box.height)) + verticalGap;
        descendantLayerBoxes.push(positions);
        parentPositions = new Map(ordered.map((node, i) => [node.name, positions[i].x]));
    }

    // Draw edges
    const edgesSvg =
        renderAncestorEdges(orderedAncestorLayers, ancestorLayerBoxes, 0) +
        renderDescendantEdges(orderedDescendantLayers, descendantLayerBoxes, focusRendered.height);

    return HtmlRoot(
        Svg({
            width: '100%',
            height: '100vh',
            children:
                `
                <style>
                    text {
                        font-family: ${Theme.font.family};
                    }

                    body,
                    svg {
                        background: ${Theme.colors.background};
                    }
                </style>
                ` +
                Group({
                    id: 'viewport',
                    transform: 'translate(0,0) scale(1)',
                    children: edgesSvg + boxesSvg,
                }),
        }) +
        renderViewportScript()
    );
}

/* =========================================================
   VIEWPORT SCRIPT
========================================================= */

export function renderViewportScript(opts: { initialScale?: number } = {}): string {
    const initialScale = opts.initialScale ?? 1;
    return `
<script>
  const svg = document.getElementById("svgRoot");
  const viewport = document.getElementById("viewport");

  let isPanning = false;
  let pointerDownTarget = null;
  let pointerMoved = false;
  let lastX = 0;
  let lastY = 0;

  let tx = window.innerWidth / 2;
  let ty = window.innerHeight / 2;
  let scale = ${initialScale};

  const PAN_SENSITIVITY = ${UI.pan.sensitivity};
  const MIN_SCALE = ${UI.zoom.min};
  const MAX_SCALE = ${UI.zoom.max};
  const ZOOM_STEP = ${UI.zoom.step};
  const CLICK_THRESHOLD = 4;

  const vscode = acquireVsCodeApi();

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
    pointerDownTarget = e.target;
    pointerMoved = false;
    lastX = e.clientX;
    lastY = e.clientY;
    svg.setPointerCapture(e.pointerId);
    svg.style.cursor = "grabbing";
  });

  svg.addEventListener("pointermove", e => {
    if (!isPanning) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    if (Math.abs(dx) > CLICK_THRESHOLD || Math.abs(dy) > CLICK_THRESHOLD) pointerMoved = true;
    tx += dx * PAN_SENSITIVITY;
    ty += dy * PAN_SENSITIVITY;
    lastX = e.clientX;
    lastY = e.clientY;
    update();
  });

  function endPan(e) {
    if (!pointerMoved && pointerDownTarget) {
      const navTarget = pointerDownTarget.closest("[data-line]");
      if (navTarget) {
        vscode.postMessage({
          command: "navigate",
          fileUri: navTarget.dataset.file,
          line: parseInt(navTarget.dataset.line, 10),
        });
      }
    }
    isPanning = false;
    pointerMoved = false;
    pointerDownTarget = null;
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
