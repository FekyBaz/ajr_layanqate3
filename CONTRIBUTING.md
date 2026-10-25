# Contributing

Thank you for contributing to أجر لا ينقطع.

## Before you start

1. Read the README and security policy.
2. Never commit secrets or production credentials.
3. Keep changes focused and explain the reason for non-trivial changes.
4. Test your changes locally before opening a pull request.

## Local setup

Requirements: **Node.js 22.13.0 or later** (use Node 22 from `.nvmrc`), npm, a Supabase project, Netlify CLI.

```bash
npm ci
cp api/.env.example .env   # then fill in your own Supabase credentials
npm run dev
```

Useful commands:

```bash
npm test        # unit tests (zero dependencies, node:test)
npm run lint    # ESLint errors (warnings allowed for legacy code)
npm run lint:css       # Stylelint: prefer logical CSS properties (see #72)
npm run guard:migrations # Guard against insecure migration grants
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

## Contributor roles

You do not need to be a full-time developer to help. Contributions can include:

- **Development:** focused bug fixes, UI improvements, and small features.
- **Testing:** reproduce issues, add regression tests, and verify fixes.
- **Documentation:** clarify setup, architecture, and user-facing behavior.
- **Accessibility and design:** review keyboard access, contrast, responsive layouts, and RTL experience.
- **Content references:** help propose and verify reliable source references for Qur'anic verses, hadith, and adhkar. Never invent citations or make authenticity claims without a reliable, identified source.

Check [ROADMAP.md](./ROADMAP.md) and the open Issues before starting. For larger changes, discuss the approach in an Issue first.

## AI-assisted contributions

AI tools may be used to support a contribution, but they do not replace the contributor's responsibility. If AI substantially helped produce the code or documentation, disclose that in the pull request. Review generated output, understand the changes, verify citations, and run the relevant checks. Do not submit unreviewed generated code, fabricated references, or bulk changes that cannot be explained and tested. Maintainers may request revisions or decline contributions that cannot be validated.

## Review expectations

Every pull request should state the problem it solves, the relevant Issue (when applicable), how the change was tested, and any security, privacy, database, licensing, or content-provenance implications. Prefer the smallest useful change. New public data flows and schema changes require prior discussion and review.

