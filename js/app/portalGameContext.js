// ============================================================
//  Portal assistant — level slugs / concepts for game events
// ============================================================
//
// Wiki / stem-assistant-bridge consumers should rely on portalLevelSlug and
// targetConceptEmitted in additionalContext plus top-level levelId / targetConcept.
// Keep slug names aligned with iframe game registration (see .env.example).

/**
 * Stable slug from an endless round title so assistants can distinguish prompts.
 * @param {string} title
 */
export function slugifyEndlessTitle(title) {
  const s = String(title || "").trim();
  if (!s) return "";
  return (
    s
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 56)
      .toLowerCase() || ""
  );
}

/**
 * @param {boolean} endlessMode
 * @param {{ id?: number } | null} currentLevel
 * @param {{ title?: string } | null} [endlessSpec] current endless brief (when in endless mode)
 */
export function getPortalLevelId(endlessMode, currentLevel, endlessSpec = null) {
  if (endlessMode) {
    const slug = slugifyEndlessTitle(endlessSpec?.title || "");
    return slug ? `endless:${slug}` : "endless";
  }
  if (currentLevel) return `level-${currentLevel.id}`;
  return "menu";
}

/**
 * @param {boolean} endlessMode
 * @param {{ id?: number } | null} currentLevel
 */
export function getPortalTargetConcept(endlessMode, currentLevel) {
  if (endlessMode) return "digital_logic_truth_table_lab";
  if (!currentLevel) return "digital_logic";
  switch (currentLevel.id) {
    case 1:
      return "logic_gates_and_or_not";
    case 2:
      return "xor_nand_truth_table";
    case 3:
      return "sr_latch_timing";
    case 4:
      return "jk_flipflop_clock_sequence";
    case 5:
      return "boolean_algebra_minterms";
    default:
      return "digital_logic";
  }
}

/**
 * @param {number} startedAt epoch ms
 */
export function getPortalTimeSpentSeconds(startedAt) {
  if (!startedAt) return 0;
  return Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
}
