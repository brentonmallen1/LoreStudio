import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
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
        // measured 14.4 / 73.4 / 31.1 / 14.4
        statements: 13.5,
        branches: 72,
        functions: 30,
        lines: 13.5,
        // measured 78.3 / 85.4 / 60.2 / 78.3
        "src/lib/**": { statements: 77, branches: 84, functions: 59, lines: 77 },
        // measured 48.2 / 77.5 / 27.8 / 48.2
        "src/stores/**": { statements: 47, branches: 76, functions: 27, lines: 47 },
      },
    },
  },
});
