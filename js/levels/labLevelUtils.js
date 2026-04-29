// ============================================================
//  Shared helpers for circuit-lab campaign checks
// ============================================================

/**
 * @param {import('../modules/circuitLab.js').CircuitLab} lab
 * @param {string[]} letters
 * @returns {string | null} error message
 */
export function ensureInputPins(lab, letters) {
  for (const L of letters) {
    const n = lab.blocks.filter((b) => b.kind === "source" && b.pin === L).length;
    if (n < 1) return `Add an input pin labeled ${L} from the palette.`;
    if (n > 1) return `Use only one input pin labeled ${L}.`;
  }
  return null;
}

/**
 * Apply pin values to lab sources, evaluate, and restore the original pin
 * values so an exhaustive truth-table sweep does not leave the canvas stuck
 * on the last tested combo.
 * @param {import('../modules/circuitLab.js').CircuitLab} lab
 * @param {Record<string, number>} pins e.g. { A:1, B:0, C:1 }
 */
export function evaluateWithPins(lab, pins) {
  /** @type {Record<string, number>} */
  const previous = {};
  for (const b of lab.blocks) {
    if (b.kind === "source" && b.pin && Object.prototype.hasOwnProperty.call(pins, b.pin)) {
      previous[b.id] = b.value;
      b.value = pins[b.pin] ? 1 : 0;
    }
  }
  try {
    return lab.evaluate({});
  } finally {
    for (const b of lab.blocks) {
      if (Object.prototype.hasOwnProperty.call(previous, b.id)) {
        b.value = previous[b.id];
      }
    }
  }
}

/**
 * @param {import('../modules/circuitLab.js').CircuitLab} lab
 * @param {string} label
 * @returns {string | null} LED block id
 */
export function ledIdForLabel(lab, label) {
  const led = lab.findLedByLabel(label);
  return led ? led.id : null;
}
