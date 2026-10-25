# ESLint 10 migration

## Why this exists

ESLint 10 uses flat config. The repository previously had only `.eslintrc.json`, so ESLint 10 could exit successfully only after a configuration was added; a passing CI result alone does not prove the former rules are active.

## Configuration

`eslint.config.js` keeps the project's existing security-focused rules and warning levels. Browser and Node globals are supplied explicitly through the `globals` package, which is declared as a direct development dependency. The config excludes generated output, local dependencies, Netlify's local build directory, and coverage output.

The deprecated `no-return-await` core rule was removed from the flat configuration because modern ESLint does not support it as a configurable core rule. No other configured rule severity was intentionally changed.

## Verification

Run:

```sh
npm ci
npm run lint
npm test
npm run build
npm run lint:css
npm run guard:migrations
```

The ESLint configuration is validated by running ESLint against the project and by checking the resolved config for representative browser and server files. Do not merge the major upgrade if configuration validation fails.
