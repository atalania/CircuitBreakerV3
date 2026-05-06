import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "stem-assistant-bridge": path.resolve(__dirname, "js/vendor/stem-assistant-bridge.js"),
    },
  },
  test: {
    environment: "node",
    include: ["js/**/*.test.js"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "coverage",
      /**
       * Scope coverage to logic the Vitest suite exercises. Large DOM/UI
       * surfaces (App, CircuitRenderer, UIManager, lab canvas) stay out of
       * this denominator so the report matches “core game + portal” coverage.
       */
      include: [
        "js/modules/circuitLab.js",
        "js/modules/engine.js",
        "js/modules/aiProxyClient.js",
        "js/modules/portalAssistant.js",
        "js/modules/endlessChallenges.js",
        "js/modules/tutor.js",
        "js/modules/audio.js",
        "js/levels/**/*.js",
        "js/app/campaignSubmit.js",
        "js/app/endlessSubmit.js",
        "js/app/jkPulse.js",
        "js/app/portalGameContext.js",
        "js/app/lab/isValidLabPlaceKind.js",
        "js/app/lab/labBlockIdFromElement.js",
        "js/app/lab/svgClientToSvg.js",
      ],
      thresholds: {
        statements: 70,
        branches: 65,
        functions: 70,
        lines: 70,
      },
    },
  },
});
