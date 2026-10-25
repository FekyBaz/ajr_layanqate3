// Flat config for ESLint 10. Preserve the former .eslintrc.json rules.
// The project uses browser scripts and Node-based Netlify functions.
import globals from "globals";

export default [
  {
    ignores: [
      "node_modules/**",
      ".netlify/**",
      "dist/**",
      "coverage/**",
    ],
  },
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",
      "no-script-url": "error",
      "no-proto": "error",
      "no-caller": "error",
      "no-with": "error",
      "no-labels": "error",
      "no-implicit-globals": "error",
      "no-var": "warn",
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-console": ["warn", { allow: ["warn", "error"] }],
      eqeqeq: ["error", "always"],
      "no-throw-literal": "error",
      "no-return-await": "off",
    },
  },
];
