import { GameState } from "../modules/engine.js";
import { Level4 } from "../levels/level4.js";

/**
 * @param {any} app
 * @param {string} jkId
 */
export function handleJkPulse(app, jkId) {
  if (app.engine.state !== GameState.PLAYING || !app.currentLevel || app.currentLevel.id !== 4) return;
  app.audio.playClock();
  const res = Level4.afterJkPulse(app.circuitLab, jkId);
  if (res.pulseResult) app._updateSequenceTracker(res.pulseResult);
  app._labRedraw();

  if (res.ok && res.pulseResult?.isComplete) {
    app.engine.freezeTimer();
    app.audio.playSuccess();
    app.ui.addChatMessage(res.message, "system");
    const pr = res.pulseResult;
    app._portalAssistantEvent("correct_submission", {
      playerAnswer: pr ? `Q_sequence=${JSON.stringify(pr.achieved)}` : "jk_sequence_complete",
      additionalContext: { campaignLevelComplete: true },
    });
    setTimeout(() => app._levelComplete(), 600);
  } else if (res.pulseResult?.isFailed) {
    app.audio.playFail();
    app.ui.addChatMessage(res.message, "system");
    const pr = res.pulseResult;
    app._portalAssistantEvent("incorrect_submission", {
      playerAnswer: pr ? `Q_sequence=${JSON.stringify(pr.achieved)}` : "",
      correctAnswer: pr ? `target=${JSON.stringify(pr.target)}` : "",
      mistakeCategory: "jk_sequence_diverged",
    });
  } else if (res.message) {
    app.ui.addChatMessage(res.message, "system");
  }
}
