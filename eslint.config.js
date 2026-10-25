// Flat configuration for ESLint 10.
// Keep this ruleset aligned with the former .eslintrc.json.
export default [
  {
    ignores: ["dist/**", "node_modules/**", ".netlify/**", "coverage/**"],
  },
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
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
