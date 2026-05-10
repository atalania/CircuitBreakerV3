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
  const hasPinA = !!pinA;
  const hasPinB = !!pinB;
  const pinsOk = hasPinA && hasPinB;

  const andGates = lab.blocks.filter((b) => b.kind === "and");
  const andGate = andGates.length >= 1 ? andGates[0] : null;
  const andOk = !!andGate;

  const xLed = lab.findLedByLabel("X");
  const hasLedX = !!xLed;

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

  const xFed = !!(
    andGate &&
    xLed &&
    lab.wires.some((w) => w.fromKey === `${andGate.id}:out` && w.toKey === `${xLed.id}:in`)
  );

  return {
    pinA,
    pinB,
    hasPinA,
    hasPinB,
    pinsOk,
    andGate,
    andOk,
    hasLedX,
    feedsIn0,
    feedsIn1,
    bothAndInputs,
    xFed,
  };
}

/**
 * Monotonic tutorial stage 0–7 for guided intro (pins in any order, then AND, LED X, then wires).
 * Used for sequential system messages only.
 * @param {import('../modules/circuitLab.js').CircuitLab} lab
 */
export function getGuidedCoachMilestone(lab) {
  const s = getLevel1GuidedCoachState(lab);
  let m = 0;
  if (s.hasPinA || s.hasPinB) m = 1;
  if (s.hasPinA && s.hasPinB) m = 2;
  if (s.hasPinA && s.hasPinB && s.andOk) m = 3;
  if (s.hasPinA && s.hasPinB && s.andOk && s.hasLedX) m = 4;
  if (m === 4) {
    if (s.xFed) return 7;
    if (s.bothAndInputs) return 6;
    if (s.feedsIn0 || s.feedsIn1) return 5;
  }
  return m;
}

export const Level1Guided = {
  id: 1,
  /** Set on `currentLevel` only for the new-player guided slice (not menu Gate Basics). */
  isGuidedIntro: true,
  title: "GUIDED: FIRST AND GATE",
  subtitle: "PLACE & WIRE",
  preLevelBriefing: {
    title: "CONCEPTS — YOUR FIRST AND",
    bodyHtml: `
      <div class="tutorial-copy">
        <p><strong>AND</strong> — output is <strong>1</strong> only when <strong>both</strong> inputs are 1. If either input is 0, the output is 0.</p>
        <p><strong>Pins A and B</strong> are inputs you place from the bar; <strong>tap</strong> their orange rings to flip 0/1.</p>
        <p><strong>Wiring</strong> — drag from a <strong>cyan</strong> output dot to an <strong>orange</strong> input dot. Here you will connect A and B into the AND, and the AND into LED <strong>X</strong>.</p>
        <p><strong>DISARM</strong> checks all four A,B combinations so X really equals A·B.</p>
      </div>
    `,
  },
  timeLimit: 300,
  objective:
    "**Training charge** — drag **A** and **B** from **INPUTS**, **AND** from **GATES**, and **LED X** from **OUTPUT LEDs** onto the canvas. Then wire **cyan → orange**: **A** and **B** into the **AND**, **AND** out into **X**. **Tap** the orange pin rings to flip **0/1**. **DISARM** checks all four **A,B** combos.",
  tutorContext: `Brand-new player FIRST puzzle. Canvas starts empty: they drag pin A, pin B, one AND gate, and LED X from the lab toolbar onto the canvas, then wire cyan outputs to orange inputs until X = A AND B. Checklist panel shows mini wire/place animations. DISARM is exhaustive on A,B only (no C). After success they unlock full Gate Basics from the menu.`,
  clearCanvasHint:
    "Canvas cleared — drag **A**, **B**, **AND**, and **LED X** from the bar again, then rewire **cyan → orange**.",

  /**
   * @param {import('../modules/circuitLab.js').CircuitLab} lab
   */
  setupLab(_lab) {
    /* Canvas starts empty — player places A, B, AND, LED X from the toolbar. */
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
        message: `${errPins} Drag **A** and **B** from **INPUTS** onto the canvas (or **CLEAR CANVAS** to start over).`,
      };
    }

    const idX = ledIdForLabel(lab, "X");
    if (!idX) {
      return {
        ok: false,
        message: "Add **LED X** from **OUTPUT LEDs** and wire the **AND** output into it.",
      };
    }

    const ands = lab.blocks.filter((b) => b.kind === "and");
    if (ands.length === 0) {
      return {
        ok: false,
        message: "Place an **AND** gate from **GATES** on the canvas.",
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
