import { describe, it, expect } from "vitest";
import { svgClientToSvg } from "./svgClientToSvg.js";

describe("svgClientToSvg", () => {
  it("returns client coordinates when getScreenCTM is null", () => {
    const svg = {
      createSVGPoint() {
        return { x: 0, y: 0, matrixTransform: () => ({ x: 0, y: 0 }) };
      },
      getScreenCTM: () => null,
    };
    expect(svgClientToSvg(svg, 12, 34)).toEqual({ x: 12, y: 34 });
  });

  it("transforms through inverse CTM when present", () => {
    const svg = {
      createSVGPoint() {
        return {
          x: 1,
          y: 2,
          matrixTransform(m) {
            expect(m).toBe(inv);
            return { x: 10, y: 20 };
          },
        };
      },
    };
    const inv = {};
    svg.getScreenCTM = () => ({ inverse: () => inv });
    expect(svgClientToSvg(svg, 99, 88)).toEqual({ x: 10, y: 20 });
  });
});
