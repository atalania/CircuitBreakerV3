// ============================================================
//  APP.JS — Main application controller (unified circuit lab)
// ============================================================

import { GameEngine, GameState } from "./modules/engine.js";
import { CircuitRenderer } from "./modules/circuits.js";
import { AITutor } from "./modules/tutor.js";
import { UIManager } from "./modules/ui.js";
import { AudioManager } from "./modules/audio.js";
import { Level1, getLevel1CoachState } from "./levels/level1.js";
import { Level2 } from "./levels/level2.js";
import { Level3 } from "./levels/level3.js";
import { Level4 } from "./levels/level4.js";
import { Level5 } from "./levels/level5.js";
import { CircuitLab, wirePath } from "./modules/circuitLab.js";
import { evaluateWithPins, ensureInputPins, ledIdForLabel } from "./levels/labLevelUtils.js";

function isValidLabPlaceKind(kind) {
  if (!kind) return false;
  const simple = ["and", "or", "not", "xor", "nand", "nor", "sr", "jk", "led", "low", "high"];
  if (simple.includes(kind)) return true;
  if (kind.startsWith("in:") && kind.length > 3) return true;
  if (kind.startsWith("led:") && kind.length > 4) return true;
  return false;
}

class App {
  constructor() {
    this.engine = new GameEngine();
    this.renderer = null;
    this.tutor = new AITutor();
    this.ui = new UIManager();
    this.audio = new AudioManager();
    this.levels = [Level1, Level2, Level3, Level4, Level5];
    this.currentLevel = null;
    this.selectedLevelIndex = 0;
    /** @type {{ kind: 'level', index: number } | { kind: 'endless' }} */
    this.menuPick = { kind: "level", index: 0 };
    /** Campaign + endless both use the interactive lab surface */
    this.labMode = true;
    this.endlessMode = false;
    /** @type {{ title: string, objective: string, table: Record<string, { F: number }> } | null} */
    this.endlessSpec = null;
    this.circuitLab = new CircuitLab();
    /** @type {{ remove: () => void } | null} */
    this._labUiTeardown = null;
    /** @type {{ fromKey: string, startCx: number, startCy: number } | null} */
    this._labWireDrag = null;
    /** @type {{ id: string, lastX: number, lastY: number, kind: 'gate' | 'cxcy' } | null} */
    this._labBlockDrag = null;
    this._labWireMove = (e) => this._onLabWireMove(e);
    this._labWireUp = (e) => this._onLabWireUp(e);
    this._labBlockMove = (e) => this._onLabBlockMove(e);
    this._labBlockPointerUp = (e) => this._onLabBlockPointerUp(e);
    this._labSvgPointerDown = (e) => this._onLabSvgPointerDown(e);
    this._srInvalidActive = false;
    /** @type {number | null} */
    this._labBlockMoveRaf = null;
    /** @type {PointerEvent | null} */
    this._labLastPointerEvent = null;
  }

  init() {
    this.ui.init();
    this.audio.init();

    this.engine.onTick = (t) => this._onTick(t);
    this.engine.onTimeUp = () => this._onTimeUp();
    this.engine.onStateChange = (s) => this._onStateChange(s);

    this.tutor.onMessage = (text, sender) => this.ui.addChatMessage(text, sender);
    this.tutor.onThinkingChange = (val) => this.ui.showThinking(val);

    this._bindEvents();
    this._bindGlobalShortcuts();

    this.ui.showMenu();
  }

  _bindEvents() {
    this.ui.elements.startBtn.addEventListener("click", () => {
      this.audio.init();
      if (this.menuPick.kind === "endless") {
        this._startEndless();
      } else {
        this._startLevel(this.menuPick.index);
      }
    });

    const clearMenuActive = () => {
      this.ui.elements.levelSelectBtns.forEach((b) => b.classList.remove("active"));
      if (this.ui.elements.circuitLabBtn) this.ui.elements.circuitLabBtn.classList.remove("active");
    };

    this.ui.elements.levelSelectBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.dataset.level ?? "0", 10);
        this.menuPick = { kind: "level", index: idx };
        this.selectedLevelIndex = idx;
        clearMenuActive();
        btn.classList.add("active");
      });
    });

    if (this.ui.elements.circuitLabBtn) {
      this.ui.elements.circuitLabBtn.addEventListener("click", () => {
        this.menuPick = { kind: "endless" };
        clearMenuActive();
        this.ui.elements.circuitLabBtn.classList.add("active");
      });
    }

    if (this.ui.elements.levelSelectBtns.length > 0) {
      this.ui.elements.levelSelectBtns[0].classList.add("active");
    }

    document.getElementById("submit-btn").addEventListener("click", () => this._onSubmit());
    document.getElementById("hint-btn").addEventListener("click", () => this._onHint());
    document.getElementById("reset-seq-btn").addEventListener("click", () => this._resetSequence());

    this.ui.elements.chatSendBtn.addEventListener("click", () => this._onChatSend());
    this.ui.elements.chatInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") this._onChatSend();
    });

    document.getElementById("sound-toggle").addEventListener("click", () => {
      const on = this.audio.toggle();
      document.getElementById("sound-toggle").textContent = on ? "🔊" : "🔇";
    });

    document.getElementById("menu-btn").addEventListener("click", () => {
      this.endlessMode = false;
      this.endlessSpec = null;
      this._teardownLabUi();
      this.engine.resetGame();
      this.ui.showMenu();
    });
  }

  _bindGlobalShortcuts() {
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" || e.repeat) return;
      const t = e.target;
      if (t === this.ui.elements.chatInput || this.ui.elements.modalOverlay.classList.contains("active")) return;
      if (!this.ui.elements.gameScreen.classList.contains("active")) return;
      if (this.engine.state !== GameState.PLAYING) return;
      if (this.currentLevel && this.currentLevel.id === 4) return;
      const vis = getComputedStyle(this.ui.elements.submitBtn);
      if (vis.display === "none") return;
      e.preventDefault();
      this._onSubmit();
    });
  }

  _startLevel(index) {
    this._teardownLabUi();
    this.endlessMode = false;
    this.endlessSpec = null;
    this.labMode = true;
    this.engine.currentLevelIndex = index;
    this.currentLevel = this.levels[index];
    this.engine.hintsUsed = 0;
    this._srInvalidActive = false;

    const container = document.getElementById("circuit-container");
    this.renderer = new CircuitRenderer(container);
    this.renderer.allowSwitchToggle = null;

    this.circuitLab.clear();
    this.circuitLab.tool = null;
    this._labWireDrag = null;
    this._labBlockDrag = null;

    this.currentLevel.resetProgress?.();
    this.currentLevel.setupLab?.(this.circuitLab);

    this.ui.showGame();
    this._syncSubmitVisibility();
    this.ui.updateLevelInfo(this.currentLevel.id, this.currentLevel.title);
    this.ui.updateObjective(this.currentLevel.objective);
    this.ui.updateScore(this.engine.score);
    this.ui.clearChat();

    this._mountLabToolbar();
    this._labRedraw();
    if (this.currentLevel.id === 4) {
      Level4.primeLab(this.circuitLab);
    }

    this._setupLevelUI();

    this.engine.startLevel(this.currentLevel.timeLimit);

    this.tutor.setLevelContext(this.currentLevel.tutorContext);
    this.tutor.getIntroMessage();

    if (this.currentLevel.id === 1) {
      this.ui.addChatMessage(
        "Tutorial: A/B/C are on the left, X/Y/Z on the right. Drag AND, OR, NOT into the gap — wire from cyan outputs to orange inputs.",
        "system"
      );
      this.ui.addChatMessage(
        "Goals: X = A AND B. Y = NOT C (Y on when C is off). Z = B OR C. Tap pins to test, then DISARM for a full check.",
        "system"
      );
    }

    this.circuitLab.applyVisuals(this.renderer, CircuitLab.emptyInputStates());
  }

  async _startEndless() {
    this._teardownLabUi();
    this.endlessMode = true;
    this.labMode = true;
    this.currentLevel = null;
    this.engine.hintsUsed = 0;
    this.engine._stopTimer();
    this.engine.state = GameState.PLAYING;

    const container = document.getElementById("circuit-container");
    this.renderer = new CircuitRenderer(container);
    this.renderer.allowSwitchToggle = null;

    this.circuitLab.clear();
    this.circuitLab.tool = null;
    this._labWireDrag = null;
    this._labBlockDrag = null;

    this.ui.showGame();
    document.getElementById("submit-btn").style.display = "";
    document.getElementById("hint-btn").style.display = "";
    document.getElementById("reset-seq-btn").style.display = "none";
    this.ui.updateLevelInfo(-1, "Fetching briefing…");
    this.ui.updateObjective("Contacting AI for a new objective…");
    this.ui.updateScore(this.engine.score);
    this.ui.clearChat();
    this.ui.updateEndlessTimer();

    this._mountLabToolbar();
    this._labRedraw();

    const spec = await this.tutor.fetchEndlessChallenge();
    this.endlessSpec = spec;
    this.tutor.setLevelContext(
      `Endless mode: ${spec.title}. Student builds on the lab canvas with pins A,B,C and LED F. Objective: ${spec.objective} Truth table (F values for ABC keys): ${JSON.stringify(spec.table)}`
    );
    this.ui.updateLevelInfo(-1, spec.title);
    this.ui.updateObjective(spec.objective);
    this.tutor.getIntroMessage();
    this.circuitLab.applyVisuals(this.renderer, CircuitLab.emptyInputStates());
  }

  _syncSubmitVisibility() {
    const submit = document.getElementById("submit-btn");
    if (!this.currentLevel) {
      submit.style.display = "";
      return;
    }
    submit.style.display = this.currentLevel.id === 4 ? "none" : "";
  }

  _teardownLabUi() {
    if (this._labUiTeardown) {
      this._labUiTeardown.remove();
      this._labUiTeardown = null;
    }
    const bar = document.getElementById("lab-toolbar");
    if (bar) bar.remove();
    document
      .querySelectorAll(".truth-table-tracker, .sequence-tracker, .sr-latch-tracker, .level1-coach")
      .forEach((el) => el.remove());
  }

  _mountLabToolbar() {
    const panel = document.querySelector(".circuit-panel");
    if (!panel) return;
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
      <span class="lab-toolbar-label">IO</span>
      <div class="lab-palette-chip" draggable="true" data-lab-place="led" title="LED (auto name)">LED</div>
      <div class="lab-palette-chip" draggable="true" data-lab-place="led:X" title="LED X">X</div>
      <div class="lab-palette-chip" draggable="true" data-lab-place="led:Y" title="LED Y">Y</div>
      <div class="lab-palette-chip" draggable="true" data-lab-place="led:Z" title="LED Z">Z</div>
      <div class="lab-palette-chip" draggable="true" data-lab-place="led:Q" title="LED Q">Q</div>
      <div class="lab-palette-chip" draggable="true" data-lab-place="led:QN" title="LED Qn">Qn</div>
      <div class="lab-palette-chip" draggable="true" data-lab-place="led:F" title="LED F">F</div>
      <span class="lab-toolbar-div"></span>
      <span class="lab-toolbar-label">MACRO</span>
      <div class="lab-palette-chip" draggable="true" data-lab-place="sr" title="SR latch">SR</div>
      <div class="lab-palette-chip" draggable="true" data-lab-place="jk" title="JK flip-flop">JK</div>
      <span class="lab-toolbar-div"></span>
      <span class="lab-toolbar-label">TOOLS</span>
      <button type="button" class="lab-tool" data-lab-tool="erase">Erase</button>
      <button type="button" class="lab-tool lab-tool-danger" data-lab-tool="clear">Clear</button>
    `;
    const viewport = document.querySelector(".circuit-viewport");
    const circuitDropEl = document.getElementById("circuit-container");
    panel.insertBefore(bar, viewport || panel.firstChild);

    bar.querySelectorAll("[data-lab-place]").forEach((chip) => {
      chip.addEventListener("dragstart", (e) => {
        const place = chip.getAttribute("data-lab-place") || "";
        e.dataTransfer.setData("text/plain", place);
        e.dataTransfer.effectAllowed = "copy";
      });
    });

    const onDragOver = (e) => {
      if (!this.labMode) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    };
    const onDrop = (e) => {
      if (!this.labMode) return;
      e.preventDefault();
      const kind = e.dataTransfer.getData("text/plain");
      if (!isValidLabPlaceKind(kind)) return;
      const svg = this.renderer && this.renderer.svg;
      if (!svg) return;
      const { x, y } = this._svgClientToSvg(svg, e.clientX, e.clientY);
      this.circuitLab.placeAt(kind, x, y);
      this._labRedraw();
    };

    if (circuitDropEl) {
      circuitDropEl.addEventListener("dragover", onDragOver, true);
      circuitDropEl.addEventListener("drop", onDrop, true);
    }

    bar.querySelectorAll("[data-lab-tool]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tool = btn.getAttribute("data-lab-tool");
        if (tool === "clear") {
          this.circuitLab.clear();
          this.circuitLab.tool = null;
          bar.querySelectorAll(".lab-tool").forEach((b) => b.classList.remove("active"));
          if (this.currentLevel?.id === 1) {
            Level1.setupLab(this.circuitLab);
            this.ui.addChatMessage("Canvas reset to the tutorial layout (inputs left, LEDs right).", "system");
          } else {
            this.ui.addChatMessage("Canvas cleared.", "system");
          }
          this._labRedraw();
          if (this.currentLevel?.id === 4) Level4.primeLab(this.circuitLab);
          return;
        }
        if (tool === "erase") {
          const eraseBtn = bar.querySelector('[data-lab-tool="erase"]');
          const on = eraseBtn && eraseBtn.classList.contains("active");
          bar.querySelectorAll(".lab-tool").forEach((b) => b.classList.remove("active"));
          if (on) {
            this.circuitLab.tool = null;
          } else {
            this.circuitLab.tool = "erase";
            eraseBtn.classList.add("active");
          }
        }
      });
    });

    this._labUiTeardown = {
      remove: () => {
        if (circuitDropEl) {
          circuitDropEl.removeEventListener("dragover", onDragOver, true);
          circuitDropEl.removeEventListener("drop", onDrop, true);
        }
        bar.remove();
      },
    };
  }

  _svgClientToSvg(svg, clientX, clientY) {
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: clientX, y: clientY };
    const p = pt.matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  }

  _labBlockIdFromEl(el) {
    const g = el.closest("[id^='gate-'], [id^='led-'], [id^='source-'], [id^='macro-'], .lab-jk-hit");
    if (!g) return null;
    if (g.classList.contains("lab-jk-hit")) {
      return g.dataset.jkId || null;
    }
    const id = g.getAttribute("id") || "";
    if (id.startsWith("gate-")) return id.slice(5);
    if (id.startsWith("led-")) return id.slice(4);
    if (id.startsWith("source-")) return id.slice(7);
    if (id.startsWith("macro-")) return id.slice(6);
    return null;
  }

  _labRedraw() {
    this.circuitLab.render(this.renderer);
    this.renderer.onInputChange = (states) => this._onInputChange(states);

    const freshSvg = this.renderer.svg;
    if (!freshSvg) return;

    this._labAttachCanvasInteractions(freshSvg);
    this.circuitLab.applyVisuals(this.renderer, CircuitLab.emptyInputStates());
    if (this.currentLevel?.id === 1) this._refreshLevel1Coach();
  }

  _labAttachCanvasInteractions(svg) {
    svg.addEventListener("pointerdown", this._labSvgPointerDown);

    svg.querySelectorAll(".lab-port").forEach((c) => {
      c.addEventListener("pointerdown", (e) => {
        if (!this.labMode) return;
        const el = /** @type {Element} */ (e.target);
        const port = el.dataset.port || "";
        const isOut = port === "out" || port.startsWith("outQ");
        if (!isOut) return;
        if (this.circuitLab.tool === "erase") return;
        e.preventDefault();
        e.stopPropagation();
        this._labWireDrag = {
          fromKey: el.dataset.portKey || "",
          startCx: parseFloat(el.getAttribute("cx") || "0"),
          startCy: parseFloat(el.getAttribute("cy") || "0"),
        };
        window.addEventListener("pointermove", this._labWireMove);
        window.addEventListener("pointerup", this._labWireUp, { once: true });
      });
    });

    svg.querySelectorAll(".lab-jk-hit").forEach((hit) => {
      hit.addEventListener("pointerdown", (e) => {
        if (!this.labMode) return;
        if (this.circuitLab.tool === "erase") return;
        if (!this.currentLevel || this.currentLevel.id !== 4) return;
        e.preventDefault();
        e.stopPropagation();
        const id = hit.dataset.jkId || "";
        if (!id) return;
        this._handleJkPulse(id);
      });
    });
  }

  _onLabSvgPointerDown(e) {
    if (!this.labMode) return;

    const jkHit = /** @type {HTMLElement} */ (e.target).closest(".lab-jk-hit");
    if (jkHit && this.currentLevel?.id === 4) {
      return;
    }

    if (/** @type {HTMLElement} */ (e.target).closest(".lab-port")) return;

    if (this.circuitLab.tool === "erase") {
      const bid = this._labBlockIdFromEl(/** @type {HTMLElement} */ (e.target));
      if (bid) {
        this.circuitLab.removeBlock(bid);
        this._labRedraw();
        if (this.currentLevel?.id === 4) Level4.primeLab(this.circuitLab);
      }
      return;
    }

    const bid = this._labBlockIdFromEl(/** @type {HTMLElement} */ (e.target));
    if (bid) {
      const b = this.circuitLab.blocks.find((x) => x.id === bid);
      if (b?.kind === "source" && b.pin) {
        if (this.circuitLab.toggleSource(bid)) {
          this.audio.playSwitch();
          this._labRedraw();
          if (this.engine.state === GameState.PLAYING) {
            if (this.currentLevel?.id === 2 || this.currentLevel?.id === 5) {
              const pins = this.circuitLab.getPinValues();
              const combo = `${pins.A ?? 0}${pins.B ?? 0}${pins.C ?? 0}`;
              const led =
                this.currentLevel.id === 2
                  ? this.circuitLab.findLedByLabel("Q")
                  : this.circuitLab.findLedByLabel("F");
              if (led) {
                const r = evaluateWithPins(this.circuitLab, {
                  A: pins.A ?? 0,
                  B: pins.B ?? 0,
                  C: pins.C ?? 0,
                });
                const v = r.outputs[led.id] ?? 0;
                this._updateTruthTableTracker(combo, v, this.currentLevel.getProgress?.() || null);
              }
            }
          }
        }
        return;
      }
    }

    if (!bid) return;
    const b = this.circuitLab.blocks.find((x) => x.id === bid);
    if (!b) return;
    const svg = this.renderer.svg;
    if (!svg) return;
    const { x, y } = this._svgClientToSvg(svg, e.clientX, e.clientY);
    const isGate = ["and", "or", "not", "xor", "nand", "nor"].includes(b.kind);
    const isMacro = b.kind === "sr" || b.kind === "jk";
    const isConstSource = b.kind === "source" && !b.pin;
    const canMove = isGate || isMacro || b.kind === "led" || isConstSource;
    if (!canMove) return;
    this._labBlockDrag = {
      id: bid,
      lastX: x,
      lastY: y,
      kind: isGate || isMacro ? "gate" : "cxcy",
    };
    e.preventDefault();
    window.addEventListener("pointermove", this._labBlockMove);
    window.addEventListener("pointerup", this._labBlockPointerUp, { once: true });
  }

  _onLabBlockMove(e) {
    if (!this._labBlockDrag || !this.renderer.svg) return;
    this._labLastPointerEvent = e;
    if (this._labBlockMoveRaf != null) return;
    this._labBlockMoveRaf = requestAnimationFrame(() => {
      this._labBlockMoveRaf = null;
      const ev = this._labLastPointerEvent;
      if (!ev || !this._labBlockDrag || !this.renderer.svg) return;
      const { x, y } = this._svgClientToSvg(this.renderer.svg, ev.clientX, ev.clientY);
      const d = this._labBlockDrag;
      const dx = x - d.lastX;
      const dy = y - d.lastY;
      d.lastX = x;
      d.lastY = y;
      const b = this.circuitLab.blocks.find((z) => z.id === d.id);
      if (!b) return;
      if (d.kind === "gate") {
        b.xl += dx;
        b.yc += dy;
      } else {
        b.cx += dx;
        b.cy += dy;
      }
      this.circuitLab.render(this.renderer);
      this.renderer.onInputChange = (states) => this._onInputChange(states);
      this._labAttachCanvasInteractions(this.renderer.svg);
      this.circuitLab.applyVisuals(this.renderer, CircuitLab.emptyInputStates());
    });
  }

  _onLabBlockPointerUp() {
    if (this._labBlockMoveRaf != null) {
      cancelAnimationFrame(this._labBlockMoveRaf);
      this._labBlockMoveRaf = null;
    }
    this._labLastPointerEvent = null;
    window.removeEventListener("pointermove", this._labBlockMove);
    this._labBlockDrag = null;
  }

  _onLabWireMove(e) {
    const d = this._labWireDrag;
    if (!d || !this.renderer.svg) return;
    const { x, y } = this._svgClientToSvg(this.renderer.svg, e.clientX, e.clientY);
    this.circuitLab.setWirePreviewPath(this.renderer, wirePath([d.startCx, d.startCy], [x, y]));
  }

  _onLabWireUp(e) {
    window.removeEventListener("pointermove", this._labWireMove);
    const d = this._labWireDrag;
    this._labWireDrag = null;
    if (this.renderer.svg) this.circuitLab.hideWirePreview(this.renderer);
    if (d && d.fromKey) {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const port = el && /** @type {Element} */ (el).closest(".lab-port");
      if (port) {
        const pname = port.dataset.port || "";
        const pkey = port.dataset.portKey || "";
        if (pname === "in" || pname === "in0" || pname === "in1") {
          this.circuitLab.connectPorts(d.fromKey, pkey);
        }
      }
    }
    this._labRedraw();
  }

  _handleJkPulse(jkId) {
    if (this.engine.state !== GameState.PLAYING || !this.currentLevel || this.currentLevel.id !== 4) return;
    this.audio.playClock();
    const res = Level4.afterJkPulse(this.circuitLab, jkId);
    if (res.pulseResult) this._updateSequenceTracker(res.pulseResult);
    this._labRedraw();

    if (res.ok && res.pulseResult?.isComplete) {
      this.audio.playSuccess();
      this.ui.addChatMessage(res.message, "system");
      setTimeout(() => this._levelComplete(), 600);
    } else if (res.pulseResult?.isFailed) {
      this.audio.playFail();
      this.ui.addChatMessage(res.message, "system");
    } else if (res.message) {
      this.ui.addChatMessage(res.message, "system");
    }
  }

  _createLevel1Coach() {
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
    this._positionLevel1CoachDefault(coach, viewport);
    this._initLevel1CoachDrag(coach, viewport);
    this._refreshLevel1Coach();
  }

  _positionLevel1CoachDefault(coach, viewport) {
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
  _initLevel1CoachDrag(coach, viewport) {
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

  _refreshLevel1Coach() {
    const coach = document.getElementById("level1-coach");
    if (!coach) return;
    const s = getLevel1CoachState(this.circuitLab);
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

  _setupLevelUI() {
    const resetBtn = document.getElementById("reset-seq-btn");
    resetBtn.style.display = "none";

    document
      .querySelectorAll(".truth-table-tracker, .sequence-tracker, .sr-latch-tracker, .level1-coach")
      .forEach((el) => el.remove());

    const level = this.currentLevel;
    if (!level) return;

    if (level.id === 1) {
      this._createLevel1Coach();
    }
    if (level.id === 2 || level.id === 5) {
      this._createTruthTableTracker(level);
    }
    if (level.id === 3) {
      this._createSrLatchTracker(level);
    }
    if (level.id === 4) {
      this._createSequenceTracker();
      resetBtn.style.display = "block";
    }
  }

  _createTruthTableTracker(level) {
    const viewport = document.querySelector(".circuit-viewport");
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

  _createSrLatchTracker(level) {
    const viewport = document.querySelector(".circuit-viewport");
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
    this._updateSrLatchTracker(0);
  }

  _updateSrLatchTracker(currentStep) {
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

  _createSequenceTracker() {
    const viewport = document.querySelector(".circuit-viewport");
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

  _onInputChange() {
    if (this.engine.state !== GameState.PLAYING) return;
    if (!this.labMode) return;
    this.circuitLab.applyVisuals(this.renderer, CircuitLab.emptyInputStates());
  }

  _onSubmit() {
    if (this.engine.state !== GameState.PLAYING) return;
    if (!this.labMode) return;

    if (this.endlessMode) {
      this._submitEndless();
      return;
    }

    const level = this.currentLevel;
    if (!level) return;
    if (level.id === 4) return;

    const res = level.checkLab(this.circuitLab);

    if (level.id === 3) {
      if (res.srInvalid && !res.ok) {
        if (!this._srInvalidActive) {
          this._srInvalidActive = true;
          this.ui.addChatMessage(res.message || "Invalid SR inputs.", "system");
        }
        return;
      }
      this._srInvalidActive = false;
    }

    if (level.id === 2 || level.id === 5) {
      const combo = res.combo ?? `${this.circuitLab.getPinValues().A ?? 0}${this.circuitLab.getPinValues().B ?? 0}${this.circuitLab.getPinValues().C ?? 0}`;
      const outputKey = level.id === 2 ? (res.q ?? 0) : (res.f ?? 0);
      const prog = res.progress || level.getProgress?.();
      this._updateTruthTableTracker(combo, outputKey, prog);
      if (res.truthFail) {
        this.audio.playFail();
        this.ui.addChatMessage(res.message || "Try again.", "system");
      } else if (res.partial) {
        this.audio.playSwitch();
        this.ui.flashCircuit();
        this.ui.addChatMessage(res.message || "", "system");
      } else if (res.ok) {
        this.audio.playSuccess();
        this.ui.addChatMessage(res.message || "Cleared!", "system");
        setTimeout(() => this._levelComplete(), 700);
      } else {
        this.audio.playFail();
        this.ui.addChatMessage(res.message || "Not yet.", "system");
      }
      return;
    }

    if (level.id === 3) {
      if (res.ok) {
        this.audio.playSuccess();
        this.ui.flashCircuit();
        this.ui.addChatMessage(res.message || "", "system");
        this._updateSrLatchTracker(4);
        setTimeout(() => this._levelComplete(), 700);
      } else {
        if (res.message) this.ui.addChatMessage(res.message, "system");
        if (typeof res.step === "number") this._updateSrLatchTracker(res.step);
        if (res.advanced) {
          this.audio.playSuccess();
          this.ui.flashCircuit();
        } else if (!res.srInvalid) {
          this.audio.playFail();
        }
      }
      return;
    }

    if (level.id === 1) {
      if (res.ok) {
        this.audio.playSuccess();
        this.ui.flashCircuit();
        this.ui.addChatMessage(res.message || "", "system");
        setTimeout(() => this._levelComplete(), 700);
      } else {
        this.audio.playFail();
        this.ui.addChatMessage(res.message || "Not yet.", "system");
        this._requestTutorFeedback({}, "submitted DISARM");
      }
    }
  }

  _submitEndless() {
    if (!this.endlessSpec) return;
    const err = ensureInputPins(this.circuitLab, ["A", "B", "C"]);
    if (err) {
      this.audio.playFail();
      this.ui.addChatMessage(err, "system");
      return;
    }
    const idF = ledIdForLabel(this.circuitLab, "F");
    if (!idF) {
      this.audio.playFail();
      this.ui.addChatMessage("Add LED F and wire it to your Boolean output.", "system");
      return;
    }

    const table = this.endlessSpec.table;
    for (let a = 0; a <= 1; a++) {
      for (let b = 0; b <= 1; b++) {
        for (let c = 0; c <= 1; c++) {
          const key = `${a}${b}${c}`;
          const want = table[key]?.F;
          const r = evaluateWithPins(this.circuitLab, { A: a, B: b, C: c });
          const got = r.outputs[idF];
          if (got !== want) {
            this.audio.playFail();
            this.ui.addChatMessage(`Mismatch at ${key}: need F=${want}, circuit gives F=${got}.`, "system");
            return;
          }
        }
      }
    }

    this.audio.playSuccess();
    this.ui.flashCircuit();
    this.ui.addChatMessage("Truth table matches the AI brief — excellent work.", "system");
    setTimeout(() => this._endlessRoundComplete(), 700);
  }

  _endlessRoundComplete() {
    if (this.engine.state !== GameState.PLAYING) return;
    this.engine.score += 150;
    this.ui.updateScore(this.engine.score);
    this.ui.showModal(
      "ENDLESS — ROUND CLEARED",
      "<div class='modal-flavor'>Objective satisfied. Grab another AI brief or return to menu.</div>",
      "NEXT AI CHARGE",
      () => {
        this.ui.hideModal();
        this._startEndless();
      },
      "BRIEFING",
      () => {
        this.ui.hideModal();
        this.endlessMode = false;
        this.engine.resetGame();
        this.ui.showMenu();
      }
    );
  }

  _onHint() {
    if (this.engine.state !== GameState.PLAYING) return;
    this.engine.hintsUsed++;
    this.audio.playHint();

    const mode = this.endlessMode ? "endless" : "lab_level";
    const snapshot = this.circuitLab.briefDescribe();
    const pins = this.circuitLab.getPinValues();
    const vis = this.circuitLab.evaluate(CircuitLab.emptyInputStates());

    this.tutor.getHint({
      mode,
      lab: snapshot,
      pins,
      outputs: vis.outputs,
      levelId: this.currentLevel ? this.currentLevel.id : -1,
      endless: this.endlessSpec,
      hintsUsed: this.engine.hintsUsed,
    });
  }

  async _requestTutorFeedback(states, action) {
    const vis = this.circuitLab.evaluate(CircuitLab.emptyInputStates());
    this.tutor.getHint(
      {
        lab: this.circuitLab.briefDescribe(),
        pins: this.circuitLab.getPinValues(),
        outputs: vis.outputs,
        levelId: this.currentLevel ? this.currentLevel.id : -1,
      },
      action
    );
  }

  _onChatSend() {
    const input = this.ui.elements.chatInput;
    const text = input.value.trim();
    if (!text) return;
    input.value = "";

    this.ui.addChatMessage(text, "player");

    const vis = this.circuitLab.evaluate(CircuitLab.emptyInputStates());
    this.tutor.getHint(
      {
        lab: this.circuitLab.briefDescribe(),
        pins: this.circuitLab.getPinValues(),
        outputs: vis.outputs,
        levelId: this.currentLevel ? this.currentLevel.id : -1,
        mode: this.endlessMode ? "endless_chat" : "lab_chat",
        endless: this.endlessSpec,
        playerMessage: text,
      },
      `asked: "${text}"`
    );
  }

  _levelComplete() {
    if (this.engine.state !== GameState.PLAYING) return;
    const timeBonus = Math.floor(this.engine.timeRemaining * 10);
    this.engine.completeLevel();
    this.audio.playSuccess();

    const hasNext = this.engine.currentLevelIndex < this.levels.length - 1;
    this.ui.showSuccessModal(
      this.engine.score,
      timeBonus,
      () => {
        this.engine.resetGame();
        this.ui.showMenu();
      },
      hasNext
        ? () => {
            this.engine.nextLevel();
            this._startLevel(this.engine.currentLevelIndex);
          }
        : null
    );
  }

  _onTimeUp() {
    this.audio.playFail();
    if (this.endlessMode) {
      this.ui.showFailModal(() => this._startEndless());
    } else {
      this.ui.showFailModal(() => this._startLevel(this.engine.currentLevelIndex));
    }
    this.ui.elements.modalBtn2.onclick = () => {
      this.ui.hideModal();
      this.engine.resetGame();
      this.ui.showMenu();
    };
  }

  _onTick(t) {
    if (this.endlessMode) {
      this.ui.updateEndlessTimer();
      return;
    }
    if (!this.currentLevel) return;
    this.ui.updateTimer(t, this.currentLevel.timeLimit);
    if (t <= 10 && t > 0 && Math.abs(t - Math.round(t)) < 0.1) {
      this.audio.playTick();
    }
  }

  _onStateChange() {
    this.ui.updateScore(this.engine.score);
  }

  _updateTruthTableTracker(combo, outputVal, progress) {
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

  _updateSequenceTracker(result) {
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

  _resetSequence() {
    if (this.currentLevel?.id !== 4) return;
    Level4.resetSequence();
    Level4.primeLab(this.circuitLab);
    this.audio.playSwitch();

    const container = document.getElementById("seq-achieved");
    if (container) {
      container.querySelectorAll(".seq-val").forEach((v) => {
        v.textContent = "_";
        v.classList.remove("match", "miss", "filled");
      });
    }

    this._labRedraw();
    this.ui.addChatMessage("Sequence rewound. Q reset to 0.", "system");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const app = new App();
  app.init();
});
