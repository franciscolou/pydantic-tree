import type { ClassNode, BoxMeasures } from '../types';
import { Theme, UI } from '../config';
import { Svg, Group, HtmlRoot } from './components';
import { renderClassBox, measureClassBox, collectInheritedNames } from './classBox';
import { renderAncestorEdges, renderDescendantEdges } from './edges';

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

function computeAncestorChainDepths(layers: ClassNode[][]): number[][] {
    const depths: number[][] = new Array(layers.length);
    for (let i = layers.length - 1; i >= 0; i--) {
        depths[i] = layers[i].map(node => {
            let maxDepth = 0;
            for (let j = i + 1; j < layers.length; j++) {
                layers[j].forEach((ancestor, k) => {
                    if ((node.bases ?? []).includes(ancestor.name)) {
                        maxDepth = Math.max(maxDepth, depths[j][k] + 1);
                    }
                });
            }
            return maxDepth;
        });
    }
    return depths;
}

function computeDescendantChainDepths(layers: ClassNode[][]): number[][] {
    const depths: number[][] = new Array(layers.length);
    for (let i = layers.length - 1; i >= 0; i--) {
        depths[i] = layers[i].map(node => {
            if (i === layers.length - 1) return 0;
            const childDepths = layers[i + 1]
                .map((child, k) => ({ depth: depths[i + 1][k], isChild: (child.bases ?? []).includes(node.name) }))
                .filter(entry => entry.isChild)
                .map(entry => entry.depth);
            return childDepths.length > 0 ? 1 + Math.max(...childDepths) : 0;
        });
    }
    return depths;
}

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

    // Order layers so nodes with deeper chains land in the center
    const ancestorDepths = computeAncestorChainDepths(ancestorLayers);
    const orderedAncestorLayers = ancestorLayers.map((layer, i) => centerOutSort(layer, ancestorDepths[i]));

    const descendantDepths = computeDescendantChainDepths(descendantLayers);
    const orderedDescendantLayers = descendantLayers.map((layer, i) => centerOutSort(layer, descendantDepths[i]));

    // Position ancestor layers — measure height first so the gap to the layer below is exact
    let currentY = 0;
    const ancestorLayerBoxes: BoxMeasures[][] = [];
    let boxesSvg = focusRendered.svg;

    for (const layer of orderedAncestorLayers) {
        currentY -= verticalGap + measureLayerMaxHeight(layer, allNodes);
        const { svgs, positions } = positionLayer(layer, currentY, allNodes, horizontalGap);
        boxesSvg += svgs.join('');
        ancestorLayerBoxes.push(positions);
    }

    // Position descendant layers — start just below the focus box
    currentY = focusRendered.height + verticalGap;
    const descendantLayerBoxes: BoxMeasures[][] = [];

    for (const layer of orderedDescendantLayers) {
        const { svgs, positions } = positionLayer(layer, currentY, allNodes, horizontalGap);
        boxesSvg += svgs.join('');
        currentY += Math.max(...positions.map(box => box.height)) + verticalGap;
        descendantLayerBoxes.push(positions);
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
                `<style>text{font-family:${Theme.font.family};}body,svg{background:${Theme.colors.background};}</style>` +
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

function renderViewportScript(): string {
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
  let scale = 1;

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
