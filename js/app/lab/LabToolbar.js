import { isValidLabPlaceKind } from "./isValidLabPlaceKind.js";
import { labBlockIdFromElement } from "./labBlockIdFromElement.js";
import { svgClientToSvg } from "./svgClientToSvg.js";

/** Matches css/responsive.css — tap-to-place palette only on small viewports. */
function isMobilePaletteUi() {
  return typeof window !== "undefined" && window.matchMedia("(max-width: 700px)").matches;
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

  bar.querySelectorAll("[data-lab-place]").forEach((chip) => {
    chip.addEventListener("dragstart", (e) => {
      if (isMobilePaletteUi()) {
        e.preventDefault();
        return;
      }
      const place = chip.getAttribute("data-lab-place") || "";
      e.dataTransfer.setData("text/plain", place);
      e.dataTransfer.effectAllowed = "copy";
    });

    chip.addEventListener("click", (e) => {
      if (!isMobilePaletteUi() || !host.isLabMode()) return;
      e.preventDefault();
      e.stopPropagation();
      const place = chip.getAttribute("data-lab-place") || "";
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
    });
  });

  /**
   * Second tap on the canvas drops the selected palette item (touch / narrow UI).
   * Uses `click` so panning/scrolling the viewport does not fire on pointerdown.
   */
  const onMobileCanvasPlaceClick = (e) => {
    if (!isMobilePaletteUi() || !pendingPlaceKind || !host.isLabMode()) return;
    const t = e.target;
    if (!(t instanceof Element)) return;
    if (t.closest("#lab-toolbar")) return;
    const svg = host.getRenderer()?.svg;
    if (!svg || !svg.contains(t)) return;
    if (t.closest(".lab-port")) return;
    if (labBlockIdFromElement(t)) return;
    if (t.closest("[data-lab-wire-id]")) return;

    const { x, y } = svgClientToSvg(svg, e.clientX, e.clientY);
    host.getCircuitLab().placeAt(pendingPlaceKind, x, y);
    host.onLabChanged();
    setPendingPlaceKind(null);
    e.preventDefault();
    e.stopImmediatePropagation();
  };

  if (circuitDropEl) {
    circuitDropEl.addEventListener("click", onMobileCanvasPlaceClick, true);
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
      if (circuitDropEl) {
        circuitDropEl.removeEventListener("dragover", onDragOver, true);
        circuitDropEl.removeEventListener("drop", onDrop, true);
        circuitDropEl.removeEventListener("click", onMobileCanvasPlaceClick, true);
      }
      if (viewport) viewport.classList.remove("lab-palette-pending-drop");
      bar.remove();
    },
  };
}
