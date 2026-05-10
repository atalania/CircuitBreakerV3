import { isValidLabPlaceKind } from "./isValidLabPlaceKind.js";
import { labBlockIdFromElement } from "./labBlockIdFromElement.js";
import { svgClientToSvg } from "./svgClientToSvg.js";

/** Squared px movement below this counts as a tap (not scroll / drag). */
const TAP_MOVE_THRESH2 = 14 * 14;

/**
 * True when drag-from-palette is unreliable (touch) or layout matches mobile breakpoints.
 * Coarse-pointer catches phones in wide iframes and “desktop site” layouts.
 */
function shouldUseTapPlace() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(pointer: coarse)").matches ||
    window.matchMedia("(max-width: 900px)").matches
  );
}

function tapPlaceMediaQueries() {
  return [
    window.matchMedia("(max-width: 900px)"),
    window.matchMedia("(pointer: coarse)"),
  ];
}

/**
 * @typedef {object} LabToolbarHost
 * @property {() => boolean} isLabMode
 * @property {() => any} getCircuitLab
 * @property {() => any | null} getRenderer
 * @property {() => { id: number } | null} getCurrentLevel
 * @property {() => void} onLabChanged
 * @property {(text: string) => void} addSystemMessage
 * @property {any} Level1 — default level 1 module (fallback)
 * @property {() => any} [getLevel1ForCanvasReset] — Level1 vs guided intro for CLEAR CANVAS seed
 * @property {() => void} [afterClearLevel4]
 * @property {(cur: { id: number } | null) => void} [afterCanvasClear]
 */

/**
 * @param {HTMLElement | null} panel
 * @param {HTMLElement | null} circuitDropEl
 * @param {LabToolbarHost} host
 * @returns {{ remove: () => void } | null}
 */
export function mountLabToolbar(panel, circuitDropEl, host) {
  if (!panel) return null;

  const bar = document.createElement("div");
  bar.id = "lab-toolbar";
  bar.className = "lab-toolbar";
  bar.innerHTML = `
      <p class="lab-tap-place-hint" role="note" aria-live="polite">
        <strong>How to place parts:</strong> Tap a chip below to select it, then tap an <em>empty</em> spot on the dark circuit canvas to drop it there.
        Tap the same chip again to cancel. (Drag-from-palette is for a mouse.)
      </p>
      <span class="lab-toolbar-label">INPUTS</span>
      <div class="lab-palette-chip" draggable="true" data-lab-place="in:A" title="Pin A">A</div>
      <div class="lab-palette-chip" draggable="true" data-lab-place="in:B" title="Pin B">B</div>
      <div class="lab-palette-chip" draggable="true" data-lab-place="in:C" title="Pin C">C</div>
      <div class="lab-palette-chip" draggable="true" data-lab-place="in:S" title="Pin S">S</div>
      <div class="lab-palette-chip" draggable="true" data-lab-place="in:R" title="Pin R">R</div>
      <div class="lab-palette-chip" draggable="true" data-lab-place="in:J" title="Pin J">J</div>
      <div class="lab-palette-chip" draggable="true" data-lab-place="in:K" title="Pin K">K</div>
      <span class="lab-toolbar-div"></span>
      <span class="lab-toolbar-label">CONST</span>
      <div class="lab-palette-chip" draggable="true" data-lab-place="low" title="Constant 0">0</div>
      <div class="lab-palette-chip high" draggable="true" data-lab-place="high" title="Constant 1">1</div>
      <span class="lab-toolbar-div"></span>
      <span class="lab-toolbar-label">GATES</span>
      <div class="lab-palette-chip" draggable="true" data-lab-place="and" title="AND">AND</div>
      <div class="lab-palette-chip" draggable="true" data-lab-place="or" title="OR">OR</div>
      <div class="lab-palette-chip" draggable="true" data-lab-place="not" title="NOT">NOT</div>
      <div class="lab-palette-chip" draggable="true" data-lab-place="xor" title="XOR">XOR</div>
      <div class="lab-palette-chip" draggable="true" data-lab-place="nand" title="NAND">NAND</div>
      <div class="lab-palette-chip" draggable="true" data-lab-place="nor" title="NOR">NOR</div>
      <span class="lab-toolbar-div"></span>
      <span class="lab-toolbar-label">OUTPUT LEDs</span>
      <div class="lab-palette-chip lab-palette-led" draggable="true" data-lab-place="led" title="Generic LED output (auto-named)"><span class="lab-led-cap">LED</span><span class="lab-led-txt">+</span></div>
      <div class="lab-palette-chip lab-palette-led" draggable="true" data-lab-place="led:X" title="Named LED output X"><span class="lab-led-cap">LED</span><span class="lab-led-txt">X</span></div>
      <div class="lab-palette-chip lab-palette-led" draggable="true" data-lab-place="led:Y" title="Named LED output Y"><span class="lab-led-cap">LED</span><span class="lab-led-txt">Y</span></div>
      <div class="lab-palette-chip lab-palette-led" draggable="true" data-lab-place="led:Z" title="Named LED output Z"><span class="lab-led-cap">LED</span><span class="lab-led-txt">Z</span></div>
      <div class="lab-palette-chip lab-palette-led" draggable="true" data-lab-place="led:Q" title="Named LED output Q"><span class="lab-led-cap">LED</span><span class="lab-led-txt">Q</span></div>
      <div class="lab-palette-chip lab-palette-led" draggable="true" data-lab-place="led:QN" title="Named LED output Q-bar (QN)"><span class="lab-led-cap">LED</span><span class="lab-led-txt">QN</span></div>
      <div class="lab-palette-chip lab-palette-led" draggable="true" data-lab-place="led:F" title="Named LED output F (endless)"><span class="lab-led-cap">LED</span><span class="lab-led-txt">F</span></div>
      <span class="lab-toolbar-div"></span>
      <span class="lab-toolbar-label">MACRO</span>
      <div class="lab-palette-chip" draggable="true" data-lab-place="sr" title="SR latch">SR</div>
      <div class="lab-palette-chip" draggable="true" data-lab-place="jk" title="JK flip-flop">JK</div>
      <span class="lab-toolbar-div"></span>
      <span class="lab-toolbar-label">TOOLS</span>
      <button type="button" class="lab-tool lab-tool-wide" data-lab-tool="erase" title="Click a part to delete it; click a wire to remove only that wire">Erase / disconnect wire</button>
      <button type="button" class="lab-tool lab-tool-danger lab-tool-clear" data-lab-tool="clear" title="Wipe canvas and reload this charge’s default seeds">CLEAR CANVAS (reset)</button>
    `;
  const viewport = document.querySelector(".circuit-viewport");
  panel.insertBefore(bar, viewport || panel.firstChild);

  /** @type {string | null} */
  let pendingPlaceKind = null;
  /** Touch “tap workspace” bookkeeping (movement threshold filters scroll). */
  /** @type {{ pointerId: number, x: number, y: number } | null} */
  let circuitTapStart = null;
  /** @type {WeakMap<Element, { pointerId: number, x: number, y: number }>} */
  const chipTapStarts = new WeakMap();

  const setPendingPlaceKind = (kind) => {
    pendingPlaceKind = kind;
    bar.querySelectorAll("[data-lab-place]").forEach((c) => {
      const id = c.getAttribute("data-lab-place") || "";
      c.classList.toggle("lab-palette-chip--pending", kind !== null && id === kind);
      c.setAttribute("aria-pressed", kind !== null && id === kind ? "true" : "false");
    });
    if (viewport) {
      viewport.classList.toggle("lab-palette-pending-drop", kind !== null);
    }
  };

  const toggleChipPalette = (place) => {
    if (!isValidLabPlaceKind(place)) return;
    if (pendingPlaceKind === place) {
      setPendingPlaceKind(null);
    } else {
      setPendingPlaceKind(place);
      const lab = host.getCircuitLab();
      if (lab.tool === "erase") {
        lab.tool = null;
        bar.querySelectorAll(".lab-tool").forEach((b) => b.classList.remove("active"));
      }
    }
  };

  const applyTapPlaceEnv = () => {
    const tap = shouldUseTapPlace();
    bar.classList.toggle("lab-toolbar--tap-place", tap);
    bar.querySelectorAll("[data-lab-place]").forEach((chipEl) => {
      chipEl.draggable = !tap;
    });
  };

  const onTapPlaceMediaOrResize = () => applyTapPlaceEnv();
  applyTapPlaceEnv();
  const tapPlaceMqs = tapPlaceMediaQueries();
  tapPlaceMqs.forEach((mq) => mq.addEventListener("change", onTapPlaceMediaOrResize));
  window.addEventListener("resize", onTapPlaceMediaOrResize);

  bar.querySelectorAll("[data-lab-place]").forEach((chip) => {
    chip.addEventListener("dragstart", (e) => {
      if (shouldUseTapPlace()) {
        e.preventDefault();
        return;
      }
      const place = chip.getAttribute("data-lab-place") || "";
      e.dataTransfer.setData("text/plain", place);
      e.dataTransfer.effectAllowed = "copy";
    });

    chip.addEventListener("pointerdown", (e) => {
      if (!shouldUseTapPlace() || !host.isLabMode()) return;
      chipTapStarts.set(chip, { pointerId: e.pointerId, x: e.clientX, y: e.clientY });
    });

    chip.addEventListener("pointerup", (e) => {
      if (!shouldUseTapPlace() || !host.isLabMode()) return;
      const start = chipTapStarts.get(chip);
      chipTapStarts.delete(chip);
      if (!start || start.pointerId !== e.pointerId) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (dx * dx + dy * dy > TAP_MOVE_THRESH2) return;
      const place = chip.getAttribute("data-lab-place") || "";
      e.preventDefault();
      e.stopPropagation();
      toggleChipPalette(place);
    });

    chip.addEventListener("pointercancel", () => chipTapStarts.delete(chip));
  });

  /* Bubble phase so canvas / LabCanvasController handlers still receive the same gestures. */
  const circuitPointerDownTap = (e) => {
    if (!shouldUseTapPlace() || !pendingPlaceKind || !host.isLabMode() || !circuitDropEl) return;
    const svg = host.getRenderer()?.svg;
    if (!svg) return;
    const r = svg.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return;
    circuitTapStart = { pointerId: e.pointerId, x: e.clientX, y: e.clientY };
  };

  const circuitPointerUpTap = (e) => {
    if (!shouldUseTapPlace() || !pendingPlaceKind || !host.isLabMode() || !circuitDropEl) return;
    const svg = host.getRenderer()?.svg;
    if (!svg || !circuitTapStart || circuitTapStart.pointerId !== e.pointerId) {
      circuitTapStart = null;
      return;
    }
    const dx = e.clientX - circuitTapStart.x;
    const dy = e.clientY - circuitTapStart.y;
    circuitTapStart = null;
    if (dx * dx + dy * dy > TAP_MOVE_THRESH2) return;

    const cx = e.clientX;
    const cy = e.clientY;
    const svgRect = svg.getBoundingClientRect();
    if (cx < svgRect.left || cx > svgRect.right || cy < svgRect.top || cy > svgRect.bottom) return;

    const hit = document.elementFromPoint(cx, cy);
    if (!hit || !(hit instanceof Element)) return;
    if (!circuitDropEl.contains(hit)) return;
    if (hit.closest("#lab-toolbar")) return;
    if (hit.closest(".lab-port")) return;
    if (labBlockIdFromElement(hit)) return;
    if (hit.closest("[data-lab-wire-id]")) return;

    const kind = pendingPlaceKind;
    const { x, y } = svgClientToSvg(svg, cx, cy);
    host.getCircuitLab().placeAt(kind, x, y);
    host.onLabChanged();
    setPendingPlaceKind(null);
  };

  const circuitPointerCancelTap = (e) => {
    if (circuitTapStart && circuitTapStart.pointerId === e.pointerId) circuitTapStart = null;
  };

  if (circuitDropEl) {
    circuitDropEl.addEventListener("pointerdown", circuitPointerDownTap);
    circuitDropEl.addEventListener("pointerup", circuitPointerUpTap);
    circuitDropEl.addEventListener("pointercancel", circuitPointerCancelTap);
  }

  const onDragOver = (e) => {
    if (!host.isLabMode()) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };
  const onDrop = (e) => {
    if (!host.isLabMode()) return;
    e.preventDefault();
    const kind = e.dataTransfer.getData("text/plain");
    if (!isValidLabPlaceKind(kind)) return;
    const renderer = host.getRenderer();
    const svg = renderer && renderer.svg;
    if (!svg) return;
    const { x, y } = svgClientToSvg(svg, e.clientX, e.clientY);
    host.getCircuitLab().placeAt(kind, x, y);
    host.onLabChanged();
  };

  if (circuitDropEl) {
    circuitDropEl.addEventListener("dragover", onDragOver, true);
    circuitDropEl.addEventListener("drop", onDrop, true);
  }

  bar.querySelectorAll("[data-lab-tool]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tool = btn.getAttribute("data-lab-tool");
      const lab = host.getCircuitLab();
      if (tool === "clear") {
        setPendingPlaceKind(null);
        lab.clear();
        lab.tool = null;
        bar.querySelectorAll(".lab-tool").forEach((b) => b.classList.remove("active"));
        const cur = host.getCurrentLevel();
        host.afterCanvasClear?.(cur);
        if (cur?.id === 1) {
          const L1 = host.getLevel1ForCanvasReset ? host.getLevel1ForCanvasReset() : host.Level1;
          L1.setupLab(lab);
          host.addSystemMessage(L1.clearCanvasHint || "Canvas reset for this charge.");
        } else {
          host.addSystemMessage("Canvas cleared — progress for this charge has been reset.");
        }
        host.onLabChanged();
        if (cur?.id === 4) host.afterClearLevel4?.();
        return;
      }
      if (tool === "erase") {
        setPendingPlaceKind(null);
        const eraseBtn = bar.querySelector('[data-lab-tool="erase"]');
        const on = eraseBtn && eraseBtn.classList.contains("active");
        bar.querySelectorAll(".lab-tool").forEach((b) => b.classList.remove("active"));
        if (on) {
          lab.tool = null;
        } else {
          lab.tool = "erase";
          if (eraseBtn) eraseBtn.classList.add("active");
        }
        host.onLabChanged();
      }
    });
  });

  return {
    remove: () => {
      tapPlaceMqs.forEach((mq) => mq.removeEventListener("change", onTapPlaceMediaOrResize));
      window.removeEventListener("resize", onTapPlaceMediaOrResize);
      if (circuitDropEl) {
        circuitDropEl.removeEventListener("dragover", onDragOver, true);
        circuitDropEl.removeEventListener("drop", onDrop, true);
        circuitDropEl.removeEventListener("pointerdown", circuitPointerDownTap);
        circuitDropEl.removeEventListener("pointerup", circuitPointerUpTap);
        circuitDropEl.removeEventListener("pointercancel", circuitPointerCancelTap);
      }
      if (viewport) viewport.classList.remove("lab-palette-pending-drop");
      bar.remove();
    },
  };
}
