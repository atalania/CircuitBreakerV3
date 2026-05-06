// ============================================================
//  APP — Main application controller (unified circuit lab)
// ============================================================

import { GameEngine, GameState } from "../modules/engine.js";
import { CircuitRenderer } from "../modules/circuits.js";
import { AITutor } from "../modules/tutor.js";
import { UIManager } from "../modules/ui.js";
import { AudioManager } from "../modules/audio.js";
import { Level1 } from "../levels/level1.js";
import { Level2 } from "../levels/level2.js";
import { Level3 } from "../levels/level3.js";
import { Level4 } from "../levels/level4.js";
import { Level5 } from "../levels/level5.js";
import { CircuitLab } from "../modules/circuitLab.js";
import { sendAssistantGameEvent } from "../modules/portalAssistant.js";
import { getPortalLevelId, getPortalTargetConcept, getPortalTimeSpentSeconds } from "./portalGameContext.js";
import { mountLabToolbar } from "./lab/LabToolbar.js";
import { LabCanvasController } from "./lab/LabCanvasController.js";
import {
  teardownLevelOverlayNodes,
  createTruthTableTracker,
  createSrLatchTracker,
  createSequenceTracker,
  updateSrLatchTracker,
  updateSequenceTrackerDom,
  updateTruthTableTrackerDom,
} from "./levelOverlays.js";
import { processCampaignLabSubmit } from "./campaignSubmit.js";
import { submitEndlessRound } from "./endlessSubmit.js";
import { handleJkPulse } from "./jkPulse.js";
import {
  fetchPortalGameData,
  initPortalGameDataBridge,
  isPortalGameDataActive,
  normalizePortalGameData,
  speedScoreFromElapsedMs,
  updateHighScore,
} from "../modules/portalGameData.js";

export class App {
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
    this.labMode = true;
    this.endlessMode = false;
    /** @type {{ title: string, objective: string, table: Record<string, { F: number }> } | null} */
    this.endlessSpec = null;
    this.circuitLab = new CircuitLab();
    /** @type {{ remove: () => void } | null} */
    this._labUiTeardown = null;
    this._srInvalidActive = false;
    /** @type {number} epoch ms — for portal assistant timeSpentSeconds */
    this._levelPlayStartedAt = 0;
    /** @type {number} monotonically increasing endless request token */
    this._endlessRequestId = 0;
    /** @type {Record<string, unknown>} */
    this.portalData = {};
    /** @type {boolean} */
    this._portalDataReady = false;
    /** @type {(() => void) | null} */
    this._cleanupPortalGameDataBridge = null;

    this.labCanvas = new LabCanvasController({
      isLabMode: () => this.labMode,
      getCircuitLab: () => this.circuitLab,
      getRenderer: () => this.renderer,
      getCurrentLevel: () => this.currentLevel,
      getEngineState: () => this.engine.state,
      playSwitch: () => this.audio.playSwitch(),
      onInputChange: (states) => this._onInputChange(states),
      updateTruthTableTracker: (combo, v, prog, expected) => this._updateTruthTableTracker(combo, v, prog, expected),
      onJkPulse: (id) => handleJkPulse(this, id),
      afterRedraw: () => {},
      onLabChanged: () => this._labRedraw(),
      Level4,
    });
  }

  _portalLevelId() {
    return getPortalLevelId(this.endlessMode, this.currentLevel, this.endlessSpec);
  }

  _portalTargetConcept() {
    return getPortalTargetConcept(this.endlessMode, this.currentLevel);
  }

  _portalTimeSpentSeconds() {
    return getPortalTimeSpentSeconds(this._levelPlayStartedAt);
  }

  /**
   * Canonical fields assistants need (cannot be overwritten by callers' `extra`).
   * Includes human-readable titles so STEM bridge / wiki tooling can reconcile context.
   */
  _portalAssistantContextEnvelope() {
    return {
      campaignLevelNumericId: this.currentLevel?.id ?? null,
      endlessMode: !!this.endlessMode,
      portalLevelSlug: this._portalLevelId(),
      targetConceptEmitted: this._portalTargetConcept(),
      levelTitleUi:
        this.endlessMode === true ? (this.endlessSpec?.title ? String(this.endlessSpec.title) : null) : this.currentLevel?.title ?? null,
    };
  }

  /**
   * @param {string} eventType
   * @param {Record<string, unknown>} [extra]
   */
  _portalAssistantEvent(eventType, extra = {}) {
    const {
      hintCount: hintOverride,
      timeSpentSeconds: timeOverride,
      additionalContext: passedContext,
      ...restExtras
    } = typeof extra === "object" && extra ? extra : /** @type {any} */ ({});

    const hints =
      typeof hintOverride === "number" && Number.isFinite(hintOverride)
        ? hintOverride
        : this.engine.hintsUsed;
    const tsec =
      typeof timeOverride === "number" && Number.isFinite(timeOverride)
        ? timeOverride
        : this._portalTimeSpentSeconds();

    /** @type {Record<string, unknown>} */
    const envelope = this._portalAssistantContextEnvelope();
    /** @type {Record<string, unknown>} */
    const mergedAdditional =
      typeof passedContext === "object" && passedContext !== null ? { ...passedContext, ...envelope } : { ...envelope };

    sendAssistantGameEvent({
      ...restExtras,
      additionalContext: mergedAdditional,
      eventType,
      levelId: this._portalLevelId(),
      targetConcept: this._portalTargetConcept(),
      hintCount: hints,
      timeSpentSeconds: tsec,
    });
  }

  init() {
    this.ui.init();
    this.audio.init();
    this._initPortalGameData();

    this.engine.onTick = (t) => this._onTick(t);
    this.engine.onTimeUp = () => this._onTimeUp();
    this.engine.onStateChange = (s) => this._onStateChange(s);

    this.tutor.onMessage = (text, sender) => this.ui.addChatMessage(text, sender);
    this.tutor.onThinkingChange = (val) => this.ui.showThinking(val);

    this._bindEvents();
    this._bindGlobalShortcuts();

    this.ui.showMenu();
  }

  async _initPortalGameData() {
    if (!isPortalGameDataActive()) {
      this._portalDataReady = true;
      return;
    }
    this._cleanupPortalGameDataBridge = initPortalGameDataBridge();
    try {
      const loaded = await fetchPortalGameData();
      this.portalData = normalizePortalGameData(loaded);
    } catch {
      this.portalData = {};
    } finally {
      this._portalDataReady = true;
    }
  }

  /**
   * @param {number} runScore
   */
  _syncPortalHighScore(runScore) {
    if (!this._portalDataReady) return;
    this.portalData = updateHighScore(this.portalData, runScore);
  }

  _campaignSpeedLeaderboardScore() {
    const elapsedMs = this._levelPlayStartedAt ? Date.now() - this._levelPlayStartedAt : 0;
    return speedScoreFromElapsedMs(elapsedMs);
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
    this._levelPlayStartedAt = Date.now();
    this._portalAssistantEvent("level_start", { hintCount: 0, timeSpentSeconds: 0 });

    this.tutor.setLevelContext(this.currentLevel.tutorContext);

    this.circuitLab.applyVisuals(this.renderer, CircuitLab.emptyInputStates());
  }

  async _startEndless() {
    this._teardownLabUi();
    const requestId = ++this._endlessRequestId;
    /** Clear immediately so SUBMIT/HINT cannot verify against the previous round while fetching. */
    this.endlessSpec = null;
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

    const submitBtn = document.getElementById("submit-btn");
    const hintBtn = document.getElementById("hint-btn");
    if (submitBtn) submitBtn.disabled = true;
    if (hintBtn) hintBtn.disabled = true;

    try {
      const spec = await this.tutor.fetchEndlessChallenge();
      if (!this.endlessMode || requestId !== this._endlessRequestId) {
        return;
      }
      this.endlessSpec = spec;
      this._levelPlayStartedAt = Date.now();
      this._portalAssistantEvent("level_start", { hintCount: 0, timeSpentSeconds: 0 });
      this.tutor.setLevelContext(
        `Endless mode: ${spec.title}. Student builds on the lab canvas with pins A,B,C and LED F. Objective: ${spec.objective} Truth table (F values for ABC keys): ${JSON.stringify(spec.table)}`
      );
      this.ui.updateLevelInfo(-1, spec.title);
      this.ui.updateObjective(spec.objective);
      this.circuitLab.applyVisuals(this.renderer, CircuitLab.emptyInputStates());
    } finally {
      if (requestId === this._endlessRequestId) {
        if (submitBtn) submitBtn.disabled = false;
        if (hintBtn) hintBtn.disabled = false;
      }
    }
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
    teardownLevelOverlayNodes();
  }

  _mountLabToolbar() {
    const panel = document.querySelector(".circuit-panel");
    const circuitDropEl = document.getElementById("circuit-container");
    const tb = mountLabToolbar(panel, circuitDropEl, {
      isLabMode: () => this.labMode,
      getCircuitLab: () => this.circuitLab,
      getRenderer: () => this.renderer,
      getCurrentLevel: () => this.currentLevel,
      onLabChanged: () => this._labRedraw(),
      addSystemMessage: (text) => this.ui.addChatMessage(text, "system"),
      Level1,
      afterClearLevel4: () => Level4.primeLab(this.circuitLab),
      afterCanvasClear: (cur) => this._afterCanvasClear(cur),
    });
    this._labUiTeardown = tb;
  }

  /**
   * Run after the toolbar Clear button wipes the canvas. Resets level
   * progress and the matching on-screen tracker so a fresh build does not
   * inherit stale state.
   * @param {{ id: number } | null} cur
   */
  _afterCanvasClear(cur) {
    cur?.resetProgress?.();
    if (cur?.id === 2 || cur?.id === 5) {
      const tracker = document.getElementById("tt-tracker");
      if (tracker) {
        tracker.querySelectorAll(".tt-row").forEach((row) => {
          row.classList.remove("found", "wrong");
          const out = row.querySelector(".tt-output");
          const chk = row.querySelector(".tt-check");
          if (out) out.textContent = "?";
          if (chk) chk.textContent = "—";
        });
        const prog = tracker.querySelector("#tt-progress");
        const total = cur.id === 2 ? 6 : 4;
        if (prog) prog.textContent = `0 / ${total} found`;
      }
    }
    if (cur?.id === 3) {
      updateSrLatchTracker(0);
    }
    if (cur?.id === 4) {
      const seqContainer = document.getElementById("seq-achieved");
      if (seqContainer) {
        seqContainer.querySelectorAll(".seq-val").forEach((v) => {
          v.textContent = "_";
          v.classList.remove("match", "miss", "filled");
        });
      }
    }
  }

  _labRedraw() {
    this.labCanvas.redraw();
  }

  _setupLevelUI() {
    const resetBtn = document.getElementById("reset-seq-btn");
    resetBtn.style.display = "none";

    teardownLevelOverlayNodes();

    const level = this.currentLevel;
    if (!level) return;

    if (level.id === 2 || level.id === 5) {
      createTruthTableTracker(level);
    }
    if (level.id === 3) {
      createSrLatchTracker(level);
    }
    if (level.id === 4) {
      createSequenceTracker();
      resetBtn.style.display = "block";
    }
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
      submitEndlessRound(this);
      return;
    }

    if (!this.currentLevel || this.currentLevel.id === 4) return;
    const res = this.currentLevel.checkLab(this.circuitLab);
    processCampaignLabSubmit(this, res);
  }

  _onHint() {
    if (this.engine.state !== GameState.PLAYING) return;
    this.engine.hintsUsed++;
    this.audio.playHint();

    this._portalAssistantEvent("hint_request");

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
    this._portalAssistantEvent("level_complete");
    if (this.currentLevel) {
      const speedScore = this._campaignSpeedLeaderboardScore();
      this._syncPortalHighScore(speedScore);
    }
    const timeBonus = Math.floor(this.engine.timeRemaining * 10);
    this.engine.completeLevel();

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
    this._portalAssistantEvent("timeout", {
      additionalContext: {
        endless: this.endlessMode,
        campaignLevelId: this.currentLevel?.id ?? null,
        labSummary: this.circuitLab ? this.circuitLab.briefDescribe() : null,
      },
    });
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

  _updateTruthTableTracker(combo, outputVal, progress, expected) {
    updateTruthTableTrackerDom(combo, outputVal, progress, expected);
  }

  _updateSequenceTracker(result) {
    updateSequenceTrackerDom(result);
  }

  _updateSrLatchTracker(step) {
    updateSrLatchTracker(step);
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
