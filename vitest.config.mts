import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  // Reads `paths` from tsconfig.json so "@/..." and "@db/..." resolve in tests
  // exactly as they do in the Next build. One source of truth for aliases; a
  // second copy here would drift and pass tests against modules the app never
  // loads.
  plugins: [tsconfigPaths()],
  test: {
    // Node, not jsdom. Everything under test here is pure logic — validators,
    // formatters, arithmetic. Pulling in a DOM would slow the suite down and
    // tempt us into testing React instead of the rules.
    environment: "node",
    include: ["src/**/*.test.ts"],
    exclude: ["node_modules", ".next", "dist", "tests/browser/**"],
    passWithNoTests: false,
  },
});
