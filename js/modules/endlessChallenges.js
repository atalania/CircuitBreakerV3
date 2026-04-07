// ============================================================
//  Endless-mode fallbacks when AI JSON is unavailable
// ============================================================

function tableFromFn(fn) {
  /** @type {Record<string, { F: number }>} */
  const table = {};
  for (let a = 0; a <= 1; a++) {
    for (let b = 0; b <= 1; b++) {
      for (let c = 0; c <= 1; c++) {
        const key = `${a}${b}${c}`;
        table[key] = { F: fn(a, b, c) ? 1 : 0 };
      }
    }
  }
  return table;
}

const POOL = [
  {
    title: "MAJORITY DETECTOR",
    objective: "Build pins A,B,C and LED F so F=1 when at least two inputs are 1 (majority). DISARM verifies all eight rows.",
    table: tableFromFn((a, b, c) => a + b + c >= 2),
  },
  {
    title: "MUX SELECT",
    objective: "Let A,B be data and C be select: F should equal B when C=1, else A. Wire it on the canvas and DISARM.",
    table: tableFromFn((a, b, c) => (c ? b : a)),
  },
  {
    title: "ODD PARITY",
    objective: "Make F the XOR of A, B, and C (odd parity). Match every truth-table row, then DISARM.",
    table: tableFromFn((a, b, c) => (a ^ b ^ c) & 1),
  },
];

export function randomFallbackChallenge() {
  return { ...POOL[Math.floor(Math.random() * POOL.length)] };
}

/**
 * @param {Record<string, { F: number }>} table
 * @returns {boolean}
 */
export function validateTruthTable(table) {
  if (!table || typeof table !== "object") return false;
  for (let a = 0; a <= 1; a++) {
    for (let b = 0; b <= 1; b++) {
      for (let c = 0; c <= 1; c++) {
        const key = `${a}${b}${c}`;
        const row = table[key];
        if (!row || (row.F !== 0 && row.F !== 1)) return false;
      }
    }
  }
  return true;
}
