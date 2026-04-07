import { CircuitLab, wirePath } from "../../modules/circuitLab.js";
import { GameState } from "../../modules/engine.js";
import { evaluateWithPins } from "../../levels/labLevelUtils.js";
import { labBlockIdFromElement } from "./labBlockIdFromElement.js";
import { svgClientToSvg } from "./svgClientToSvg.js";

/**
 * @typedef {object} LabCanvasHost
 * @property {() => boolean} isLabMode
 * @property {() => any} getCircuitLab
 * @property {() => any | null} getRenderer
 * @property {() => { id: number } | null} getCurrentLevel
 * @property {() => number} getEngineState
 * @property {() => void} playSwitch
 * @property {(states: any) => void} [onInputChange]
 * @property {(combo: string, outputVal: number, progress: any) => void} updateTruthTableTracker
 * @property {(jkId: string) => void} onJkPulse
 * @property {() => void} [afterRedraw]
 * @property {() => void} onLabChanged
 * @property {any} Level4
 */

export class LabCanvasController {
  static WIRE_DROP_SNAP_RADIUS_PX = 20;
  /**
   * @param {LabCanvasHost} host
   */
  constructor(host) {
    this.host = host;
    /** @type {{ fromKey: string, startCx: number, startCy: number } | null} */
    this._wireDrag = null;
    /** @type {{ id: string, lastX: number, lastY: number, kind: 'gate' | 'cxcy' } | null} */
    this._blockDrag = null;
    /** @type {number | null} */
    this._blockMoveRaf = null;
    /** @type {PointerEvent | null} */
    this._lastPointerEvent = null;

    this._wireMove = (e) => this._onWireMove(e);
    this._wireUp = (e) => this._onWireUp(e);
    this._blockMove = (e) => this._onBlockMove(e);
    this._blockPointerUp = (e) => this._onBlockPointerUp(e);
    this._svgPointerDown = (e) => this._onSvgPointerDown(e);
  }

  redraw() {
    const lab = this.host.getCircuitLab();
    const renderer = this.host.getRenderer();
    if (!renderer) return;
    lab.render(renderer);
    const onIn = this.host.onInputChange;
    if (onIn) renderer.onInputChange = onIn;

    const freshSvg = renderer.svg;
    if (!freshSvg) return;

    this.attachCanvasInteractions(freshSvg);
    lab.applyVisuals(renderer, CircuitLab.emptyInputStates());
    this.host.afterRedraw?.();
  }

  /**
   * @param {SVGSVGElement} svg
   */
  attachCanvasInteractions(svg) {
    svg.addEventListener("pointerdown", this._svgPointerDown);

    svg.querySelectorAll(".lab-port").forEach((c) => {
      c.addEventListener("pointerdown", (e) => {
        if (!this.host.isLabMode()) return;
        const el = /** @type {Element} */ (e.target);
        const port = el.dataset.port || "";
        const isOut = port === "out" || port.startsWith("outQ");
        if (!isOut) return;
        if (this.host.getCircuitLab().tool === "erase") return;
        e.preventDefault();
        e.stopPropagation();
        this._wireDrag = {
          fromKey: el.dataset.portKey || "",
          startCx: parseFloat(el.getAttribute("cx") || "0"),
          startCy: parseFloat(el.getAttribute("cy") || "0"),
        };
        window.addEventListener("pointermove", this._wireMove);
        window.addEventListener("pointerup", this._wireUp, { once: true });
      });
    });

    svg.querySelectorAll(".lab-jk-hit").forEach((hit) => {
      hit.addEventListener("pointerdown", (e) => {
        if (!this.host.isLabMode()) return;
        if (this.host.getCircuitLab().tool === "erase") return;
        const cur = this.host.getCurrentLevel();
        if (!cur || cur.id !== 4) return;
        e.preventDefault();
        e.stopPropagation();
        const id = hit.dataset.jkId || "";
        if (!id) return;
        this.host.onJkPulse(id);
      });
    });
  }

  /**
   * @param {PointerEvent} e
   */
  _onSvgPointerDown(e) {
    if (!this.host.isLabMode()) return;

    const jkHit = /** @type {HTMLElement} */ (e.target).closest(".lab-jk-hit");
    if (jkHit && this.host.getCurrentLevel()?.id === 4) {
      return;
    }

    if (/** @type {HTMLElement} */ (e.target).closest(".lab-port")) return;

    const lab = this.host.getCircuitLab();

    if (lab.tool === "erase") {
      const bid = labBlockIdFromElement(/** @type {HTMLElement} */ (e.target));
      if (bid) {
        lab.removeBlock(bid);
        this.host.onLabChanged();
        if (this.host.getCurrentLevel()?.id === 4) {
          this.host.Level4.primeLab(lab);
        }
      }
      return;
    }

    const bid = labBlockIdFromElement(/** @type {HTMLElement} */ (e.target));
    if (bid) {
      const b = lab.blocks.find((x) => x.id === bid);
      if (b?.kind === "source" && b.pin) {
        if (lab.toggleSource(bid)) {
          this.host.playSwitch();
          this.host.onLabChanged();
          if (this.host.getEngineState() === GameState.PLAYING) {
            const cur = this.host.getCurrentLevel();
            if (cur?.id === 2 || cur?.id === 5) {
              const pins = lab.getPinValues();
              const combo = `${pins.A ?? 0}${pins.B ?? 0}${pins.C ?? 0}`;
              const led =
                cur.id === 2
                  ? lab.findLedByLabel("Q")
                  : lab.findLedByLabel("F");
              if (led) {
                const r = evaluateWithPins(lab, {
                  A: pins.A ?? 0,
                  B: pins.B ?? 0,
                  C: pins.C ?? 0,
                });
                const v = r.outputs[led.id] ?? 0;
                this.host.updateTruthTableTracker(combo, v, cur.getProgress?.() || null);
              }
            }
          }
        }
        return;
      }
    }

    if (!bid) return;
    const b = lab.blocks.find((x) => x.id === bid);
    if (!b) return;
    const renderer = this.host.getRenderer();
    const svg = renderer && renderer.svg;
    if (!svg) return;
    const { x, y } = svgClientToSvg(svg, e.clientX, e.clientY);
    const isGate = ["and", "or", "not", "xor", "nand", "nor"].includes(b.kind);
    const isMacro = b.kind === "sr" || b.kind === "jk";
    const isConstSource = b.kind === "source" && !b.pin;
    const canMove = isGate || isMacro || b.kind === "led" || isConstSource;
    if (!canMove) return;
    this._blockDrag = {
      id: bid,
      lastX: x,
      lastY: y,
      kind: isGate || isMacro ? "gate" : "cxcy",
    };
    e.preventDefault();
    window.addEventListener("pointermove", this._blockMove);
    window.addEventListener("pointerup", this._blockPointerUp, { once: true });
  }

  /**
   * @param {PointerEvent} e
   */
  _onBlockMove(e) {
    if (!this._blockDrag) return;
    const renderer = this.host.getRenderer();
    if (!renderer || !renderer.svg) return;
    this._lastPointerEvent = e;
    if (this._blockMoveRaf != null) return;
    this._blockMoveRaf = requestAnimationFrame(() => {
      this._blockMoveRaf = null;
      const ev = this._lastPointerEvent;
      if (!ev || !this._blockDrag || !renderer.svg) return;
      const { x, y } = svgClientToSvg(renderer.svg, ev.clientX, ev.clientY);
      const d = this._blockDrag;
      const dx = x - d.lastX;
      const dy = y - d.lastY;
      d.lastX = x;
      d.lastY = y;
      const lab = this.host.getCircuitLab();
      const b = lab.blocks.find((z) => z.id === d.id);
      if (!b) return;
      if (d.kind === "gate") {
        b.xl += dx;
        b.yc += dy;
      } else {
        b.cx += dx;
        b.cy += dy;
      }
      lab.render(renderer);
      if (this.host.onInputChange) renderer.onInputChange = this.host.onInputChange;
      this.attachCanvasInteractions(renderer.svg);
      lab.applyVisuals(renderer, CircuitLab.emptyInputStates());
    });
  }

  _onBlockPointerUp() {
    if (this._blockMoveRaf != null) {
      cancelAnimationFrame(this._blockMoveRaf);
      this._blockMoveRaf = null;
    }
    this._lastPointerEvent = null;
    window.removeEventListener("pointermove", this._blockMove);
    this._blockDrag = null;
  }

  /**
   * @param {PointerEvent} e
   */
  _onWireMove(e) {
    const d = this._wireDrag;
    const renderer = this.host.getRenderer();
    if (!d || !renderer || !renderer.svg) return;
    const { x, y } = svgClientToSvg(renderer.svg, e.clientX, e.clientY);
    this.host.getCircuitLab().setWirePreviewPath(renderer, wirePath([d.startCx, d.startCy], [x, y]));
  }

  /**
   * @param {PointerEvent} e
   */
  _onWireUp(e) {
    window.removeEventListener("pointermove", this._wireMove);
    const d = this._wireDrag;
    this._wireDrag = null;
    const renderer = this.host.getRenderer();
    if (renderer && renderer.svg) this.host.getCircuitLab().hideWirePreview(renderer);
    if (d && d.fromKey) {
      const svg = renderer && renderer.svg;
      if (svg) {
        const port = this._findDropPort(svg, e.clientX, e.clientY);
        if (port) this.host.getCircuitLab().connectPorts(d.fromKey, port.dataset.portKey || "");
      }
    }
    this.host.onLabChanged();
  }

  /**
   * Prefer the element directly under the cursor; otherwise snap to nearest input port.
   * @param {SVGSVGElement} svg
   * @param {number} clientX
   * @param {number} clientY
   */
  _findDropPort(svg, clientX, clientY) {
    const el = document.elementFromPoint(clientX, clientY);
    const direct = el && /** @type {Element} */ (el).closest(".lab-port");
    if (direct) {
      const pname = direct.dataset.port || "";
      return pname.startsWith("in") ? direct : null;
    }

    const { x, y } = svgClientToSvg(svg, clientX, clientY);
    const snapR = this._clientPxToSvgUnits(svg, clientX, clientY, LabCanvasController.WIRE_DROP_SNAP_RADIUS_PX);

    /** @type {Element | null} */
    let best = null;
    let bestD2 = snapR * snapR;

    svg.querySelectorAll(".lab-port").forEach((p) => {
      const pname = p.dataset.port || "";
      if (!pname.startsWith("in")) return;
      const cx = parseFloat(p.getAttribute("cx") || "0");
      const cy = parseFloat(p.getAttribute("cy") || "0");
      const dx = cx - x;
      const dy = cy - y;
      const d2 = dx * dx + dy * dy;
      if (d2 <= bestD2) {
        bestD2 = d2;
        best = p;
      }
    });

    return best;
  }

  /**
   * Converts a screen-space pixel distance into SVG coordinate units at a point.
   * @param {SVGSVGElement} svg
   * @param {number} clientX
   * @param {number} clientY
   * @param {number} px
   */
  _clientPxToSvgUnits(svg, clientX, clientY, px) {
    const a = svgClientToSvg(svg, clientX, clientY);
    const b = svgClientToSvg(svg, clientX + px, clientY);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const r = Math.hypot(dx, dy);
    return Number.isFinite(r) && r > 0 ? r : px;
  }
}
