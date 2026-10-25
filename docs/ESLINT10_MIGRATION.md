# ESLint 10 migration

## Why this exists

ESLint 10 uses flat config. The repository previously had only `.eslintrc.json`, so ESLint 10 could exit successfully only after a configuration was added; a passing CI result alone does not prove the former rules are active.

## Configuration

`eslint.config.js` keeps the project's existing security-focused rules and warning levels. Browser and Node globals are supplied explicitly through the `globals` package, which is declared as a direct development dependency. The config excludes generated output, local dependencies, Netlify's local build directory, and coverage output.

The deprecated `no-return-await` rule is disabled because it is no longer a supported core rule in modern ESLint. This is not a relaxation of a security rule; its former warning/error semantics no longer apply to the newer runtime.

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

The ESLint configuration is validated separately in CI by asking ESLint to print its resolved configuration for representative browser and server files, and by asserting that the security rule set is enabled. Do not merge the major upgrade if configuration validation fails.
