import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  test: {
    environment: "happy-dom",
    environmentOptions: {
      happyDOM: {
        url: "http://localhost",
      },
    },
    setupFiles: ["./src/test/setup.ts"],
    globals: true,
    // Coverage floors, a ratchet like the backend's fail_under (doc 23 P6): a point under what
    // was measured on 2026-10-07, so a regression fails and noise does not. Raise them as tests
    // are added; never lower them. The pure logic in lib/ is held highest; components are
    // tried in the browser and barely measured.
    coverage: {
      include: ["src/**/*.{ts,tsx}"],
      thresholds: {
        // Vitest 4's v8 coverage maps through the source's syntax tree, so the figures were
        // measured again on 2026-10-09 with the same tests (v3 counted branches far higher).
        // measured 15.4 / 11.9 / 12.1 / 14.8
        statements: 14.5,
        branches: 11,
        functions: 11.5,
        lines: 14,
        // measured 69.8 / 65.3 / 63.5 / 70.6
        "src/lib/**": { statements: 69, branches: 64.5, functions: 62.5, lines: 70 },
        // measured 40.3 / 38.0 / 34.5 / 42.0
        "src/stores/**": { statements: 39.5, branches: 37, functions: 33.5, lines: 41 },
      },
    },
  },
});
