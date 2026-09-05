import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";

/**
 * `npm run lint` is a CI gate (`just ci`). The react-hooks/react-refresh
 * families are warnings so the gate could go in against the existing tree;
 * `--max-warnings` in package.json is the ratchet (152 at Stage 0). Lower it
 * as warnings are fixed; never raise it. Everything else is an error.
 */
const LEGACY_WARNINGS = {
  "react-hooks/set-state-in-effect": "warn",
  "react-hooks/refs": "warn",
  "react-hooks/exhaustive-deps": "warn",
  "react-hooks/immutability": "warn",
  "react-hooks/purity": "warn",
  "react-hooks/static-components": "warn",
  "react-refresh/only-export-components": "warn",
};

/**
 * CLAUDE.md: "Never use the Sparkles icon for AI buttons." Feather opens a
 * chat, Compass triggers an action, Wand2 suggests attributes, Cpu is the
 * feature-info trigger, ShieldCheck is transparency.
 */
const NO_SPARKLES = {
  name: "lucide-react",
  importNames: ["Sparkles"],
  message: "Sparkles is banned for AI UI (CLAUDE.md). Use Feather (open chat), Compass (AI action), Wand2 (attribute suggestion).",
};

/**
 * Full-page navigation loses store state and in-flight AI streams. Use the
 * router. Kept at `warn` until the command registry gets a navigate handle
 * (refactor doc 04 §2); the count should go down, never up.
 */
const NO_LOCATION_ASSIGN = {
  selector: "AssignmentExpression[left.object.object.name='window'][left.object.property.name='location'][left.property.name='href']",
  message: "Navigate with react-router (useNavigate / the command context) instead of window.location.href.",
};

export default defineConfig([
  globalIgnores(["dist", "coverage", "node_modules"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    rules: {
      ...LEGACY_WARNINGS,
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
      "no-restricted-imports": ["error", { paths: [NO_SPARKLES] }],
      "no-restricted-syntax": ["warn", NO_LOCATION_ASSIGN],
    },
  },
  {
    // The API client owns the one legitimate hard redirect (401 -> /login).
    files: ["src/api/client.ts", "src/**/*.test.ts", "src/**/*.test.tsx"],
    rules: { "no-restricted-syntax": "off" },
  },
]);
