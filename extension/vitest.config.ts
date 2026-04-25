import { defineConfig } from "vitest/config";

// Vitest config for the extension package.
//
// We intentionally don't share the root project's `vitest.config.ts`:
// the extension lives in its own pnpm workspace, has its own deps
// (`happy-dom`, the chrome shim), and its tests target the
// browser-extension surface area only — pure libs, the cache, and
// the API wrapper. Gmail DOM scraping stays manually tested because
// Gmail's DOM mutates faster than any fixture we could write.
export default defineConfig({
  test: {
    environment: "happy-dom",
    setupFiles: ["./tests/_setup.ts"],
    globals: false,
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/lib/**/*.ts"],
      reporter: ["text", "html"],
    },
  },
  resolve: {
    alias: {
      "@": "/src",
    },
  },
});
