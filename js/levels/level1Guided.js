// ============================================================
//  LEVEL 1 GUIDED INTRO — Easier than Gate Basics: wire X = A∧B only
// ============================================================

import { ensureInputPins, evaluateWithPins, ledIdForLabel } from "./labLevelUtils.js";

/**
 * @param {import('../modules/circuitLab.js').CircuitLab} lab
 */
export function getLevel1GuidedCoachState(lab) {
  const pinA = lab.blocks.find((b) => b.kind === "source" && b.pin === "A");
  const pinB = lab.blocks.find((b) => b.kind === "source" && b.pin === "B");
  const pinsOk = !!(pinA && pinB);

  const andGates = lab.blocks.filter((b) => b.kind === "and");
  const andGate = andGates.length >= 1 ? andGates[0] : null;
  const andOk = !!andGate;

  const feedsIn0 =
    !!(
      andGate &&
      pinA &&
      pinB &&
      lab.wires.some(
        (w) =>
          w.toKey === `${andGate.id}:in0` && (w.fromKey === `${pinA.id}:out` || w.fromKey === `${pinB.id}:out`)
      )
    );
  const feedsIn1 =
    !!(
      andGate &&
      pinA &&
      pinB &&
      lab.wires.some(
        (w) =>
          w.toKey === `${andGate.id}:in1` && (w.fromKey === `${pinA.id}:out` || w.fromKey === `${pinB.id}:out`)
      )
    );
  const bothAndInputs = feedsIn0 && feedsIn1;

  const xLed = lab.findLedByLabel("X");
  const xFed = !!(
    andGate &&
    xLed &&
    lab.wires.some((w) => w.fromKey === `${andGate.id}:out` && w.toKey === `${xLed.id}:in`)
  );

  return { pinsOk, andOk, bothAndInputs, xFed };
}

export const Level1Guided = {
  id: 1,
  /** Set on the live `currentLevel` when this is the new-player guided slice (not menu Gate Basics). */
  isGuidedIntro: true,
  title: "GUIDED: FIRST AND GATE",
  subtitle: "WIRE ONLY",
  timeLimit: 240,
  objective:
    "**Training charge** — we placed **A**, **B**, an **AND** gate, and LED **X** for you. Drag three wires: **A** and **B** into the AND’s two inputs, then AND’s output into **X**. Tap orange pins to flip 0/1. When ready, **DISARM** (checks all four A,B combos).",
  tutorContext: `Brand-new player FIRST puzzle only. Pins A,B + one AND gate + LED X are already on the canvas. They only drag wires (cyan output → orange input). Goal: X = A AND B. No NOT, no OR, no C pin, no dragging parts from toolbar unless they erased something. Exhaustive DISARM checks 4 rows (A,B only). Encourage tapping pins to see the LED, one wire at a time. After this they'll play full Gate Basics from the menu.`,
  clearCanvasHint:
    "Canvas reset: training layout restored (**A**, **B**, **AND**, LED **X**). Rewire cyan → orange if you cleared the wires.",

  /**
   * @param {import('../modules/circuitLab.js').CircuitLab} lab
   */
  setupLab(lab) {
    lab.placeAt("in:A", 120, 200);
    lab.placeAt("in:B", 120, 340);
    lab.placeAt("and", 430, 270);
    lab.placeAt("led:X", 780, 270);
  },

  resetProgress() {},

  /**
   * @param {import('../modules/circuitLab.js').CircuitLab} lab
   */
  checkLab(lab) {
    const errPins = ensureInputPins(lab, ["A", "B"]);
    if (errPins) {
      return {
        ok: false,
        message: `${errPins} Use **CLEAR CANVAS** if the board is a mess — it restores the training layout.`,
      };
    }

    const idX = ledIdForLabel(lab, "X");
    if (!idX) {
      return {
        ok: false,
        message: "LED **X** should be on the canvas. Hit **CLEAR CANVAS** to restore the training layout.",
      };
    }

    const ands = lab.blocks.filter((b) => b.kind === "and");
    if (ands.length === 0) {
      return {
        ok: false,
        message: "You need an **AND** gate. **CLEAR CANVAS** brings back the one we placed for you.",
      };
    }

    for (let a = 0; a <= 1; a++) {
      for (let b = 0; b <= 1; b++) {
        const r = evaluateWithPins(lab, { A: a, B: b });
        const wantX = a & b;
        if (r.outputs[idX] !== wantX) {
          return {
            ok: false,
            message: `Almost — when **A=${a}** and **B=${b}**, LED **X** should be **${wantX}** (AND means both must be 1 for a 1). Toggle the pins and follow the cyan → orange wiring.`,
          };
        }
      }
    }

    return { ok: true, message: "Nice — AND gate wired. Full **Gate Basics** is next from the menu when you want more gates." };
  },
};
