import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
    conditions: ["browser", "module", "import", "default"],
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.test.{ts,tsx}"],
    exclude: ["node_modules", ".next"],
    server: {
      deps: {
        // Inline most dependencies so their source maps are resolved and stack
        // traces point to .ts source files rather than compiled .js output.
        // vitest's own packages must NOT be inlined — doing so breaks the
        // suite-context tracking that beforeAll/afterAll rely on.
        inline: [/node_modules\/(?!vitest)/],
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
