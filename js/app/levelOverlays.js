import { getLevel1CoachState } from "../levels/level1.js";
import { getLevel1GuidedCoachState } from "../levels/level1Guided.js";

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

/**
 * @param {any} circuitLab
 */
export function createLevel1GuidedCoach(circuitLab) {
  const viewport = document.querySelector(".circuit-viewport");
  if (!viewport) return;
  const coach = document.createElement("div");
  coach.className = "level1-coach visible level1-coach--guided";
  coach.id = "level1-coach";
  coach.innerHTML = `
      <div class="l1-header">
        <span class="l1-drag-handle" aria-label="Drag to move checklist" title="Drag to move">⠿</span>
        <div class="l1-title">TRAINING — BUILD & WIRE</div>
      </div>
      <div class="l1-hint">Drag parts from the bar onto the canvas, then connect <strong>cyan → orange</strong>.</div>
      <div class="l1-demo-block" aria-hidden="true">
        <div class="l1-demo-caption">Place (toolbar → canvas)</div>
        <div class="l1-place-demo">
          <div class="l1-place-demo-bar"></div>
          <div class="l1-place-demo-chip">A</div>
          <div class="l1-place-demo-surface"></div>
        </div>
        <div class="l1-demo-caption">Wire (output → input)</div>
        <div class="l1-wire-demo">
          <span class="l1-demo-port l1-demo-cyan" title="output"></span>
          <span class="l1-wire-demo-track"><span class="l1-wire-demo-glow"></span></span>
          <span class="l1-demo-port l1-demo-orange" title="input"></span>
        </div>
      </div>
      <div class="l1-step" data-l1-step="pinA"><span class="l1-mark">○</span><span class="l1-text">Drag <strong>pin A</strong> from <strong>INPUTS</strong> onto the canvas</span></div>
      <div class="l1-step" data-l1-step="pinB"><span class="l1-mark">○</span><span class="l1-text">Drag <strong>pin B</strong> from <strong>INPUTS</strong> onto the canvas</span></div>
      <div class="l1-step" data-l1-step="andGate"><span class="l1-mark">○</span><span class="l1-text">Drag <strong>AND</strong> from <strong>GATES</strong> onto the canvas</span></div>
      <div class="l1-step" data-l1-step="ledX"><span class="l1-mark">○</span><span class="l1-text">Drag <strong>LED X</strong> from <strong>OUTPUT LEDs</strong></span></div>
      <div class="l1-step" data-l1-step="andins"><span class="l1-mark">○</span><span class="l1-text">Wire <strong>A</strong> and <strong>B</strong> into the <strong>AND</strong> (orange inputs)</span></div>
      <div class="l1-step" data-l1-step="xout"><span class="l1-mark">○</span><span class="l1-text">Wire <strong>AND</strong> <strong>cyan out</strong> → <strong>X</strong> orange in</span></div>
      <div class="l1-step l1-step-static" data-l1-step="disarm"><span class="l1-mark">◇</span><span class="l1-text"><strong>DISARM</strong> checks all four A,B combos — no fuse on this run</span></div>
    `;
  viewport.appendChild(coach);
  positionLevel1CoachDefault(coach, viewport);
  initLevel1CoachDrag(coach, viewport);
  refreshLevel1GuidedCoachFromDom(circuitLab);
}

/**
 * @param {any} circuitLab
 */
export function refreshLevel1GuidedCoachFromDom(circuitLab) {
  const coach = document.getElementById("level1-coach");
  if (!coach || !coach.classList.contains("level1-coach--guided")) return;
  refreshLevel1GuidedCoach(coach, () => getLevel1GuidedCoachState(circuitLab));
}

/**
 * @param {HTMLElement} coach
 * @param {() => ReturnType<typeof getLevel1GuidedCoachState>} getState
 */
function refreshLevel1GuidedCoach(coach, getState) {
  const s = getState();
  const mark = (stepId, done) => {
    const row = coach.querySelector(`[data-l1-step="${stepId}"]`);
    if (!row || row.classList.contains("l1-step-static")) return;
    row.classList.toggle("l1-step-done", !!done);
    const m = row.querySelector(".l1-mark");
    if (m) m.textContent = done ? "✓" : "○";
  };
  mark("pinA", s.hasPinA);
  mark("pinB", s.hasPinB);
  mark("andGate", s.andOk);
  mark("ledX", s.hasLedX);
  mark("andins", s.bothAndInputs);
  mark("xout", s.xFed);

  const order = ["pinA", "pinB", "andGate", "ledX", "andins", "xout"];
  const doneFor = (id) => {
    if (id === "pinA") return s.hasPinA;
    if (id === "pinB") return s.hasPinB;
    if (id === "andGate") return s.andOk;
    if (id === "ledX") return s.hasLedX;
    if (id === "andins") return s.bothAndInputs;
    if (id === "xout") return s.xFed;
    return false;
  };
  let firstOpen = true;
  for (const id of order) {
    const row = coach.querySelector(`[data-l1-step="${id}"]`);
    if (!row) continue;
    row.classList.remove("l1-step-current");
    const done = doneFor(id);
    if (!done && firstOpen) {
      row.classList.add("l1-step-current");
      firstOpen = false;
    }
  }
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
  if (!coach || coach.classList.contains("level1-coach--guided")) return;
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

/** @param {number} a @param {number} b @param {number} c */
function level1ExpectedXyz(a, b, c) {
  return { x: a & b, y: c ? 0 : 1, z: b | c };
}

/**
 * Full reference table for Gate Basics (three outputs); live digits update with pins + wiring.
 * @param {HTMLElement} viewport
 */
function mountLevel1FullTruthTable(viewport) {
  const tracker = document.createElement("div");
  tracker.className = "truth-table-tracker truth-table-tracker--wide visible";
  tracker.id = "tt-tracker";
  tracker.dataset.variant = "l1-full";

  const combos = ["000", "001", "010", "011", "100", "101", "110", "111"];
  const rows = combos
    .map((c) => {
      const a = +c[0];
      const b = +c[1];
      const cc = +c[2];
      const { x, y, z } = level1ExpectedXyz(a, b, cc);
      return `
        <div class="tt-row tt-row--l1" data-combo="${c}">
          <span class="tt-in">${c}</span>
          <span class="tt-spec-xyz" title="Spec: X Y Z">${x}${y}${z}</span>
          <span class="tt-live-xyz" title="Your circuit (current ABC row)">— — —</span>
        </div>`;
    })
    .join("");

  tracker.innerHTML = `
      <div class="tt-title">TARGET TRUTH TABLE</div>
      <div class="tt-head tt-head--l1">
        <span>ABC</span><span class="tt-hdr-mid">need X·Y·Z</span><span class="tt-hdr-live">yours</span>
      </div>
      ${rows}
      <div class="tt-footnote">DISARM checks every row at once.</div>
    `;
  viewport.appendChild(tracker);
}

/**
 * Guided intro: four A,B rows; X = A·B only.
 * @param {HTMLElement} viewport
 */
function mountLevel1GuidedTruthTable(viewport) {
  const tracker = document.createElement("div");
  tracker.className = "truth-table-tracker visible";
  tracker.id = "tt-tracker";
  tracker.dataset.variant = "l1-guided";

  const combos = ["00", "01", "10", "11"];
  const rows = combos
    .map((c) => {
      const a = +c[0];
      const b = +c[1];
      const x = a & b;
      return `
        <div class="tt-row tt-row--l1g" data-combo="${c}">
          <span class="tt-in">${c}</span>
          <span class="tt-spec-x" title="Spec for X">${x}</span>
          <span class="tt-live-x" title="LED X">—</span>
        </div>`;
    })
    .join("");

  tracker.innerHTML = `
      <div class="tt-title">AND TRUTH TABLE</div>
      <div class="tt-head tt-head--l1g">
        <span>AB</span><span class="tt-hdr-mid">need X</span><span class="tt-hdr-live">yours</span>
      </div>
      ${rows}
      <div class="tt-footnote">Tap pins A,B — middle column is the spec.</div>
    `;
  viewport.appendChild(tracker);
}

/**
 * Levels 2 & 5 — spec column filled from algebra; live column follows your wiring for current ABC.
 * @param {HTMLElement} viewport
 * @param {{ id: number, expectedQ?: (a:number,b:number,c:number)=>number, expectedF?: (a:number,b:number,c:number)=>number }} level
 */
function mountSingleOutputTruthTable(viewport, level) {
  const tracker = document.createElement("div");
  tracker.className = "truth-table-tracker visible";
  tracker.id = "tt-tracker";
  tracker.dataset.variant = "single";

  const allCombos = ["000", "001", "010", "011", "100", "101", "110", "111"];
  const outputLabel = level.id === 2 ? "Q" : "F";
  const expectFn = level.id === 2 ? level.expectedQ : level.expectedF;
  const totalWinning = level.id === 2 ? 6 : 4;

  const rows = allCombos
    .map((c) => {
      const a = +c[0];
      const b = +c[1];
      const cc = +c[2];
      const spec = expectFn(a, b, cc);
      return `
        <div class="tt-row" data-combo="${c}" data-expected="${spec}">
          <span>${c[0]}</span><span>${c[1]}</span><span>${c[2]}</span>
          <span class="tt-spec">${spec}</span>
          <span class="tt-live">—</span>
          <span class="tt-check">—</span>
        </div>`;
    })
    .join("");

  tracker.innerHTML = `
      <div class="tt-title">TRUTH TABLE</div>
      <div class="tt-head tt-head--single">
        <span>A</span><span>B</span><span>C</span>
        <span class="tt-hdr-spec">${outputLabel}<span class="tt-sub">spec</span></span>
        <span class="tt-hdr-live">${outputLabel}<span class="tt-sub">live</span></span>
        <span class="tt-hdr-mark">✓</span>
      </div>
      ${rows}
      <div class="tt-progress" id="tt-progress">0 / ${totalWinning} rows</div>
    `;

  viewport.appendChild(tracker);
}

/**
 * @param {{ id: number, isGuidedIntro?: boolean, expectedQ?: Function, expectedF?: Function }} level
 */
export function createTruthTableTracker(level) {
  const viewport = document.querySelector(".circuit-viewport");
  if (!viewport) return;

  if (level.id === 1 && level.isGuidedIntro) {
    mountLevel1GuidedTruthTable(viewport);
    return;
  }
  if (level.id === 1) {
    mountLevel1FullTruthTable(viewport);
    return;
  }
  if (level.id === 2 || level.id === 5) {
    mountSingleOutputTruthTable(viewport, level);
  }
}

/**
 * Refresh live outputs for Level 1 tables when pins or wiring change.
 * @param {import('../modules/circuitLab.js').CircuitLab} lab
 * @param {{ id: number, isGuidedIntro?: boolean }} level
 */
export function refreshLevel1TruthTableFromLab(lab, level) {
  const tracker = document.getElementById("tt-tracker");
  if (!tracker || level.id !== 1) return;

  const pins = lab.getPinValues();
  const variant = tracker.dataset.variant;

  if (variant === "l1-guided") {
    const combo = `${pins.A ?? 0}${pins.B ?? 0}`;
    const ledX = lab.findLedByLabel("X");
    tracker.querySelectorAll(".tt-row--l1g").forEach((row) => {
      row.classList.toggle("tt-row-current", row.dataset.combo === combo);
      const live = row.querySelector(".tt-live-x");
      if (!live) return;
      if (row.dataset.combo !== combo) {
        live.textContent = "—";
        return;
      }
      if (!ledX) {
        live.textContent = "?";
        return;
      }
      const r = lab.evaluate({});
      live.textContent = String(r.outputs[ledX.id] ?? 0);
    });
    return;
  }

  if (variant === "l1-full") {
    const combo = `${pins.A ?? 0}${pins.B ?? 0}${pins.C ?? 0}`;
    const ledX = lab.findLedByLabel("X");
    const ledY = lab.findLedByLabel("Y");
    const ledZ = lab.findLedByLabel("Z");
    tracker.querySelectorAll(".tt-row--l1").forEach((row) => {
      row.classList.toggle("tt-row-current", row.dataset.combo === combo);
      const live = row.querySelector(".tt-live-xyz");
      if (!live) return;
      if (row.dataset.combo !== combo) {
        live.textContent = "— — —";
        return;
      }
      if (!ledX || !ledY || !ledZ) {
        live.textContent = "? ? ?";
        return;
      }
      const r = lab.evaluate({});
      const xv = r.outputs[ledX.id] ?? 0;
      const yv = r.outputs[ledY.id] ?? 0;
      const zv = r.outputs[ledZ.id] ?? 0;
      live.textContent = `${xv} ${yv} ${zv}`;
    });
  }
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
      <div class="sr-ref-block" aria-label="SR latch reference">
        <div class="sr-ref-title">BEHAVIOR (ideal)</div>
        <div class="sr-ref-row"><span>S R</span><span></span><span>effect</span></div>
        <div class="sr-ref-row"><span>0 0</span><span>→</span><span>hold Q</span></div>
        <div class="sr-ref-row"><span>1 0</span><span>→</span><span>set Q=1</span></div>
        <div class="sr-ref-row"><span>0 1</span><span>→</span><span>reset Q=0</span></div>
        <div class="sr-ref-row sr-ref-warn"><span>1 1</span><span>→</span><span>invalid — avoid</span></div>
      </div>
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
      <div class="jk-ref-inline" aria-label="JK flip-flop reference">
        <div class="jk-ref-title">ON EACH CLOCK TAP</div>
        <div class="jk-ref-row"><span>J K</span><span></span><span>Q next</span></div>
        <div class="jk-ref-row"><span>0 0</span><span>→</span><span>no change</span></div>
        <div class="jk-ref-row"><span>1 0</span><span>→</span><span>set 1</span></div>
        <div class="jk-ref-row"><span>0 1</span><span>→</span><span>reset 0</span></div>
        <div class="jk-ref-row"><span>1 1</span><span>→</span><span>toggle</span></div>
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
 * @param {number} [expected] expected truth-table value for this row (0 or 1).
 *   When omitted, falls back to the legacy "1 means good, 0 means wrong"
 *   behavior used before per-row expectations were threaded through.
 */
export function updateTruthTableTrackerDom(combo, outputVal, progress, expected) {
  const tracker = document.getElementById("tt-tracker");
  if (!tracker) return;

  if (tracker.dataset.variant === "single") {
    tracker.querySelectorAll(".tt-row .tt-live").forEach((el) => {
      el.textContent = "—";
    });
  }

  const row = tracker.querySelector(`[data-combo="${combo}"]`);
  if (row) {
    const live = row.querySelector(".tt-live");
    const check = row.querySelector(".tt-check");
    if (live) live.textContent = String(outputVal);

    const expAttr = row.getAttribute("data-expected");
    const expFromDom = expAttr === "0" || expAttr === "1" ? parseInt(expAttr, 10) : null;
    const effectiveExpected = expected === 0 || expected === 1 ? expected : expFromDom;

    const hasExpected = effectiveExpected === 0 || effectiveExpected === 1;
    const matches = hasExpected ? outputVal === effectiveExpected : outputVal === 1;
    const found = !!(progress && progress.foundSet && progress.foundSet.has(combo));

    row.classList.remove("wrong");
    if (matches && found) {
      row.classList.add("found");
      if (check) check.textContent = "✓";
    } else if (matches) {
      if (check) check.textContent = hasExpected && effectiveExpected === 0 ? "—" : "?";
    } else {
      row.classList.add("wrong");
      if (check) check.textContent = "✗";
      setTimeout(() => row.classList.remove("wrong"), 1000);
    }
  }

  if (progress && tracker.dataset.variant === "single") {
    tracker.querySelectorAll("[data-combo]").forEach((r) => {
      const c = r.getAttribute("data-combo") || "";
      const chk = r.querySelector(".tt-check");
      const expAttr = r.getAttribute("data-expected");
      const exp = expAttr === "0" || expAttr === "1" ? parseInt(expAttr, 10) : null;
      const isFound = progress.foundSet && progress.foundSet.has(c);
      if (isFound && chk && exp === 1) {
        r.classList.add("found");
        chk.textContent = "✓";
      }
    });

    const prog = tracker.querySelector("#tt-progress");
    if (prog) prog.textContent = `${progress.found} / ${progress.total} found`;
  }
}
