// ============================================================
//  LEVEL 5 — Boolean gauntlet F = AB + A'C + BC (circuit lab)
// ============================================================

import { ensureInputPins, evaluateWithPins, ledIdForLabel } from "./labLevelUtils.js";

export const Level5 = {
  id: 5,
  title: "BOOLEAN GAUNTLET",
  subtitle: "SIMPLIFY • VERIFY • DEFUSE",
  timeLimit: 240,
  objective:
    "Build F = (A·B) + (¬A·C) + (B·C) with pins A,B,C and LED F. Each DISARM when F=1 marks that input row. Capture all four minterms before time runs out.",
  tutorContext: `Level 5 lab: Same Boolean function as before. Student builds with AND/OR/NOT on canvas, marks rows where F=1 via DISARM until four combos found.`,

  _foundCombos: /** @type {Set<string>} */ (new Set()),
  _requiredCombos: new Set(["001", "011", "110", "111"]),

  setupLab() {
    this._foundCombos = new Set();
  },

  resetProgress() {
    this._foundCombos = new Set();
  },

  expectedF(a, b, c) {
    const notA = a ? 0 : 1;
    const ab = a & b;
    const notAc = notA & c;
    const bc = b & c;
    return ab | notAc | bc;
  },

  /**
   * @param {import('../modules/circuitLab.js').CircuitLab} lab
   */
  checkLab(lab) {
    const errPins = ensureInputPins(lab, ["A", "B", "C"]);
    if (errPins) return { ok: false, message: errPins, progress: null };

    const idF = ledIdForLabel(lab, "F");
    if (!idF) return { ok: false, message: "Add LED F for the Boolean output.", progress: null };

    const pins = lab.getPinValues();
    const A = pins.A ?? 0;
    const B = pins.B ?? 0;
    const C = pins.C ?? 0;
    const combo = `${A}${B}${C}`;

    const r = evaluateWithPins(lab, { A, B, C });
    const f = r.outputs[idF] ?? 0;
    const want = this.expectedF(A, B, C);

    if (want !== f) {
      return {
        ok: false,
        message: `At ${combo}, circuit gives F=${f} but algebra needs F=${want}.`,
        progress: this._progressSnapshot(),
        combo,
        truthFail: true,
      };
    }

    if (f !== 1) {
      return {
        ok: false,
        message: `F is 0 for ${combo}. DISARM on rows where F should be 1.`,
        progress: this._progressSnapshot(),
        combo,
        truthFail: false,
      };
    }

    this._foundCombos.add(combo);
    const found = this._foundCombos.size;
    const total = this._requiredCombos.size;
    if (found >= total) {
      const mismatch = this._fullTableMismatch(lab, idF);
      if (mismatch) {
        this._foundCombos.delete(combo);
        return {
          ok: false,
          message: `All minterms logged, but at A=${mismatch.a} B=${mismatch.b} C=${mismatch.c} the circuit gives F=${mismatch.got} instead of F=${mismatch.want}. Build the real Boolean expression.`,
          progress: this._progressSnapshot(),
          combo,
          f,
          truthFail: true,
        };
      }
      return { ok: true, message: "All minterms found — gauntlet cleared.", progress: this._progressSnapshot(), combo, f };
    }
    return {
      ok: false,
      message: `Row ${combo} logged (${found}/${total}).`,
      progress: this._progressSnapshot(),
      combo,
      partial: true,
    };
  },

  /**
   * Sweep the 8 ABC combos and return the first row whose live circuit output
   * disagrees with expectedF, or null if the truth table matches.
   * @param {import('../modules/circuitLab.js').CircuitLab} lab
   * @param {string} ledId
   */
  _fullTableMismatch(lab, ledId) {
    for (let a = 0; a <= 1; a++) {
      for (let b = 0; b <= 1; b++) {
        for (let c = 0; c <= 1; c++) {
          const r = evaluateWithPins(lab, { A: a, B: b, C: c });
          const got = r.outputs[ledId] ?? 0;
          const want = this.expectedF(a, b, c);
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
