/**
 * Campaign lab DISARM / step check (all levels except endless and JK pulse-only L4).
 * Mutates app flags and drives audio/UI/portal; may schedule level complete.
 *
 * @param {any} app
 * @param {any} res from level.checkLab(lab)
 */
export function processCampaignLabSubmit(app, res) {
  const level = app.currentLevel;
  if (!level || level.id === 4) return;

  if (level.id === 3) {
    if (res.srInvalid && !res.ok) {
      if (!app._srInvalidActive) {
        app._srInvalidActive = true;
        app.ui.addChatMessage(res.message || "Invalid SR inputs.", "system");
        app._portalAssistantEvent("incorrect_submission", {
          playerAnswer: res.message || "S=1 R=1",
          mistakeCategory: "invalid_sr_inputs",
        });
      }
      return;
    }
    app._srInvalidActive = false;
  }

  if (level.id === 2 || level.id === 5) {
    const combo =
      res.combo ??
      `${app.circuitLab.getPinValues().A ?? 0}${app.circuitLab.getPinValues().B ?? 0}${app.circuitLab.getPinValues().C ?? 0}`;
    const outputKey = level.id === 2 ? (res.q ?? 0) : (res.f ?? 0);
    const outLabel = level.id === 2 ? "Q" : "F";
    const prog = res.progress || level.getProgress?.();
    const a = parseInt(combo[0] ?? "0", 10) || 0;
    const b = parseInt(combo[1] ?? "0", 10) || 0;
    const c = parseInt(combo[2] ?? "0", 10) || 0;
    const expectedOut = level.id === 2 ? level.expectedQ(a, b, c) : level.expectedF(a, b, c);
    app._updateTruthTableTracker(combo, outputKey, prog);
    if (res.truthFail) {
      app.audio.playFail();
      app.ui.addChatMessage(res.message || "Try again.", "system");
      app._portalAssistantEvent("incorrect_submission", {
        playerAnswer: `${outLabel}=${outputKey} @ ABC=${combo}`,
        correctAnswer: `${outLabel}=${expectedOut} @ ABC=${combo}`,
        mistakeCategory: "circuit_output_mismatch",
      });
    } else if (res.partial) {
      app.audio.playSwitch();
      app.ui.flashCircuit();
      app.ui.addChatMessage(res.message || "", "system");
      app._portalAssistantEvent("correct_submission", {
        playerAnswer: `${outLabel}=${outputKey} @ ABC=${combo}`,
        additionalContext: {
          partialTruthTableRow: true,
          found: prog?.found,
          total: prog?.total,
        },
      });
    } else if (res.ok) {
      app.audio.playSuccess();
      app.ui.addChatMessage(res.message || "Cleared!", "system");
      app._portalAssistantEvent("correct_submission", {
        playerAnswer: `${outLabel}=${outputKey} @ ABC=${combo}`,
        additionalContext: { campaignLevelComplete: true },
      });
      setTimeout(() => app._levelComplete(), 700);
    } else {
      app.audio.playFail();
      app.ui.addChatMessage(res.message || "Not yet.", "system");
      app._portalAssistantEvent("incorrect_submission", {
        playerAnswer: `${outLabel}=${outputKey} @ ABC=${combo}`,
        correctAnswer: `Need ${outLabel}=1 on a winning row`,
        mistakeCategory: "not_winning_row",
      });
    }
    return;
  }

  if (level.id === 3) {
    if (res.ok) {
      app.audio.playSuccess();
      app.ui.flashCircuit();
      app.ui.addChatMessage(res.message || "", "system");
      app._portalAssistantEvent("correct_submission", {
        playerAnswer: "SR_sequence_complete",
        additionalContext: { campaignLevelComplete: true },
      });
      app._updateSrLatchTracker(4);
      setTimeout(() => app._levelComplete(), 700);
    } else {
      if (res.message) app.ui.addChatMessage(res.message, "system");
      if (typeof res.step === "number") app._updateSrLatchTracker(res.step);
      if (res.advanced) {
        app.audio.playSuccess();
        app.ui.flashCircuit();
        app._portalAssistantEvent("correct_submission", {
          playerAnswer: `SR_step_verified`,
          additionalContext: { srStep: res.step, partial: true },
        });
      } else if (!res.srInvalid) {
        app.audio.playFail();
        app._portalAssistantEvent("incorrect_submission", {
          playerAnswer: res.message || "SR_step_incomplete",
          mistakeCategory: "sr_sequence_mismatch",
        });
      }
    }
    return;
  }

  if (level.id === 1) {
    if (res.ok) {
      app.audio.playSuccess();
      app.ui.flashCircuit();
      app.ui.addChatMessage(res.message || "", "system");
      app._portalAssistantEvent("correct_submission", {
        playerAnswer: "DISARM_pass_all_8_rows",
        additionalContext: { campaignLevelComplete: true },
      });
      setTimeout(() => app._levelComplete(), 700);
    } else {
      app.audio.playFail();
      app.ui.addChatMessage(res.message || "Not yet.", "system");
      app._portalAssistantEvent("incorrect_submission", {
        playerAnswer: res.message || "DISARM_fail",
        mistakeCategory: "truth_table_mismatch",
      });
      app._requestTutorFeedback({}, "submitted DISARM");
    }
  }
}
