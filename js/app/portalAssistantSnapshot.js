// ============================================================
//  Rich context for STEM portal assistants (ASSISTANT_GAME_EVENT)
// ============================================================

import { CircuitLab } from "../modules/circuitLab.js";

const TUTOR_CONTEXT_MAX = 1800;

/**
 * @param {Record<string, { F?: number }> | null | undefined} table
 * @returns {string | null}
 */
export function formatTruthTableCompact(table) {
  if (!table || typeof table !== "object") return null;
  const keys = ["000", "001", "010", "011", "100", "101", "110", "111"];
  const parts = [];
  for (const k of keys) {
    const f = table[k]?.F;
    if (typeof f === "number" && (f === 0 || f === 1)) parts.push(`${k}→${f}`);
  }
  return parts.length ? parts.join(" ") : null;
}

/**
 * One-line description of what “success” means for this screen (for tutor prompts).
 * @param {boolean} endlessMode
 * @param {{ id?: number, title?: string, objective?: string, isGuidedIntro?: boolean } | null} level
 * @param {{ title?: string, objective?: string, table?: Record<string, { F?: number }> } | null} endlessSpec
 */
export function assistantWinConditionSummary(endlessMode, level, endlessSpec) {
  if (endlessMode) {
    return (
      "Endless: build a combinational lab so LED **F** matches the AI brief truth table for every ABC combination " +
      "(inputs A,B,C toggles; exhaustive check on SUBMIT)."
    );
  }
  if (!level) return "Main menu / briefing — no active disarm objective.";
  const id = level.id;
  if (id === 1) {
    return level.isGuidedIntro
      ? "Level 1 guided: empty canvas — drag A,B from INPUTS, AND from GATES, LED X from OUTPUT LEDs, then wire cyan→orange (A,B→AND, AND→X); checklist has motion demos; DISARM when X matches AND for all AB combos (no fuse)."
      : "Level 1: DISARM when LEDs **X,Y,Z** match X=A·B, Y=¬C, Z=B∨C for all 8 rows (exhaustive check).";
  }
  if (id === 2) {
    return "Level 2: find an ABC row where circuit output **Q** matches the hidden target; partial submits mark rows; full clear when the winning row is found.";
  }
  if (id === 3) {
    return "Level 3: SR latch — advance through timed **S/R** steps (illegal S=R=1 rejected); complete the sequence to clear.";
  }
  if (id === 4) {
    return "Level 4: wire **JK** and inputs; **pulse the clock** so **Q** follows the displayed target bit sequence (not DISARM).";
  }
  if (id === 5) {
    return "Level 5: minterm hunt — find ABC where **F** matches the Boolean target; partial progress on matching rows.";
  }
  return `Campaign level ${id}: see objective text.`;
}

/**
 * @param {import("../modules/circuitLab.js").CircuitLab} lab
 * @param {{ outputs?: Record<string, number> }} evalResult
 */
function ledOutputsByLabel(lab, evalResult) {
  const out = evalResult?.outputs;
  if (!out || typeof out !== "object") return {};
  /** @type {Record<string, number>} */
  const byLabel = {};
  for (const b of lab.blocks) {
    if (b.kind === "led" && b.label && Object.prototype.hasOwnProperty.call(out, b.id)) {
      byLabel[String(b.label)] = out[b.id] ? 1 : 0;
    }
  }
  return byLabel;
}

/**
 * @param {{
 *   endlessMode: boolean,
 *   endlessSpec: { title?: string, objective?: string, table?: Record<string, { F?: number }> } | null,
 *   currentLevel: { id?: number, title?: string, objective?: string, tutorContext?: string, timeLimit?: number, isGuidedIntro?: boolean } | null,
 *   circuitLab: import("../modules/circuitLab.js").CircuitLab | null,
 *   engine: { state?: string, timeRemaining?: number, hintsUsed?: number },
 * }} ctx
 * @returns {Record<string, unknown>}
 */
export function buildAssistantLevelSnapshot(ctx) {
  const { endlessMode, endlessSpec, currentLevel, circuitLab, engine } = ctx;

  /** @type {Record<string, unknown>} */
  const snap = {
    assistantSchemaVersion: 1,
    gameState: engine?.state ?? null,
    hintsUsedSoFar: typeof engine?.hintsUsed === "number" ? engine.hintsUsed : null,
    timerSecondsRemaining:
      typeof engine?.timeRemaining === "number" ? Math.max(0, Math.round(engine.timeRemaining * 10) / 10) : null,
    winConditionSummary: assistantWinConditionSummary(endlessMode, currentLevel, endlessSpec),
  };

  if (currentLevel && !endlessMode) {
    snap.levelTimeLimitSeconds =
      typeof currentLevel.timeLimit === "number" ? currentLevel.timeLimit : null;
    if (typeof currentLevel.objective === "string" && currentLevel.objective.trim()) {
      snap.levelObjective = currentLevel.objective.trim();
    }
    if (currentLevel.isGuidedIntro === true) {
      snap.guidedIntroRun = true;
    }
    if (typeof currentLevel.tutorContext === "string" && currentLevel.tutorContext.trim()) {
      const t = currentLevel.tutorContext.trim();
      snap.tutorContext =
        t.length > TUTOR_CONTEXT_MAX ? `${t.slice(0, TUTOR_CONTEXT_MAX)}…[truncated]` : t;
    }
  }

  if (endlessMode && endlessSpec && typeof endlessSpec === "object") {
    if (typeof endlessSpec.title === "string" && endlessSpec.title.trim()) {
      snap.endlessRoundTitle = endlessSpec.title.trim();
    }
    if (typeof endlessSpec.objective === "string" && endlessSpec.objective.trim()) {
      snap.endlessObjective = endlessSpec.objective.trim();
    }
    const compact = formatTruthTableCompact(endlessSpec.table);
    if (compact) snap.endlessTruthTableCompact = compact;
  }

  if (circuitLab && typeof circuitLab.snapshotForAssistant === "function") {
    snap.labSnapshot = circuitLab.snapshotForAssistant();
    try {
      const vis = circuitLab.evaluate(CircuitLab.emptyInputStates());
      snap.ledOutputsAtCurrentPins = ledOutputsByLabel(circuitLab, vis);
      if (vis && typeof vis.srInvalid === "boolean") snap.srLatchInputsInvalid = vis.srInvalid;
    } catch {
      snap.ledOutputsAtCurrentPins = {};
    }
  }

  return snap;
}
