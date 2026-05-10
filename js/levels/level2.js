// ============================================================
//  LEVEL 2 — Truth table: Q = (A ⊕ B) NAND C  (circuit lab)
// ============================================================

import { ensureInputPins, evaluateWithPins, ledIdForLabel } from "./labLevelUtils.js";

export const Level2 = {
  id: 2,
  title: "TRUTH TABLE DECODE",
  subtitle: "XOR • NAND",
  preLevelBriefing: {
    title: "CONCEPTS — XOR & NAND",
    bodyHtml: `
      <div class="tutorial-copy">
        <p><strong>XOR</strong> (“exclusive OR”) — output is <strong>1</strong> when inputs are <strong>different</strong> (one 0 and one 1). Same inputs → 0.</p>
        <p><strong>NAND</strong> — “NOT AND”: output is 0 <strong>only</strong> when <strong>both</strong> inputs are 1; otherwise 1. You can read it as NOT( (input1) AND (input2) ).</p>
        <p>This level wants <strong>Q = (A XOR B) NAND C</strong>. You build that with gates, then use <strong>DISARM</strong> on each A,B,C row where Q should be 1 until the table is complete.</p>
      </div>
    `,
  },
  timeLimit: 200,
  objective:
    "Build a circuit with pins A, B, C and LED Q so that Q = (A XOR B) NAND C. Tap pins to try combos: each time Q is 1, DISARM to mark that row. Mark all six winning rows before the fuse expires.",
  tutorContext: `Level 2 lab: Build combinational circuit where Q = NAND(XOR(A,B), C). Student finds all input minterms where Q=1 (six rows) via DISARM submissions, like the old truth-table tracker.`,

  _foundCombos: /** @type {Set<string>} */ (new Set()),
  _requiredCombos: new Set(["000", "001", "010", "100", "110", "111"]),

  setupLab() {
    this._foundCombos = new Set();
  },

  resetProgress() {
    this._foundCombos = new Set();
  },

  expectedQ(a, b, c) {
    const p = a ^ b;
    return p & c ? 0 : 1;
  },

  /**
   * @param {import('../modules/circuitLab.js').CircuitLab} lab
   */
  checkLab(lab) {
    const errPins = ensureInputPins(lab, ["A", "B", "C"]);
    if (errPins) return { ok: false, message: errPins, progress: null };

    const led = lab.findLedByLabel("Q");
    if (!led) return { ok: false, message: "Add LED Q and wire it to your circuit output.", progress: null };

    const pins = lab.getPinValues();
    const A = pins.A ?? 0;
    const B = pins.B ?? 0;
    const C = pins.C ?? 0;
    const combo = `${A}${B}${C}`;

    const r = evaluateWithPins(lab, { A, B, C });
    const q = r.outputs[led.id] ?? 0;
    const want = this.expectedQ(A, B, C);

    if (want !== q) {
      return {
        ok: false,
        message: `At ${combo}, this circuit outputs Q=${q} but the spec needs Q=${want}.`,
        progress: this._progressSnapshot(),
        combo,
        q,
        truthFail: true,
      };
    }

    if (q !== 1) {
      return {
        ok: false,
        message: `Q is 0 for ${combo}. DISARM only rows where Q should be 1.`,
        progress: this._progressSnapshot(),
        combo,
        q,
        truthFail: false,
      };
    }

    this._foundCombos.add(combo);
    const found = this._foundCombos.size;
    const total = this._requiredCombos.size;
    if (found >= total) {
      const mismatch = this._fullTableMismatch(lab, led.id);
      if (mismatch) {
        this._foundCombos.delete(combo);
        return {
          ok: false,
          message: `All winning rows logged, but at A=${mismatch.a} B=${mismatch.b} C=${mismatch.c} the circuit gives Q=${mismatch.got} instead of Q=${mismatch.want}. Build a real circuit, not a shortcut.`,
          progress: this._progressSnapshot(),
          combo,
          q,
          truthFail: true,
        };
      }
      return { ok: true, message: "All valid rows found — truth table cleared.", progress: this._progressSnapshot(), combo, q };
    }
    return {
      ok: false,
      message: `Row ${combo} logged (${found}/${total}). Keep hunting 1-rows.`,
      progress: this._progressSnapshot(),
      combo,
      q,
      partial: true,
    };
  },

  /**
   * Sweep the 8 ABC combos and return the first row whose live circuit output
   * disagrees with expectedQ, or null if the truth table matches.
   * @param {import('../modules/circuitLab.js').CircuitLab} lab
   * @param {string} ledId
   */
  _fullTableMismatch(lab, ledId) {
    for (let a = 0; a <= 1; a++) {
      for (let b = 0; b <= 1; b++) {
        for (let c = 0; c <= 1; c++) {
          const r = evaluateWithPins(lab, { A: a, B: b, C: c });
          const got = r.outputs[ledId] ?? 0;
          const want = this.expectedQ(a, b, c);
          if (got !== want) return { a, b, c, got, want };
        }
      }
    }
    return null;
  },

  _progressSnapshot() {
    return {
      found: this._foundCombos.size,
      total: this._requiredCombos.size,
      foundSet: new Set(this._foundCombos),
      isComplete: this._foundCombos.size === this._requiredCombos.size,
    };
  },

  getProgress() {
    return this._progressSnapshot();
  },
};
