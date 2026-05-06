import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getPortalLevelId,
  getPortalTargetConcept,
  getPortalTimeSpentSeconds,
  slugifyEndlessTitle,
} from "./portalGameContext.js";

describe("portalGameContext", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-15T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("getPortalLevelId maps endless, numbered levels, menu, and endless title slugs", () => {
    expect(getPortalLevelId(true, { id: 2 })).toBe("endless");
    expect(getPortalLevelId(false, { id: 3 })).toBe("level-3");
    expect(getPortalLevelId(false, null)).toBe("menu");
    expect(getPortalLevelId(true, null, { title: "MAJORITY DETECTOR" })).toBe("endless:majority-detector");
  });

  it("slugifyEndlessTitle normalizes punctuation and case", () => {
    expect(slugifyEndlessTitle(" Odd  Parity Gate! ")).toBe("odd-parity-gate");
  });

  it("getPortalTargetConcept returns concepts per level and endless", () => {
    expect(getPortalTargetConcept(true, null)).toBe("digital_logic_truth_table_lab");
    expect(getPortalTargetConcept(false, null)).toBe("digital_logic");
    expect(getPortalTargetConcept(false, { id: 1 })).toBe("logic_gates_and_or_not");
    expect(getPortalTargetConcept(false, { id: 4 })).toBe("jk_flipflop_clock_sequence");
    expect(getPortalTargetConcept(false, { id: 99 })).toBe("digital_logic");
  });

  it("getPortalTimeSpentSeconds floors elapsed seconds and clamps at zero", () => {
    expect(getPortalTimeSpentSeconds(0)).toBe(0);
    vi.setSystemTime(new Date("2026-01-15T12:00:45.000Z"));
    expect(getPortalTimeSpentSeconds(Date.parse("2026-01-15T12:00:10.000Z"))).toBe(35);
    expect(getPortalTimeSpentSeconds(Date.parse("2026-01-15T12:01:00.000Z"))).toBe(0);
  });
});
