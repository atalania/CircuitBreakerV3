import { GameState } from "../modules/engine.js";
import { normalizeTruthTableForObjective, validateTruthTable } from "../modules/endlessChallenges.js";
import { evaluateWithPins, ensureInputPins, ledIdForLabel } from "../levels/labLevelUtils.js";

/**
 * @param {any} app
 */
export function submitEndlessRound(app) {
  if (!app.endlessSpec) return;
  const table = normalizeTruthTableForObjective(app.endlessSpec.objective, app.endlessSpec.table);
  if (!validateTruthTable(table)) {
    app.audio.playFail();
    app.ui.addChatMessage("Brief objective table is incomplete — wait for briefing or fetch a new endless charge.", "system");
    return;
  }
  const err = ensureInputPins(app.circuitLab, ["A", "B", "C"]);
  if (err) {
    app.audio.playFail();
    app.ui.addChatMessage(err, "system");
    return;
  }
  const idF = ledIdForLabel(app.circuitLab, "F");
  if (!idF) {
    app.audio.playFail();
    app.ui.addChatMessage("Add LED F and wire it to your Boolean output.", "system");
    return;
  }

  for (let a = 0; a <= 1; a++) {
    for (let b = 0; b <= 1; b++) {
      for (let c = 0; c <= 1; c++) {
        const key = `${a}${b}${c}`;
        const want = table[key]?.F;
        const r = evaluateWithPins(app.circuitLab, { A: a, B: b, C: c });
        const got = r.outputs[idF];
        if (got !== want) {
          app.audio.playFail();
          app.ui.addChatMessage(`Mismatch at ${key}: need F=${want}, circuit gives F=${got}.`, "system");
          app._portalAssistantEvent("incorrect_submission", {
            playerAnswer: `F=${got} @ ABC=${key}`,
            correctAnswer: `F=${want} @ ABC=${key}`,
            mistakeCategory: "truth_table_mismatch",
          });
          return;
        }
      }
    }
  }

  app.audio.playSuccess();
  app.ui.flashCircuit();
  app.ui.addChatMessage("Truth table matches the AI brief — excellent work.", "system");
  app._portalAssistantEvent("correct_submission", {
    playerAnswer: "endless_truth_table_match",
    additionalContext: { title: app.endlessSpec?.title },
  });
  app._portalAssistantEvent("level_complete");
  setTimeout(() => showEndlessRoundComplete(app), 700);
}

/**
 * @param {any} app
 */
export function showEndlessRoundComplete(app) {
  if (app.engine.state !== GameState.PLAYING) return;
  app.engine.score += 150;
  app.ui.updateScore(app.engine.score);
  app._syncPortalHighScore?.(app.engine.score, {
    mode: "endless",
    metric: "points",
    scoreSource: "engine.score",
  });
  app.ui.showModal(
    "ENDLESS — ROUND CLEARED",
    "<div class='modal-flavor'>Objective satisfied. Grab another AI brief or return to menu.</div>",
    "NEXT AI CHARGE",
    () => {
      app.ui.hideModal();
      app._startEndless();
    },
    "BRIEFING",
    () => {
      app.ui.hideModal();
      app.endlessMode = false;
      app.engine.resetGame();
      app.ui.showMenu();
    }
  );
}
