import { defineConfig } from "vitest/config";

// Vitest config — scoped to the anti-abuse / trust surface.
//
// Coverage intentionally excludes app/, components, and framework
// glue. We target the logic an attacker can probe: reputation gates,
// score math, and the badge state resolver. Pushing to 100% line
// coverage across Next.js surfaces would pay for tests that tell us
// nothing about correctness.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    globals: false,
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    setupFiles: ["tests/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary", "html"],
      include: [
        "lib/trust.ts",
        "lib/reputation.ts",
        "lib/badge-state.ts",
        "lib/badge-dimensions.ts",
        "app/api/inbound/route.ts",
      ],
      thresholds: {
        // Anti-abuse surface must stay at 100%. If a branch goes
        // uncovered, CI catches it before the refactor lands.
        lines: 100,
        branches: 95,
        functions: 100,
        statements: 100,
      },
    },
  },
});
