# أجر لا ينقطع — Project Roadmap

This roadmap describes candidate directions for the project. It is not a promise that every item will ship; priorities may change based on evidence, review capacity, and community feedback.

## Priorities

### P0 — Security and release hygiene
- [ ] Verify that the deployed Netlify publish directory exposes only intended public assets; prefer a build output directory with an explicit allowlist.
- [ ] Add deployment checks that fail if internal-only directories or files are served publicly.
- [ ] Reconcile README setup instructions with CONTRIBUTING.md and validate them in a clean environment.
- [ ] Document a repeatable smoke-test checklist for a fresh deployment.

### P1 — Trustworthy religious content
- [ ] Define a source-citation format for Qur'anic verses, hadith, and adhkar.
- [ ] Record source/reference fields where appropriate, with clear distinctions between verified source text, editorial notes, and user-submitted content.
- [ ] Document a review workflow for references and corrections, including how disputed or unverifiable submissions are handled.
- [ ] Add focused tests for source/reference display and validation before introducing schema changes.
- [ ] **AI-assisted reference suggestions:** evaluate a reviewer-first workflow to suggest Qur'anic verse references first, then hadith takhrij and adhkar references where reliable sources are available. Show provenance and uncertainty; automated suggestions must never be treated as final verification. Human review remains required. See [issue #172](https://github.com/FekyBaz/ajr_layanqate3/issues/172).

### P1 — Easier first contributions
- [ ] Label small, self-contained tasks as `good first issue` and explain the expected outcome and acceptance criteria.
- [ ] Add a contributor guide by role: development, UI/UX, testing, documentation, accessibility, and religious-content reference review.
- [ ] Provide a safe local test setup and synthetic/sample data that contains no production data or secrets.
- [ ] Add a lightweight PR smoke-test checklist and document maintainer review expectations.

### P2 — Helpful tools and lasting impact
- [ ] **Living good works:** explain practical ways to build a lasting positive impact during one's lifetime and offer clear ways to contribute to the project, with reviewed religious sourcing. See [issue #173](https://github.com/FekyBaz/ajr_layanqate3/issues/173).
- [ ] **Daily tools:** explore one small MVP from daily worship/routine checklists, self-reflection, and Ramadan planning. Reuse existing adhkar/tasbeeh and community functionality where possible; define privacy-preserving defaults. See [issue #174](https://github.com/FekyBaz/ajr_layanqate3/issues/174).
- [ ] **Qur'anic and Islamic learning resources:** curate a reviewed directory of trusted organizations/resources, with official links, inclusion criteria, and a last-reviewed date. See [issue #175](https://github.com/FekyBaz/ajr_layanqate3/issues/175).

### P2 — Community designs and reusable content
- [ ] Build on the existing Community page by evaluating an opt-in reusable design library. Explicitly distinguish permission to display from permission to download, modify, or redistribute, and preserve creator attribution. See [issue #176](https://github.com/FekyBaz/ajr_layanqate3/issues/176).
- [ ] Inventory the current endpoints and their data contracts before proposing a public API.
- [ ] Evaluate a documented, read-only JSON export for approved public content, with provenance, license, update cadence, and privacy boundaries clearly stated.
- [ ] Define rate limits, versioning, caching, and compatibility expectations before any public API is released.

### P2 — Reach, accessibility, and product quality
- [ ] Share meaningful project updates in relevant communities/platforms where the intended audience is active, and measure visits/contributions rather than posting without a feedback loop.
- [ ] Evaluate improvements to the ongoing-charity/memory experience with attention to consent, privacy, and moderation.
- [ ] Improve accessibility, responsive layouts, RTL behavior, and usability of content submission and review.
- [ ] Expand automated coverage for validation, authorization, rate limiting, and important user flows.

## How to contribute

1. Check open issues before starting work.
2. For a substantial change, open an issue first to agree on scope and acceptance criteria.
3. Keep pull requests focused and include tests or manual verification steps.
4. Do not submit secrets, personal data, production exports, or unlicensed third-party material.
5. For vulnerabilities, follow [SECURITY.md](./SECURITY.md) instead of opening a public issue.

## AI-assisted contributions

AI coding tools may be used as assistants, but the human contributor remains responsible for the contribution. Please disclose substantial AI assistance in the pull request, review generated code and references, run relevant tests, and verify any claims about religious sources against reliable references. Do not submit unreviewed generated code, fabricated citations, or bulk low-quality changes. Maintainers may ask for clarification or revisions when the author cannot explain or validate the change.

## Roadmap status

Checkboxes indicate planned work, not completed features. An item is complete only after implementation, appropriate review, and validation are merged into the default branch.
