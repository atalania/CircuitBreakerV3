// ============================================================
//  LEVEL 4 — JK flip-flop sequence (circuit lab)
// ============================================================

import { ensureInputPins, evaluateWithPins } from "./labLevelUtils.js";

export const Level4 = {
  id: 4,
  title: "JK FLIP-FLOP",
  subtitle: "CLOCK • TOGGLE • STATE",
  timeLimit: 220,
  objective:
    "Wire J, K, and LED Q to a JK FF module. Tap the JK box to pulse the clock. Drive Q through 1 → 0 → 1 → 1 across four pulses (use REWIND if you slip). DISARM is hidden — only pulses count.",
  tutorContext: `Level 4 lab: Single JK macro. Student sets J/K via pins, taps the module for rising-edge updates, target Q sequence matches old level (1,0,1,1).`,

  _targetSequence: /** @type {number[]} */ ([1, 0, 1, 1]),
  _achievedSequence: /** @type {number[]} */ ([]),
  _pulseCount: 0,

  setupLab() {
    this.resetSequence();
  },

  resetProgress() {
    this.resetSequence();
  },

  resetSequence() {
    this._achievedSequence = [];
    this._pulseCount = 0;
  },

  /**
   * Reset JK state + sequence trackers when lab JK exists.
   * @param {import('../modules/circuitLab.js').CircuitLab} lab
   */
  primeLab(lab) {
    this._achievedSequence = [];
    this._pulseCount = 0;
    const jk = lab.getSoleJkBlock();
    if (jk) {
      jk._q = 0;
      jk._qbar = 1;
    }
  },

  /**
   * @param {import('../modules/circuitLab.js').CircuitLab} lab
   * @param {string} jkId
   */
  afterJkPulse(lab, jkId) {
    const errPins = ensureInputPins(lab, ["J", "K"]);
    if (errPins) {
      return { ok: false, message: errPins, pulseResult: null };
    }

    const jk = lab.blocks.find((b) => b.id === jkId && b.kind === "jk");
    if (!jk) return { ok: false, message: "JK module missing.", pulseResult: null };

    const ledQ = lab.findLedByLabel("Q");
    if (!ledQ) {
      return { ok: false, message: "Add LED Q and wire JK outQ to it before pulsing.", pulseResult: null };
    }
    const wiredFromOutQ = lab.wires.some(
      (w) => w.toKey === `${ledQ.id}:in` && w.fromKey === `${jk.id}:outQ`
    );
    if (!wiredFromOutQ) {
      return { ok: false, message: "Wire JK outQ to LED Q so the readout reflects the flip-flop.", pulseResult: null };
    }

    lab.pulseJk(jkId);
    evaluateWithPins(lab, lab.getPinValues());

    const target = this._targetSequence;
    this._pulseCount++;
    this._achievedSequence.push(jk._q ? 1 : 0);

    const achieved = this._achievedSequence;
    let matchesSoFar = true;
    for (let i = 0; i < achieved.length; i++) {
      if (achieved[i] !== target[i]) {
        matchesSoFar = false;
        break;
      }
    }

    const isFailed = !matchesSoFar;
    const isComplete = achieved.length >= target.length && matchesSoFar;

    const pulseResult = {
      q: jk._q ? 1 : 0,
      qBar: jk._qbar ? 1 : 0,
      pulseCount: this._pulseCount,
      achieved: [...achieved],
      target: [...target],
      matchesSoFar,
      isComplete,
      isFailed,
    };

    if (isComplete) return { ok: true, message: "Sequence matched — flip-flop drill cleared.", pulseResult };
    if (isFailed) return { ok: false, message: "Sequence diverged — REWIND FUSE and try again.", pulseResult };

    return { ok: false, message: `Pulse ${achieved.length}/4 recorded.`, pulseResult, partial: true };
  },
};
