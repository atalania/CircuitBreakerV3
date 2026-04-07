import { getLevel1CoachState } from "../levels/level1.js";

export function teardownLevelOverlayNodes() {
  document
    .querySelectorAll(".truth-table-tracker, .sequence-tracker, .sr-latch-tracker, .level1-coach")
    .forEach((el) => el.remove());
}

/**
 * @param {any} circuitLab
 */
export function createLevel1Coach(circuitLab) {
  const viewport = document.querySelector(".circuit-viewport");
  if (!viewport) return;
  const coach = document.createElement("div");
  coach.className = "level1-coach visible";
  coach.id = "level1-coach";
  coach.innerHTML = `
      <div class="l1-header">
        <span class="l1-drag-handle" aria-label="Drag to move checklist" title="Drag to move">⠿</span>
        <div class="l1-title">BOOT CAMP — STEP LIST</div>
      </div>
      <div class="l1-hint">Drag the handle to move this panel. Follow steps top to bottom.</div>
      <div class="l1-step" data-l1-step="pins"><span class="l1-mark">○</span><span class="l1-text">Pins A, B, C on the left</span></div>
      <div class="l1-step" data-l1-step="leds"><span class="l1-mark">○</span><span class="l1-text">LEDs X, Y, Z on the right</span></div>
      <div class="l1-step" data-l1-step="gates"><span class="l1-mark">○</span><span class="l1-text">One AND, one OR, one NOT on the canvas</span></div>
      <div class="l1-step" data-l1-step="wires"><span class="l1-mark">○</span><span class="l1-text">Each LED input has a wire (feeds X, Y, Z)</span></div>
      <div class="l1-step l1-step-static" data-l1-step="disarm"><span class="l1-mark">◇</span><span class="l1-text">DISARM tests all 8 A,B,C combos at once</span></div>
    `;
  viewport.appendChild(coach);
  positionLevel1CoachDefault(coach, viewport);
  initLevel1CoachDrag(coach, viewport);
  refreshLevel1CoachFromDom(circuitLab);
}

function positionLevel1CoachDefault(coach, viewport) {
  requestAnimationFrame(() => {
    const pad = 10;
    const w = viewport.clientWidth;
    const cw = coach.offsetWidth;
    coach.style.right = "auto";
    coach.style.left = `${Math.max(pad, w - cw - pad)}px`;
    coach.style.top = `${pad}px`;
  });
}

/**
 * @param {HTMLElement} coach
 * @param {HTMLElement} viewport
 */
function initLevel1CoachDrag(coach, viewport) {
  const handle = coach.querySelector(".l1-drag-handle");
  if (!handle) return;

  /** @type {{ startX: number, startY: number, origL: number, origT: number, pointerId: number } | null} */
  let drag = null;

  const clamp = () => {
    const pad = 4;
    const maxL = viewport.clientWidth - coach.offsetWidth - pad;
    const maxT = viewport.clientHeight - coach.offsetHeight - pad;
    let l = parseFloat(coach.style.left) || coach.offsetLeft;
    let t = parseFloat(coach.style.top) || coach.offsetTop;
    l = Math.max(pad, Math.min(maxL, l));
    t = Math.max(pad, Math.min(maxT, t));
    coach.style.left = `${l}px`;
    coach.style.top = `${t}px`;
    coach.style.right = "auto";
  };

  const onMove = (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    coach.style.right = "auto";
    coach.style.left = `${drag.origL + dx}px`;
    coach.style.top = `${drag.origT + dy}px`;
    clamp();
  };

  const onUp = () => {
    if (!drag) return;
    const pid = drag.pointerId;
    drag = null;
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onUp);
    try {
      handle.releasePointerCapture(pid);
    } catch {
      /* ignore */
    }
    handle.classList.remove("l1-dragging");
  };

  handle.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    coach.style.right = "auto";
    const origL = coach.offsetLeft;
    const origT = coach.offsetTop;
    drag = { startX: e.clientX, startY: e.clientY, origL, origT, pointerId: e.pointerId };
    handle.classList.add("l1-dragging");
    try {
      handle.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  });
}

/**
 * @param {any} circuitLab
 * @param {(lab: any) => any} [getCoachState]
 */
export function refreshLevel1CoachFromDom(circuitLab, getCoachState = getLevel1CoachState) {
  const coach = document.getElementById("level1-coach");
  if (!coach) return;
  refreshLevel1Coach(coach, () => getCoachState(circuitLab));
}

/**
 * @param {HTMLElement} coach
 * @param {() => ReturnType<typeof getLevel1CoachState>} getState
 */
function refreshLevel1Coach(coach, getState) {
  const s = getState();
  const mark = (stepId, done) => {
    const row = coach.querySelector(`[data-l1-step="${stepId}"]`);
    if (!row || row.classList.contains("l1-step-static")) return;
    row.classList.toggle("l1-step-done", !!done);
    const m = row.querySelector(".l1-mark");
    if (m) m.textContent = done ? "✓" : "○";
  };
  mark("pins", s.pinOk);
  mark("leds", s.ledsOk);
  mark("gates", s.gatesOk);
  mark("wires", s.ledsFed);

  const order = ["pins", "leds", "gates", "wires"];
  let firstOpen = true;
  for (const id of order) {
    const row = coach.querySelector(`[data-l1-step="${id}"]`);
    if (!row) continue;
    row.classList.remove("l1-step-current");
    const done =
      id === "pins"
        ? s.pinOk
        : id === "leds"
          ? s.ledsOk
          : id === "gates"
            ? s.gatesOk
            : s.ledsFed;
    if (!done && firstOpen) {
      row.classList.add("l1-step-current");
      firstOpen = false;
    }
  }
}

/**
 * @param {{ id: number }} level
 */
export function createTruthTableTracker(level) {
  const viewport = document.querySelector(".circuit-viewport");
  if (!viewport) return;
  const tracker = document.createElement("div");
  tracker.className = "truth-table-tracker visible";
  tracker.id = "tt-tracker";

  const allCombos = ["000", "001", "010", "011", "100", "101", "110", "111"];
  const outputLabel = level.id === 2 ? "Q" : "F";

  tracker.innerHTML = `
      <div class="tt-title">TRUTH TABLE</div>
      <div style="display:flex;gap:0.5rem;color:var(--text-muted);font-size:0.6rem;padding:0.1rem 0.3rem;letter-spacing:1px;">
        <span>A</span><span>B</span><span>C</span><span style="margin-left:0.3rem">${outputLabel}</span><span style="margin-left:auto">✓</span>
      </div>
      ${allCombos
        .map(
          (c) => `
        <div class="tt-row" data-combo="${c}">
          <span>${c[0]}</span><span>${c[1]}</span><span>${c[2]}</span>
          <span style="margin-left:0.3rem" class="tt-output">?</span>
          <span style="margin-left:auto" class="tt-check">—</span>
        </div>`
        )
        .join("")}
      <div class="tt-progress" id="tt-progress">0 / ${level.id === 2 ? 6 : 4} found</div>
    `;

  viewport.appendChild(tracker);
}

/**
 * @param {{ stepLabels?: string[] }} level
 */
export function createSrLatchTracker(level) {
  const viewport = document.querySelector(".circuit-viewport");
  if (!viewport) return;
  const tracker = document.createElement("div");
  tracker.className = "sr-latch-tracker visible";
  tracker.id = "sr-latch-tracker";
  const labels = level.stepLabels || [];
  tracker.innerHTML = `
      <div class="sr-title">SR SEQUENCE</div>
      <div class="sr-hint">DISARM after each verified step</div>
      ${labels
        .map(
          (text, i) => `
          <div class="sr-step" data-sr-step="${i}">
            <span class="sr-step-mark">○</span>
            <span class="sr-step-text">${text}</span>
          </div>`
        )
        .join("")}
    `;
  viewport.appendChild(tracker);
  updateSrLatchTracker(0);
}

export function updateSrLatchTracker(currentStep) {
  const tracker = document.getElementById("sr-latch-tracker");
  if (!tracker) return;
  tracker.querySelectorAll("[data-sr-step]").forEach((row) => {
    const i = parseInt(row.getAttribute("data-sr-step") || "0", 10);
    row.classList.remove("sr-step-done", "sr-step-current");
    const mark = row.querySelector(".sr-step-mark");
    if (i < currentStep) {
      row.classList.add("sr-step-done");
      if (mark) mark.textContent = "✓";
    } else if (i === currentStep && currentStep < 4) {
      row.classList.add("sr-step-current");
      if (mark) mark.textContent = "▸";
    } else {
      if (mark) mark.textContent = "○";
    }
  });
}

export function createSequenceTracker() {
  const viewport = document.querySelector(".circuit-viewport");
  if (!viewport) return;
  const tracker = document.createElement("div");
  tracker.className = "sequence-tracker visible";
  tracker.id = "seq-tracker";

  tracker.innerHTML = `
      <div class="seq-title">CLOCK SEQUENCE</div>
      <div class="seq-row">
        <span class="seq-label">Target:</span>
        <div class="seq-values">
          <div class="seq-val filled">1</div>
          <div class="seq-val filled">0</div>
          <div class="seq-val filled">1</div>
          <div class="seq-val filled">1</div>
        </div>
      </div>
      <div class="seq-row">
        <span class="seq-label">Yours:</span>
        <div class="seq-values" id="seq-achieved">
          <div class="seq-val">_</div>
          <div class="seq-val">_</div>
          <div class="seq-val">_</div>
          <div class="seq-val">_</div>
        </div>
      </div>
    `;

  viewport.appendChild(tracker);
}

/**
 * @param {any} result
 */
export function updateSequenceTrackerDom(result) {
  const container = document.getElementById("seq-achieved");
  if (!container) return;

  const vals = container.querySelectorAll(".seq-val");
  const target = result.target;
  const achieved = result.achieved;

  vals.forEach((v, i) => {
    v.classList.remove("match", "miss", "filled");
    if (i < achieved.length) {
      v.textContent = String(achieved[i]);
      v.classList.add("filled");
      if (achieved[i] === target[i]) {
        v.classList.add("match");
      } else {
        v.classList.add("miss");
      }
    } else {
      v.textContent = "_";
    }
  });
}

/**
 * @param {any} combo
 * @param {any} outputVal
 * @param {any} progress
 */
export function updateTruthTableTrackerDom(combo, outputVal, progress) {
  const tracker = document.getElementById("tt-tracker");
  if (!tracker) return;

  const row = tracker.querySelector(`[data-combo="${combo}"]`);
  if (row) {
    const output = row.querySelector(".tt-output");
    const check = row.querySelector(".tt-check");
    output.textContent = outputVal;

    if (progress && outputVal === 1 && progress.foundSet && progress.foundSet.has(combo)) {
      row.classList.add("found");
      row.classList.remove("wrong");
      check.textContent = "✓";
    } else if (outputVal === 0) {
      row.classList.add("wrong");
      check.textContent = "✗";
      setTimeout(() => row.classList.remove("wrong"), 1000);
    }
  }

  if (progress) {
    const prog = tracker.querySelector("#tt-progress");
    if (prog) prog.textContent = `${progress.found} / ${progress.total} found`;
  }
}
