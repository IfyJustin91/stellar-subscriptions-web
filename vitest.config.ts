import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
    // `browser` is intentionally omitted: msw/node exports `browser: null`
    // which causes vite to fail when `browser` is listed as a condition.
    // Tests run in jsdom so browser-specific entry points aren't needed;
    // packages that have only a browser build still resolve via `default`.
    conditions: ["module", "import", "default"],
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.test.{ts,tsx}"],
    exclude: ["node_modules", ".next"],
    server: {
      deps: {
        // Inline most node_modules so source maps resolve to .ts source files.
        // Exclude vitest/its runner internals to prevent duplicate module
        // instances (which break beforeAll/afterAll suite registration).
        inline: [/node_modules\/(?!vitest|@vitest)/],
      },
    },
    coverage: {
      provider: "v8",
      include: ["lib/**/*.{ts,tsx}", "components/**/*.{ts,tsx}"],
      reporter: ["text"],
      // Floors sit just below today's numbers so a drop fails but today passes.
      // Raise them as the missing component and lib tests land.
      thresholds: {
        "lib/**": { statements: 35, branches: 85, functions: 45, lines: 35 },
        "components/**": { statements: 50, branches: 80, functions: 60, lines: 50 },
      },
    },
  },
});
