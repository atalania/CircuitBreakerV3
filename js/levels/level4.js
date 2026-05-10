// ============================================================
//  LEVEL 4 — JK flip-flop sequence (circuit lab)
// ============================================================

import { ensureInputPins, evaluateWithPins } from "./labLevelUtils.js";

export const Level4 = {
  id: 4,
  title: "JK FLIP-FLOP",
  subtitle: "CLOCK • TOGGLE • STATE",
  preLevelBriefing: {
    title: "CONCEPTS — WHAT IS A JK?",
    bodyHtml: `
      <div class="tutorial-copy">
        <p>A <strong>JK flip-flop</strong> is <strong>clocked memory</strong>: it has data inputs <strong>J</strong> and <strong>K</strong>, and a stored output <strong>Q</strong>. The stored value only updates on a <strong>clock edge</strong> (here: each time you <strong>tap the JK module</strong> to pulse the clock).</p>
        <p><strong>J=0, K=0</strong> — no change (Q stays). <strong>J=1, K=0</strong> — set Q toward 1. <strong>J=0, K=1</strong> — reset Q toward 0.</p>
        <p><strong>J=1, K=1</strong> — <strong>toggle</strong>: Q flips on the clock pulse (unlike a plain SR latch, both inputs high is allowed and means “invert Q”).</p>
        <p>Wire <strong>J</strong>, <strong>K</strong>, and LED <strong>Q</strong> to the block, set pins, then pulse until the required Q sequence matches.</p>
      </div>
    `,
  },
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
