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

/**
 * @typedef {Object} EndlessFallbackChallenge
 * @property {string} title
 * @property {string} objective
 * @property {Record<string, { F: number }>} table
 */

/** @type {EndlessFallbackChallenge[]} */
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
  {
    title: "EVEN PARITY",
    objective: "Build F so it lights when an even number of A,B,C are 1 (including zero). Even parity. DISARM checks all eight rows.",
    table: tableFromFn((a, b, c) => 1 - ((a ^ b ^ c) & 1)),
  },
  {
    title: "ALL HIGH",
    objective: "Light F only when A AND B AND C are all 1. Classic three-input AND.",
    table: tableFromFn((a, b, c) => a && b && c),
  },
  {
    title: "ANY HIGH",
    objective: "Light F whenever at least one of A, B, or C is 1. Three-input OR.",
    table: tableFromFn((a, b, c) => a || b || c),
  },
  {
    title: "NONE HIGH",
    objective: "Light F only when every input is 0 (three-input NOR). DISARM verifies the truth table.",
    table: tableFromFn((a, b, c) => !a && !b && !c),
  },
  {
    title: "NOT ALL HIGH",
    objective: "Light F unless A, B, and C are all 1 simultaneously. Three-input NAND.",
    table: tableFromFn((a, b, c) => !(a && b && c)),
  },
  {
    title: "EXACTLY ONE",
    objective: "F should be 1 only when exactly one of A, B, C is high. DISARM verifies all eight rows.",
    table: tableFromFn((a, b, c) => a + b + c === 1),
  },
  {
    title: "EXACTLY TWO",
    objective: "F is 1 only when exactly two of A, B, C are high. DISARM verifies all eight rows.",
    table: tableFromFn((a, b, c) => a + b + c === 2),
  },
  {
    title: "GATED PASS",
    objective: "Treat C as an enable: F should equal A when C=1, else 0. Build it and DISARM.",
    table: tableFromFn((a, _b, c) => (c ? a : 0)),
  },
  {
    title: "INVERTED MUX",
    objective: "Let C be select: F should output NOT A when C=1, else B. DISARM checks the table.",
    table: tableFromFn((a, b, c) => (c ? 1 - a : b)),
  },
  {
    title: "EQUALITY CHECK",
    objective: "F lights when A and B agree (XNOR of A and B), regardless of C. DISARM verifies the table.",
    table: tableFromFn((a, b, _c) => (a === b ? 1 : 0)),
  },
  {
    title: "IMPLICATION",
    objective: "Build the logical implication F = A → B (so F=0 only when A=1 and B=0). C is unused. DISARM checks the table.",
    table: tableFromFn((a, b, _c) => (a && !b ? 0 : 1)),
  },
  {
    title: "CARRY OUT",
    objective: "Treat A,B,C as the three bits feeding a full adder. F should be the carry-out (1 when at least two are high).",
    table: tableFromFn((a, b, c) => a + b + c >= 2),
  },
  {
    title: "SUM BIT",
    objective: "Treat A,B,C as the three bits feeding a full adder. F should be the sum bit (XOR of all three).",
    table: tableFromFn((a, b, c) => (a ^ b ^ c) & 1),
  },
];

function isMajorityObjective(objective) {
  const text = typeof objective === "string" ? objective.toLowerCase() : "";
  return /\bmajority\b/.test(text) || /\bat least\s+two\b/.test(text) || /\btwo or more\b/.test(text);
}

/**
 * Pick a random fallback challenge. When `recentTitles` is provided, prefer
 * entries the player has not seen recently so endless mode keeps cycling.
 *
 * @param {string[]} [recentTitles] Most-recent titles (most recent first).
 */
export function randomFallbackChallenge(recentTitles = []) {
  const recent = new Set((recentTitles || []).map((t) => String(t).toUpperCase()));
  const fresh = POOL.filter((c) => !recent.has(c.title.toUpperCase()));
  const candidates = fresh.length > 0 ? fresh : POOL;
  return { ...candidates[Math.floor(Math.random() * candidates.length)] };
}

/**
 * Keep generated copy and verification aligned for common natural-language briefs.
 * @param {string} objective
 * @param {Record<string, { F: number }>} table
 */
export function normalizeTruthTableForObjective(objective, table) {
  if (isMajorityObjective(objective)) {
    return tableFromFn((a, b, c) => a + b + c >= 2);
  }
  return table;
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
