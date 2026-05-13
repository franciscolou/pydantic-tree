import { Theme, UI } from '../../config';
import { FindBar, WebViewOptions } from '../components';

export function renderBaseStyles(): string {
    return `<style>
    text {
        font-family: ${Theme.font.family};
    }

    body, svg {
        background: ${Theme.colors.background};
    }

    [data-pt-role="class"]:hover text {
        text-decoration: underline;
        text-decoration-color: var(--pt-hover-underline);
    }

    .file-path-section {
        opacity: 0;
        transition: opacity 0.15s ease;
    }
    [data-pt-box]:hover .file-path-section,
    #svgRoot.show-paths .file-path-section {
        opacity: 1;
    }
</style>`;
}

export function renderViewportScript(
    opts: { initialScale?: number } = {}
): string {
    const initialScale = opts.initialScale ?? 1;
    return `
<style>
  #find-bar button {
    background: transparent;
    border: 1px solid var(--pt-border);
    color: var(--pt-text);
    border-radius: 3px;
    cursor: pointer;
    padding: 2px 8px;
    font-size: 11px;
  }
  #find-bar button:hover { background: var(--pt-border); }
  #find-close { border: none !important; color: #888 !important; padding: 2px 5px !important; }
  #find-close:hover { color: var(--pt-text) !important; background: transparent !important; }
  #find-input:focus { outline: 1px solid #007acc; }
  #paths-toggle label { cursor: pointer; user-select: none; }
  #paths-toggle input { cursor: pointer; }
  [data-pt-edge]:hover polygon[fill="none"] {
    transform-box: fill-box;
    transform-origin: top center;
    transform: scale(1.5);
  }
  #edge-tooltip {
    position: fixed;
    display: none;
    background: var(--pt-panel-bg, #1e1e1e);
    border: 1px solid var(--pt-border, #444);
    color: var(--pt-text, #ccc);
    font-size: 12px;
    font-family: monospace;
    padding: 4px 8px;
    border-radius: 4px;
    pointer-events: none;
    z-index: 2000;
    white-space: nowrap;
    box-shadow: 0 2px 8px rgba(0,0,0,0.4);
  }
</style>
${WebViewOptions()}
${FindBar()}
<div id="edge-tooltip"></div>
<script>
  const svg = document.getElementById("svgRoot");
  const viewport = document.getElementById("viewport");

  let isPanning = false;
  let pointerDownTarget = null;
  let pointerMoved = false;
  let lastX = 0;
  let lastY = 0;

  const vscode = acquireVsCodeApi();

  const PAN_SENSITIVITY = ${UI.pan.sensitivity};
  const ZOOM_STEP = ${UI.zoom.step};
  const CLICK_THRESHOLD = 4;

  const currentState = vscode.getState();
  let tx = currentState ? currentState.tx : window.innerWidth / 2;
  let ty = currentState ? currentState.ty : window.innerHeight / 2;
  let scale = currentState ? currentState.scale : ${initialScale};
  let showPaths = currentState ? (currentState.showPaths ?? false) : false;

  const showPathsCb = document.getElementById('show-paths-cb');
  showPathsCb.checked = showPaths;
  if (showPaths) svg.classList.add('show-paths');

  showPathsCb.addEventListener('change', () => {
    showPaths = showPathsCb.checked;
    svg.classList.toggle('show-paths', showPaths);
    vscode.setState({ tx, ty, scale, showPaths });
  });

  function update() {
    viewport.setAttribute(
      "transform",
      "translate(" + tx + "," + ty + ") scale(" + scale + ")"
    );
    vscode.setState({ tx, ty, scale, showPaths });
  }

  svg.style.cursor = "grab";
  svg.style.userSelect = "none";

  // === EDGE DRAG ===
  // When the user starts a pointerdown on an inheritance arrow, we capture
  // the drag and prevent the canvas pan from kicking in. While dragging,
  // a "ghost" line follows the cursor from the original child class box.
  // On pointerup, if released over a class box, we ask the extension to
  // change the inheritance in the source code.
  let edgeDrag = null;

  // === EDGE TOOLTIP ===
  const edgeTooltip = document.getElementById('edge-tooltip');
  let tooltipEdgeEl = null;

  svg.addEventListener('mousemove', e => {
    const edgeEl = e.target.closest && e.target.closest('[data-pt-edge]');
    if (edgeEl) {
      if (edgeEl !== tooltipEdgeEl) {
        const childName = edgeEl.dataset.ptEdgeChildName || edgeEl.dataset.ptEdgeChild || '?';
        const parentName = edgeEl.dataset.ptEdgeParentName || edgeEl.dataset.ptEdgeParent || '?';
        edgeTooltip.textContent = childName + ' → ' + parentName;
        tooltipEdgeEl = edgeEl;
      }
      edgeTooltip.style.display = 'block';
      edgeTooltip.style.left = (e.clientX + 14) + 'px';
      edgeTooltip.style.top = (e.clientY - 32) + 'px';
    } else {
      edgeTooltip.style.display = 'none';
      tooltipEdgeEl = null;
    }
  });

  svg.addEventListener('mouseleave', () => {
    edgeTooltip.style.display = 'none';
    tooltipEdgeEl = null;
  });

  function clientToSvg(clientX, clientY) {
    const r = svg.getBoundingClientRect();
    return {
      x: (clientX - r.left - tx) / scale,
      y: (clientY - r.top - ty) / scale,
    };
  }

  function getBoxCenter(boxEl) {
    const r = boxEl.getBoundingClientRect();
    return clientToSvg(r.left + r.width / 2, r.top + r.height / 2);
  }

  function startEdgeDrag(edgeEl, e) {
    const childId = edgeEl.dataset.ptEdgeChild;
    const parentId = edgeEl.dataset.ptEdgeParent;
    if (!childId || !parentId) return;

    // Pick up the visible arrow's stroke color so the ghost line matches
    // the edge being dragged. The hit area polygon has stroke="none", so
    // we look for the first polygon with a real stroke.
    let edgeColor = '#888';
    const polygons = edgeEl.querySelectorAll('polygon');
    for (const p of polygons) {
      const s = p.getAttribute('stroke');
      if (s && s !== 'none') { edgeColor = s; break; }
    }

    // Resolve the child box's center as the drag origin.
    const childBox = viewport.querySelector(
      '[data-pt-box-id="' + (window.CSS && CSS.escape ? CSS.escape(childId) : childId) + '"]'
    );
    const origin = childBox ? getBoxCenter(childBox) : clientToSvg(e.clientX, e.clientY);

    // Build the ghost line element once.
    const ghost = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    ghost.setAttribute('stroke', edgeColor);
    ghost.setAttribute('stroke-opacity', '0.55');
    ghost.setAttribute('stroke-width', '2');
    ghost.setAttribute('stroke-dasharray', '6 4');
    ghost.setAttribute('pointer-events', 'none');
    ghost.setAttribute('x1', origin.x);
    ghost.setAttribute('y1', origin.y);
    ghost.setAttribute('x2', origin.x);
    ghost.setAttribute('y2', origin.y);
    viewport.appendChild(ghost);

    edgeDrag = { edgeEl, childId, parentId, origin, ghost, hoverBoxEl: null };
    edgeTooltip.style.display = 'none';
    tooltipEdgeEl = null;
    svg.setPointerCapture(e.pointerId);
    svg.style.cursor = 'grabbing';
  }

  function updateEdgeDrag(e) {
    if (!edgeDrag) return;
    const p = clientToSvg(e.clientX, e.clientY);
    edgeDrag.ghost.setAttribute('x2', p.x);
    edgeDrag.ghost.setAttribute('y2', p.y);

    // Highlight the box currently under the cursor (if any).
    const under = document.elementFromPoint(e.clientX, e.clientY);
    const boxEl = under ? under.closest('[data-pt-box-id]') : null;
    if (boxEl !== edgeDrag.hoverBoxEl) {
      if (edgeDrag.hoverBoxEl) edgeDrag.hoverBoxEl.style.filter = '';
      if (boxEl) boxEl.style.filter = 'brightness(1.25)';
      edgeDrag.hoverBoxEl = boxEl;
    }
  }

  function endEdgeDrag(e) {
    if (!edgeDrag) return false;
    const { childId, parentId, ghost, hoverBoxEl } = edgeDrag;
    if (hoverBoxEl) hoverBoxEl.style.filter = '';
    ghost.remove();

    // Determine the drop target box.
    const under = document.elementFromPoint(e.clientX, e.clientY);
    const boxEl = under ? under.closest('[data-pt-box-id]') : null;
    const newParentId = boxEl ? boxEl.dataset.ptBoxId : null;

    edgeDrag = null;
    svg.style.cursor = 'grab';
    try { svg.releasePointerCapture(e.pointerId); } catch {}

    if (newParentId && newParentId !== parentId) {
      vscode.postMessage({
        command: 'changeInheritance',
        childId: childId,
        oldParentId: parentId,
        newParentId: newParentId,
      });
    }
    return true;
  }

  svg.addEventListener("pointerdown", e => {
    if (e.button !== 0) return;
    const edgeEl = e.target.closest && e.target.closest('[data-pt-edge]');
    if (edgeEl) {
      e.stopPropagation();
      startEdgeDrag(edgeEl, e);
      return;
    }
    isPanning = true;
    pointerDownTarget = e.target;
    pointerMoved = false;
    lastX = e.clientX;
    lastY = e.clientY;
    svg.setPointerCapture(e.pointerId);
    svg.style.cursor = "grabbing";
  });

  svg.addEventListener("pointermove", e => {
    if (edgeDrag) {
      updateEdgeDrag(e);
      return;
    }
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
    if (endEdgeDrag(e)) return;
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

    const newScale = scale * factor;

    tx = mx - (mx - tx) * (newScale / scale);
    ty = my - (my - ty) * (newScale / scale);
    scale = newScale;

    update();
  }, { passive: false });

  update();

  // === FIND ===

  let findMatches = [];
  let findCurrent = -1;
  const findBar    = document.getElementById('find-bar');
  const findInput  = document.getElementById('find-input');
  const findCountEl = document.getElementById('find-count');
  const findPrev   = document.getElementById('find-prev');
  const findNext   = document.getElementById('find-next');
  const findClose  = document.getElementById('find-close');

  let hlGroup = null;

  function getHlGroup() {
    if (!hlGroup) {
      hlGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      hlGroup.setAttribute('pointer-events', 'none');
      viewport.appendChild(hlGroup);
    }
    return hlGroup;
  }

  function clearHighlights() {
    if (hlGroup) hlGroup.innerHTML = '';
  }

  function buildHighlightRect(elem, isCurrent) {
    const r    = elem.getBoundingClientRect();
    const svgR = svg.getBoundingClientRect();
    if (!r.width && !r.height) return null;
    const pad = 2;
    const x = (r.left - svgR.left - tx) / scale - pad;
    const y = (r.top  - svgR.top  - ty) / scale - pad;
    const w = r.width  / scale + pad * 2;
    const h = r.height / scale + pad * 2;
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', x);
    rect.setAttribute('y', y);
    rect.setAttribute('width', w);
    rect.setAttribute('height', h);
    rect.setAttribute('fill', isCurrent ? 'rgba(255,200,0,0.45)' : 'rgba(255,200,0,0.18)');
    rect.setAttribute('rx', '2');
    return rect;
  }

  function buildHighlights() {
    clearHighlights();
    if (!findMatches.length) return;
    const g = getHlGroup();
    findMatches.forEach((elem, i) => {
      const rect = buildHighlightRect(elem, i === findCurrent);
      if (rect) g.appendChild(rect);
    });
  }

  function updateCount() {
    if (!findMatches.length) {
      findCountEl.textContent = findInput.value.trim() ? 'No results' : '';
      findCountEl.style.color = findInput.value.trim() ? '#f88' : '#888';
    } else {
      findCountEl.textContent = (findCurrent + 1) + ' / ' + findMatches.length;
      findCountEl.style.color = '#888';
    }
  }

  function panToMatch(index) {
    const elem = findMatches[index];
    if (!elem) return;
    const r    = elem.getBoundingClientRect();
    const svgR = svg.getBoundingClientRect();
    tx += svgR.width  / 2 - (r.left + r.width  / 2 - svgR.left);
    ty += svgR.height / 2 - (r.top  + r.height / 2 - svgR.top);
    update();
  }

  function doSearch(query) {
    findMatches = [];
    findCurrent = -1;
    clearHighlights();
    if (!query.trim()) { updateCount(); return; }
    const q = query.toLowerCase();
    viewport.querySelectorAll('text').forEach(t => {
      if (t.textContent.toLowerCase().includes(q)) findMatches.push(t);
    });
    if (findMatches.length) {
      findCurrent = 0;
      panToMatch(0);
    }
    updateCount();
    buildHighlights();
  }

  function navigate(dir) {
    if (!findMatches.length) return;
    findCurrent = (findCurrent + dir + findMatches.length) % findMatches.length;
    panToMatch(findCurrent);
    updateCount();
    buildHighlights();
  }

  function openFindBar() {
    findBar.style.display = 'flex';
    findInput.focus();
    findInput.select();
  }

  function closeFindBar() {
    findBar.style.display = 'none';
    clearHighlights();
    findMatches = [];
    findCurrent = -1;
    findCountEl.textContent = '';
    findInput.value = '';
  }

  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      e.preventDefault();
      openFindBar();
    } else if (e.key === 'Escape' && findBar.style.display !== 'none') {
      closeFindBar();
    }
  });

  findInput.addEventListener('input', () => doSearch(findInput.value));
  findInput.addEventListener('keydown', e => {
    if (e.key === 'Enter')  { e.preventDefault(); navigate(e.shiftKey ? -1 : 1); }
    if (e.key === 'Escape') { e.preventDefault(); closeFindBar(); }
  });

  findPrev.addEventListener('click',  () => navigate(-1));
  findNext.addEventListener('click',  () => navigate(1));
  findClose.addEventListener('click', () => closeFindBar());
</script>
`;
}
