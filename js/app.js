// ============================================================
//  APP.JS — Main application controller
// ============================================================

import { GameEngine, GameState } from "./modules/engine.js";
import { CircuitRenderer } from "./modules/circuits.js";
import { AITutor } from "./modules/tutor.js";
import { UIManager } from "./modules/ui.js";
import { AudioManager } from "./modules/audio.js";
import { Level1 } from "./levels/level1.js";
import { Level2 } from "./levels/level2.js";
import { Level3 } from "./levels/level3.js";
import { Level4 } from "./levels/level4.js";
import { Level5 } from "./levels/level5.js";

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
  }

  init() {
    this.ui.init();
    this.audio.init();

    // Bind engine callbacks
    this.engine.onTick = (t) => this._onTick(t);
    this.engine.onTimeUp = () => this._onTimeUp();
    this.engine.onStateChange = (s) => this._onStateChange(s);

    // Bind tutor callbacks
    this.tutor.onMessage = (text, sender) => this.ui.addChatMessage(text, sender);
    this.tutor.onThinkingChange = (val) => this.ui.showThinking(val);

    // Bind UI events
    this._bindEvents();

    // Show menu
    this.ui.showMenu();
  }

  _bindEvents() {
    // Menu
    this.ui.elements.startBtn.addEventListener("click", () => {
      this.audio.init(); // Ensure audio context on user gesture
      this._startLevel(this.selectedLevelIndex);
    });

    this.ui.elements.levelSelectBtns.forEach((btn, i) => {
      btn.addEventListener("click", () => {
        this.selectedLevelIndex = i;
        this.ui.elements.levelSelectBtns.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
      });
    });

    // First level selected by default
    if (this.ui.elements.levelSelectBtns.length > 0) {
      this.ui.elements.levelSelectBtns[0].classList.add("active");
    }

    // Submit button
    document.getElementById("submit-btn").addEventListener("click", () => this._onSubmit());

    // Hint button
    document.getElementById("hint-btn").addEventListener("click", () => this._onHint());

    // Reset sequence button (for level 4)
    document.getElementById("reset-seq-btn").addEventListener("click", () => this._resetSequence());

    // Chat input
    this.ui.elements.chatSendBtn.addEventListener("click", () => this._onChatSend());
    this.ui.elements.chatInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") this._onChatSend();
    });

    // Sound toggle
    document.getElementById("sound-toggle").addEventListener("click", () => {
      const on = this.audio.toggle();
      document.getElementById("sound-toggle").textContent = on ? "🔊" : "🔇";
    });

    // Menu button
    document.getElementById("menu-btn").addEventListener("click", () => {
      this.engine.resetGame();
      this.ui.showMenu();
    });
  }

  _startLevel(index) {
    this.engine.currentLevelIndex = index;
    this.currentLevel = this.levels[index];
    this.engine.hintsUsed = 0;

    // Setup renderer
    const container = document.getElementById("circuit-container");
    this.renderer = new CircuitRenderer(container);

    // Setup level circuit
    this.currentLevel.setup(this.renderer);

    // Wire up input change handler
    this.renderer.onInputChange = (states) => this._onInputChange(states);

    // Update UI
    this.ui.showGame();
    this.ui.updateLevelInfo(this.currentLevel.id, this.currentLevel.title);
    this.ui.updateObjective(this.currentLevel.objective);
    this.ui.updateScore(this.engine.score);
    this.ui.clearChat();

    // Level-specific UI
    this._setupLevelUI();

    // Start timer
    this.engine.startLevel(this.currentLevel.timeLimit);

    // Set tutor context and get intro
    this.tutor.setLevelContext(this.currentLevel.tutorContext);
    this.tutor.getIntroMessage();

    // Initial circuit evaluation
    const states = this.renderer.getInputStates();
    this._evaluateCircuit(states);
  }

  _setupLevelUI() {
    const resetBtn = document.getElementById("reset-seq-btn");
    resetBtn.style.display = "none";

    // Remove any existing trackers
    document.querySelectorAll(".truth-table-tracker, .sequence-tracker").forEach((el) => el.remove());

    const level = this.currentLevel;

    // Level 2 & 5: truth table tracker
    if (level.id === 2 || level.id === 5) {
      this._createTruthTableTracker(level);
    }

    // Level 4: sequence tracker + reset button
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

  _onInputChange(states) {
    if (this.engine.state !== GameState.PLAYING) return;
    this.audio.playSwitch();

    // Handle clock pulse for level 4
    if (this.currentLevel.id === 4 && states.CLK === 1) {
      this.audio.playClock();
      const result = this.currentLevel.clockPulse(states);
      this._updateSequenceTracker(result);

      // Update LED states after clock pulse
      this.renderer.setLEDState("Q", !!result.q);
      this.renderer.setLEDState("Qbar", !!result.qBar);
      this.renderer.setWireState("ff-q", !!result.q);
      this.renderer.setWireState("ff-qbar", !!result.qBar);

      if (result.isComplete) {
        this.audio.playSuccess();
        this.ui.addChatMessage("All four clock pulses matched the target! Module defused!", "system");
        setTimeout(() => this._levelComplete(), 800);
      } else if (result.isFailed) {
        this.audio.playFail();
        this.ui.addChatMessage("Sequence mismatch! Reset and try again.", "system");
      }
      return;
    }

    this._evaluateCircuit(states);
  }

  _evaluateCircuit(states) {
    const result = this.currentLevel.evaluate(states);

    // Update wires
    if (result.wireStates) {
      for (const [id, on] of Object.entries(result.wireStates)) {
        this.renderer.setWireState(id, on);
      }
    }

    // Update gates
    if (result.gateStates) {
      for (const [id, active] of Object.entries(result.gateStates)) {
        this.renderer.setGateActive(id, active);
      }
    }

    // Update LEDs
    if (result.outputs) {
      for (const [id, val] of Object.entries(result.outputs)) {
        this.renderer.setLEDState(id, !!val);
      }
    }

    // Level 1: auto-solve check
    if (this.currentLevel.id === 1 && result.isSolved) {
      this.audio.playSuccess();
      this.ui.flashCircuit();
      this.ui.addChatMessage("All outputs are HIGH! Hit SUBMIT to defuse!", "system");
    }

    // Level 3: show invalid state warning
    if (this.currentLevel.id === 3 && result.isInvalid) {
      this.ui.addChatMessage("⚠️ INVALID STATE: S=1 and R=1 simultaneously is forbidden for an SR latch!", "system");
    }
  }

  _onSubmit() {
    if (this.engine.state !== GameState.PLAYING) return;

    const states = this.renderer.getInputStates();
    const result = this.currentLevel.evaluate(states);
    const level = this.currentLevel;

    // Level 1: check if all outputs are 1
    if (level.id === 1) {
      if (result.isSolved) {
        this._levelComplete();
      } else {
        this.audio.playFail();
        this.ui.addChatMessage("Not all outputs are HIGH yet. Keep trying!", "system");
        this._requestTutorFeedback(states, "submitted an incorrect answer");
      }
      return;
    }

    // Level 2 & 5: mark current combo in truth table
    if (level.id === 2 || level.id === 5) {
      const outputKey = level.id === 2 ? "qValue" : "fValue";
      if (result[outputKey] === 1) {
        const progress = level.markCombo(result.combo);
        this._updateTruthTableTracker(result.combo, result[outputKey], progress);
        this.audio.playSwitch();
        this.ui.flashCircuit();
        if (progress.isComplete) {
          this.audio.playSuccess();
          this.ui.addChatMessage("All valid combinations found! Module defused!", "system");
          setTimeout(() => this._levelComplete(), 800);
        } else {
          this.ui.addChatMessage(`Correct! ${progress.found}/${progress.total} combos found. Keep going!`, "system");
        }
      } else {
        this.audio.playFail();
        this._updateTruthTableTracker(result.combo, result[outputKey], null);
        this.ui.addChatMessage(`Combo ${result.combo} gives output 0. Look for combos where the output is 1!`, "system");
      }
      return;
    }

    // Level 3: multi-step SR latch
    if (level.id === 3) {
      const stepResult = level.checkStep(states);
      if (stepResult.success) {
        this.audio.playSuccess();
        this.ui.flashCircuit();
        this.ui.addChatMessage(stepResult.message, "system");
        if (stepResult.done) {
          setTimeout(() => this._levelComplete(), 800);
        }
      } else {
        this.audio.playFail();
        this.ui.addChatMessage(stepResult.message, "system");
        this._requestTutorFeedback(states, `tried to complete step ${stepResult.step + 1}`);
      }
      return;
    }

    // Level 4: handled by clock pulse in _onInputChange
    if (level.id === 4) {
      this.ui.addChatMessage("Set J and K, then click the CLK button to pulse the clock!", "system");
    }
  }

  _onHint() {
    if (this.engine.state !== GameState.PLAYING) return;
    this.engine.hintsUsed++;
    this.audio.playHint();

    const states = this.renderer.getInputStates();
    const result = this.currentLevel.evaluate(states);

    this.tutor.getHint({
      inputs: states,
      outputs: result.outputs,
      levelId: this.currentLevel.id,
      step: result.step || 0,
      hintsUsed: this.engine.hintsUsed,
    });
  }

  async _requestTutorFeedback(states, action) {
    const result = this.currentLevel.evaluate(states);
    this.tutor.getHint(
      {
        inputs: states,
        outputs: result.outputs,
        levelId: this.currentLevel.id,
        step: result.step || 0,
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

    const states = this.renderer.getInputStates();
    const result = this.currentLevel.evaluate(states);

    this.tutor.getHint(
      {
        inputs: states,
        outputs: result.outputs,
        levelId: this.currentLevel.id,
        step: result.step || 0,
        playerMessage: text,
      },
      `asked: "${text}"`
    );
  }

  _levelComplete() {
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
    this.ui.showFailModal(() => this._startLevel(this.engine.currentLevelIndex));
    this.ui.elements.modalBtn2.onclick = () => {
      this.ui.hideModal();
      this.engine.resetGame();
      this.ui.showMenu();
    };
  }

  _onTick(t) {
    this.ui.updateTimer(t, this.currentLevel.timeLimit);
    // Tick sound every second when below 10s
    if (t <= 10 && t > 0 && Math.abs(t - Math.round(t)) < 0.1) {
      this.audio.playTick();
    }
  }

  _onStateChange(state) {
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

      if (outputVal === 1 && progress && progress.foundSet.has(combo)) {
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
        v.textContent = achieved[i];
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
    if (this.currentLevel.id !== 4) return;
    this.currentLevel.resetSequence();
    this.audio.playSwitch();

    // Reset tracker display
    const container = document.getElementById("seq-achieved");
    if (container) {
      container.querySelectorAll(".seq-val").forEach((v) => {
        v.textContent = "_";
        v.classList.remove("match", "miss", "filled");
      });
    }

    // Reset LEDs
    this.renderer.setLEDState("Q", false);
    this.renderer.setLEDState("Qbar", true);
    this.renderer.setWireState("ff-q", false);
    this.renderer.setWireState("ff-qbar", true);

    this.ui.addChatMessage("Sequence reset. Q is back to 0. Try again!", "system");
  }
}

// ---- Bootstrap ----
document.addEventListener("DOMContentLoaded", () => {
  const app = new App();
  app.init();
});
