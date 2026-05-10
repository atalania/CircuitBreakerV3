// ============================================================
//  LEVEL 3 — SR latch checklist (circuit lab)
// ============================================================

import { ensureInputPins } from "./labLevelUtils.js";

export const Level3 = {
  id: 3,
  title: "SR LATCH LOCKDOWN",
  subtitle: "SET • RESET • MEMORY",
  preLevelBriefing: {
    title: "CONCEPTS — SR LATCH",
    bodyHtml: `
      <div class="tutorial-copy">
        <p>An <strong>SR latch</strong> is a tiny <strong>memory</strong>: it holds a stored bit <strong>Q</strong> (and its complement on <strong>Qn</strong>) even after you release the inputs.</p>
        <p><strong>S (Set)</strong> — tends to drive Q toward <strong>1</strong>. <strong>R (Reset)</strong> — tends to drive Q toward <strong>0</strong>.</p>
        <p><strong>S=0, R=0</strong> — “hold”: the latch keeps whatever Q was. <strong>S=1, R=0</strong> sets; <strong>S=0, R=1</strong> resets.</p>
        <p><strong>Never hold S and R both at 1</strong> — that is an invalid/forbidden input pattern for this simplified latch.</p>
      </div>
    `,
  },
  timeLimit: 200,
  objective:
    "Place SR LATCH plus input pins S and R. Wire outQ to LED Q and outQbar to LED Qn. Toggle pins and DISARM after each checklist line (never hold S=R=1).",
  tutorContext: `Level 3 lab: SR latch macro block behaves like simplified NOR SR (same as prior level). Four DISARM steps verify SET, HOLD, RESET, SET again using pin values and stored Q.`,

  _step: 0,

  stepLabels: [
    "1 · SET — S=1 R=0, Q must be 1",
    "2 · HOLD — S=0 R=0, Q must stay 1",
    "3 · RESET — S=0 R=1, Q must be 0",
    "4 · SET again — S=1 R=0, Q must be 1",
  ],

  setupLab() {
    this._step = 0;
  },

  resetProgress() {
    this._step = 0;
  },

  /**
   * @param {import('../modules/circuitLab.js').CircuitLab} lab
   */
  checkLab(lab) {
    const errPins = ensureInputPins(lab, ["S", "R"]);
    if (errPins) return { ok: false, message: errPins };

    const sr = lab.getSoleSrBlock();
    if (!sr) return { ok: false, message: "Place exactly one SR LATCH module." };

    if (lab.blocks.filter((b) => b.kind === "sr").length !== 1) {
      return { ok: false, message: "Use a single SR LATCH (remove extras)." };
    }

    const qLed = lab.findLedByLabel("Q");
    const qbLed = lab.findLedByLabel("QN");
    if (!qLed || !qbLed) {
      return { ok: false, message: "Add **LED Q** and **LED Qn** chips; wire SR **outQ** / **outQbar** to them." };
    }

    const r = lab.evaluate({});
    const qLedOn = !!r.outputs[qLed.id];
    const qbLedOn = !!r.outputs[qbLed.id];
    const qState = sr._q ? 1 : 0;
    if (qLedOn !== !!qState || qbLedOn === qLedOn) {
      return { ok: false, message: "Wire SR **outQ** → LED Q and **outQbar** → LED Qn so the LEDs track the latch." };
    }

    const pins = lab.getPinValues();
    const S = pins.S ?? 0;
    const R = pins.R ?? 0;
    const Q = sr._q;

    if (S === 1 && R === 1) {
      return {
        ok: false,
        message: "Invalid: S and R both 1. Release one before continuing.",
        srInvalid: true,
      };
    }

    if (this._step >= 4) {
      return { ok: false, message: "Sequence already complete.", done: true };
    }

    if (this._step === 0) {
      if (S === 1 && R === 0 && Q === 1) {
        this._step = 1;
        return {
          ok: false,
          advanced: true,
          message: "SET verified. Next: S=0 R=0 (HOLD) and DISARM.",
          step: 1,
        };
      }
      return { ok: false, message: "Step 1: S=1 R=0 with Q=1, then DISARM." };
    }
    if (this._step === 1) {
      if (S === 0 && R === 0 && Q === 1) {
        this._step = 2;
        return {
          ok: false,
          advanced: true,
          message: "HOLD verified. Next: RESET (S=0 R=1) and DISARM.",
          step: 2,
        };
      }
      return { ok: false, message: "Step 2: S=0 R=0 while Q stays 1, then DISARM." };
    }
    if (this._step === 2) {
      if (S === 0 && R === 1 && Q === 0) {
        this._step = 3;
        return {
          ok: false,
          advanced: true,
          message: "RESET verified. Final SET step: S=1 R=0, DISARM.",
          step: 3,
        };
      }
      return { ok: false, message: "Step 3: S=0 R=1 so Q=0, then DISARM." };
    }
    if (this._step === 3) {
      if (S === 1 && R === 0 && Q === 1) {
        this._step = 4;
        return { ok: true, message: "SR sequence complete — latch drill cleared.", step: 4, done: true };
      }
      return { ok: false, message: "Step 4: S=1 R=0 with Q=1, then DISARM." };
    }

    return { ok: false, message: "" };
  },
};
