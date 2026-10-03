# Contributing

Thank you for contributing to أجر لا ينقطع.

## Before you start

1. Read the README and security policy.
2. Never commit secrets or production credentials.
3. Keep changes focused and explain the reason for non-trivial changes.
4. Test your changes locally before opening a pull request.

## Local setup

Requirements: **Node.js 20** (see `.nvmrc`), npm, a Supabase project, Netlify CLI.

```bash
npm install
cp api/.env.example .env   # then fill in your own Supabase credentials
npm run dev
```

Useful commands:

```bash
npm test        # unit tests (zero dependencies, node:test)
npm run lint    # ESLint errors (warnings allowed for legacy code)
npm run lint:css  # stylelint: physical CSS properties fail (use logical ones, see #72)
```

Apply the SQL migrations in `api/migrations/` to your Supabase project
before testing functions locally.

## Branches and commits

- Branch from `main`: `fix/<issue-number>-short-topic`.
- Write commit messages as imperative summaries, e.g.
  `Add shared modal helper with focus trap (Fixes #66)`.
- Reference the issue in the PR body with `Closes #<n>` so it auto-closes.

## Pull requests

The PR template (`.github/PULL_REQUEST_TEMPLATE.md`) mirrors this checklist.
Please include:

- What changed
- Why it changed
- How it was tested
- Any database migration or environment-variable changes
- Any privacy or security implications

Avoid unrelated formatting or refactoring in the same pull request.

## Content and data

The code license does not automatically grant rights to third-party text, images, audio, fonts, datasets, or religious source material included with or referenced by the project. Contributors are responsible for verifying that new third-party assets can legally be redistributed.
