import { describe, it, expect, vi } from "vitest";
import { normalizeTruthTableForObjective, randomFallbackChallenge, validateTruthTable } from "./endlessChallenges.js";

describe("validateTruthTable", () => {
  it("returns false for non-objects or missing rows", () => {
    expect(validateTruthTable(null)).toBe(false);
    expect(validateTruthTable(undefined)).toBe(false);
    expect(validateTruthTable("x")).toBe(false);
    expect(validateTruthTable({ "000": { F: 0 } })).toBe(false);
  });

  it("returns false when any F is not 0 or 1", () => {
    expect(
      validateTruthTable({
        "000": { F: 0 },
        "001": { F: 1 },
        "010": { F: 1 },
        "011": { F: 2 },
        "100": { F: 0 },
        "101": { F: 0 },
        "110": { F: 0 },
        "111": { F: 0 },
      })
    ).toBe(false);
  });

  it("returns true for a complete 3-bit truth table", () => {
    const table = {};
    for (let a = 0; a <= 1; a++) {
      for (let b = 0; b <= 1; b++) {
        for (let c = 0; c <= 1; c++) {
          table[`${a}${b}${c}`] = { F: (a ^ b ^ c) & 1 };
        }
      }
    }
    expect(validateTruthTable(table)).toBe(true);
  });
});

describe("randomFallbackChallenge", () => {
  it("returns a challenge from the pool with a valid table", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const ch = randomFallbackChallenge();
    expect(ch.title).toBeTruthy();
    expect(ch.objective).toBeTruthy();
    expect(validateTruthTable(ch.table)).toBe(true);
    vi.restoreAllMocks();
  });

  it("avoids titles in the recent list when alternatives exist", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const first = randomFallbackChallenge();
    const second = randomFallbackChallenge([first.title]);
    expect(second.title).not.toBe(first.title);
    vi.restoreAllMocks();
  });
});

describe("normalizeTruthTableForObjective", () => {
  it("uses a majority table when the objective says at least two inputs are high", () => {
    const wrongTable = {};
    for (let a = 0; a <= 1; a++) {
      for (let b = 0; b <= 1; b++) {
        for (let c = 0; c <= 1; c++) {
          wrongTable[`${a}${b}${c}`] = { F: c };
        }
      }
    }

    const table = normalizeTruthTableForObjective(
      "Player wires gates so F=1 when at least two of the inputs are high.",
      wrongTable
    );

    expect(table).toEqual({
      "000": { F: 0 },
      "001": { F: 0 },
      "010": { F: 0 },
      "011": { F: 1 },
      "100": { F: 0 },
      "101": { F: 1 },
      "110": { F: 1 },
      "111": { F: 1 },
    });
  });

  it("uses a mux table when objective says C=0 follows A and C=1 follows B", () => {
    const wrongTable = {};
    for (let a = 0; a <= 1; a++) {
      for (let b = 0; b <= 1; b++) {
        for (let c = 0; c <= 1; c++) {
          wrongTable[`${a}${b}${c}`] = { F: a && b ? 1 : 0 };
        }
      }
    }

    const table = normalizeTruthTableForObjective(
      "Use pins A, B, and C to control the LED F. When C is 0, F follows A; when C is 1, F follows B.",
      wrongTable
    );

    expect(table).toEqual({
      "000": { F: 0 },
      "001": { F: 0 },
      "010": { F: 0 },
      "011": { F: 1 },
      "100": { F: 1 },
      "101": { F: 0 },
      "110": { F: 1 },
      "111": { F: 1 },
    });
  });

  it("uses a mux table for low/high wording and otherwise phrasing", () => {
    const wrongTable = {};
    for (let a = 0; a <= 1; a++) {
      for (let b = 0; b <= 1; b++) {
        for (let c = 0; c <= 1; c++) {
          wrongTable[`${a}${b}${c}`] = { F: a && b ? 1 : 0 };
        }
      }
    }

    const table = normalizeTruthTableForObjective(
      "C is the select line: F equals B when C is high, otherwise A.",
      wrongTable
    );

    expect(table).toEqual({
      "000": { F: 0 },
      "001": { F: 0 },
      "010": { F: 0 },
      "011": { F: 1 },
      "100": { F: 1 },
      "101": { F: 0 },
      "110": { F: 1 },
      "111": { F: 1 },
    });
  });

  it("uses a mux table for false/true follow wording", () => {
    const wrongTable = {};
    for (let a = 0; a <= 1; a++) {
      for (let b = 0; b <= 1; b++) {
        for (let c = 0; c <= 1; c++) {
          wrongTable[`${a}${b}${c}`] = { F: c };
        }
      }
    }

    const table = normalizeTruthTableForObjective(
      "When C is false, F follows A; when C is true, F follows B.",
      wrongTable
    );

    expect(table).toEqual({
      "000": { F: 0 },
      "001": { F: 0 },
      "010": { F: 0 },
      "011": { F: 1 },
      "100": { F: 1 },
      "101": { F: 0 },
      "110": { F: 1 },
      "111": { F: 1 },
    });
  });

  it("uses all-high table when objective is three-input AND wording", () => {
    const wrongTable = {};
    for (let a = 0; a <= 1; a++) {
      for (let b = 0; b <= 1; b++) {
        for (let c = 0; c <= 1; c++) {
          wrongTable[`${a}${b}${c}`] = { F: (a ^ b ^ c) & 1 };
        }
      }
    }

    const table = normalizeTruthTableForObjective("Light F only when A AND B AND C are all 1.", wrongTable);
    expect(table["111"].F).toBe(1);
    expect(table["110"].F).toBe(0);
    expect(table["001"].F).toBe(0);
  });

  it("uses odd-parity table when objective says odd parity", () => {
    const wrongTable = {};
    for (let a = 0; a <= 1; a++) {
      for (let b = 0; b <= 1; b++) {
        for (let c = 0; c <= 1; c++) {
          wrongTable[`${a}${b}${c}`] = { F: a && b && c ? 1 : 0 };
        }
      }
    }

    const table = normalizeTruthTableForObjective("Make F the odd parity output of A, B, C.", wrongTable);
    expect(table["000"].F).toBe(0);
    expect(table["001"].F).toBe(1);
    expect(table["011"].F).toBe(0);
    expect(table["111"].F).toBe(1);
  });

  it("uses exactly-two table when objective says exactly two inputs are high", () => {
    const wrongTable = {};
    for (let a = 0; a <= 1; a++) {
      for (let b = 0; b <= 1; b++) {
        for (let c = 0; c <= 1; c++) {
          wrongTable[`${a}${b}${c}`] = { F: c };
        }
      }
    }

    const table = normalizeTruthTableForObjective("F is 1 only when exactly two of A, B, C are high.", wrongTable);
    expect(table["011"].F).toBe(1);
    expect(table["101"].F).toBe(1);
    expect(table["110"].F).toBe(1);
    expect(table["111"].F).toBe(0);
  });
});
