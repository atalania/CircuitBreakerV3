// ============================================================
//  LEVEL 1 — Build: X = AB, Y = ¬C, Z = B ∨ C (circuit lab + coach)
// ============================================================

import { ensureInputPins, evaluateWithPins, ledIdForLabel } from "./labLevelUtils.js";

/**
 * Live checklist for the Level 1 coach panel (only used by app UI).
 * @param {import('../modules/circuitLab.js').CircuitLab} lab
 */
export function getLevel1CoachState(lab) {
  const pinOk = ["A", "B", "C"].every((L) => lab.blocks.some((b) => b.kind === "source" && b.pin === L));
  const x = lab.findLedByLabel("X");
  const y = lab.findLedByLabel("Y");
  const z = lab.findLedByLabel("Z");
  const ledsOk = !!(x && y && z);

  const has = { and: false, or: false, not: false };
  for (const b of lab.blocks) {
    if (b.kind === "and") has.and = true;
    if (b.kind === "or") has.or = true;
    if (b.kind === "not") has.not = true;
  }
  const gatesOk = has.and && has.or && has.not;

  const wiredIn = (led) => led && lab.wires.some((w) => w.toKey === `${led.id}:in`);
  const xW = wiredIn(x);
  const yW = wiredIn(y);
  const zW = wiredIn(z);
  const ledsFed = xW && yW && zW;

  return { pinOk, ledsOk, has, gatesOk, xW, yW, zW, ledsFed };
}

export const Level1 = {
  id: 1,
  title: "GATE FUNDAMENTALS",
  subtitle: "AND • OR • NOT",
  clearCanvasHint:
    "Canvas reset: LEDs X/Y/Z restored. Drag pins **A**, **B**, **C** from INPUTS onto the canvas if you wiped them.",
  timeLimit: 240,
  objective:
    "Drag pins A, B, and C onto the canvas (palette left). Outputs X, Y, Z start on the right. Add AND, OR, NOT, wire cyan → orange, then DISARM. Goal: X = A·B, Y = NOT C, Z = B OR C.",
  tutorContext: `Level 1 (guided): Canvas starts with LEDs X,Y,Z only. Student drags pins A,B,C from the toolbar, adds AND/OR/NOT gates and wires.
Must satisfy for all 8 input rows:
X = A AND B, Y = NOT C, Z = B OR C.
Verification is exhaustive truth-table check on DISARM.`,

  /**
   * Inputs left, outputs right — player only adds gates and wires.
   * @param {import('../modules/circuitLab.js').CircuitLab} lab
   */
  setupLab(lab) {
    lab.placeAt("led:X", 780, 140);
    lab.placeAt("led:Y", 780, 260);
    lab.placeAt("led:Z", 780, 380);
  },

  resetProgress() {},

  /**
   * @param {import('../modules/circuitLab.js').CircuitLab} lab
   */
  checkLab(lab) {
    const errPins = ensureInputPins(lab, ["A", "B", "C"]);
    if (errPins) {
      return {
        ok: false,
        message: `${errPins} If you cleared the board, use the palette or restart from the menu.`,
      };
    }

    const idX = ledIdForLabel(lab, "X");
    const idY = ledIdForLabel(lab, "Y");
    const idZ = ledIdForLabel(lab, "Z");
    if (!idX || !idY || !idZ) {
      return {
        ok: false,
        message: "Place labeled pins **A**, **B**, and **C** from the INPUTS row, plus LED **X**, **Y**, **Z**. (LEDs load at level start.)",
      };
    }

    for (let a = 0; a <= 1; a++) {
      for (let b = 0; b <= 1; b++) {
        for (let c = 0; c <= 1; c++) {
          const r = evaluateWithPins(lab, { A: a, B: b, C: c });
          const wantX = a & b;
          const wantY = c ? 0 : 1;
          const wantZ = b | c;
          if (r.outputs[idX] !== wantX || r.outputs[idY] !== wantY || r.outputs[idZ] !== wantZ) {
            return {
              ok: false,
              message: `Not quite — at A=${a} B=${b} C=${c} the spec needs X=${wantX} Y=${wantY} Z=${wantZ}. Toggle pins to see which LED is wrong.`,
            };
          }
        }
      }
    }

    return { ok: true, message: "Truth table matches — gate drill cleared." };
  },
};
