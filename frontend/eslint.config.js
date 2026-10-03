import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import jsxA11y from "eslint-plugin-jsx-a11y";
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
  message:
    "Sparkles is banned for AI UI (CLAUDE.md). Use Feather (open chat), Compass (AI action), Wand2 (attribute suggestion).",
};

/**
 * Full-page navigation loses store state and in-flight AI streams. Use the
 * router. Kept at `warn` until the command registry gets a navigate handle
 * (refactor doc 04 §2); the count should go down, never up.
 */
const NO_LOCATION_ASSIGN = {
  selector:
    "AssignmentExpression[left.object.object.name='window'][left.object.property.name='location'][left.property.name='href']",
  message: "Navigate with react-router (useNavigate / the command context) instead of window.location.href.",
};

/**
 * The API sends UTC with no offset, and `new Date(string)` reads that as local time —
 * hours in the future west of Greenwich. Parse API timestamps with parseServerDate.
 * Held by the warning cap: a new one raises the count and fails CI.
 */
const NO_BARE_DATE_PARSE = {
  selector: "NewExpression[callee.name='Date'][arguments.length>0]",
  message: "API timestamps are UTC without an offset — use parseServerDate / serverTime from lib/serverDate.",
};

/**
 * Doc 17: a control has a name a screen reader can say (an icon alone has none: give it
 * an aria-label), images have alt text, and ARIA is spelt right. Errors, not warnings:
 * the tree was brought to zero when these went in.
 */
const A11Y = {
  "jsx-a11y/control-has-associated-label": [
    "error",
    {
      ignoreElements: [
        "audio",
        "canvas",
        "embed",
        "input",
        "textarea",
        "select",
        "option",
        "tr",
        "th",
        "td",
        "li",
        "video",
        "a",
      ],
      ignoreRoles: [
        "grid",
        "listbox",
        "menu",
        "menubar",
        "radiogroup",
        "row",
        "tablist",
        "toolbar",
        "tree",
        "treegrid",
        "option",
        "tabpanel",
        "separator",
      ],
      depth: 4,
    },
  ],
  "jsx-a11y/alt-text": "error",
  "jsx-a11y/aria-props": "error",
  "jsx-a11y/aria-role": "error",
  "jsx-a11y/role-has-required-aria-props": "error",
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
    plugins: { "jsx-a11y": jsxA11y },
    rules: {
      ...LEGACY_WARNINGS,
      ...A11Y,
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
      "no-restricted-imports": ["error", { paths: [NO_SPARKLES] }],
      "no-restricted-syntax": ["warn", NO_LOCATION_ASSIGN, NO_BARE_DATE_PARSE],
    },
  },
  {
    // The API client owns the one legitimate hard redirect (401 -> /login).
    files: ["src/api/client.ts", "src/api/request.ts", "src/**/*.test.ts", "src/**/*.test.tsx"],
    rules: { "no-restricted-syntax": "off" },
  },
]);
