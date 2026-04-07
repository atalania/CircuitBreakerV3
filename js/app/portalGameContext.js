// ============================================================
//  Portal assistant — level slugs / concepts for game events
// ============================================================

/**
 * @param {boolean} endlessMode
 * @param {{ id?: number } | null} currentLevel
 */
export function getPortalLevelId(endlessMode, currentLevel) {
  if (endlessMode) return "endless";
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
