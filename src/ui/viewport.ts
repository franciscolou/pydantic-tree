import { Theme, UI } from '../config';

/* =========================================================
   SHARED WEBVIEW STYLES
========================================================= */

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
</style>`;
}

/* =========================================================
   VIEWPORT SCRIPT (pan / zoom / find / navigate)
========================================================= */

export function renderViewportScript(opts: { initialScale?: number } = {}): string {
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
</style>
<div id="find-bar" style="display:none; position:fixed; top:10px; left:50%; transform:translateX(-50%); background:var(--pt-panel-bg); border:1px solid var(--pt-border); border-radius:6px; padding:6px 10px; align-items:center; gap:8px; z-index:1000; box-shadow:0 4px 16px rgba(0,0,0,0.5)">
  <input id="find-input" type="text" placeholder="Find in tree…" autocomplete="off" spellcheck="false"
    style="background:var(--pt-bg); border:1px solid var(--pt-border); color:var(--pt-text); padding:4px 8px; border-radius:3px; outline:none; width:200px; font-size:13px; font-family:monospace" />
  <span id="find-count" style="color:#888; font-size:12px; min-width:60px; text-align:center"></span>
  <button id="find-prev" title="Previous (Shift+Enter)">↑</button>
  <button id="find-next" title="Next (Enter)">↓</button>
  <button id="find-close" title="Close (Escape)">✕</button>
</div>
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
  const MIN_SCALE = ${UI.zoom.min};
  const MAX_SCALE = ${UI.zoom.max};
  const ZOOM_STEP = ${UI.zoom.step};
  const CLICK_THRESHOLD = 4;

  const currentState = vscode.getState();
  let tx = currentState ? currentState.tx : window.innerWidth / 2;
  let ty = currentState ? currentState.ty : window.innerHeight / 2;
  let scale = currentState ? currentState.scale : ${initialScale};

  function update() {
    viewport.setAttribute(
      "transform",
      "translate(" + tx + "," + ty + ") scale(" + scale + ")"
    );
    vscode.setState({ tx, ty, scale });
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
