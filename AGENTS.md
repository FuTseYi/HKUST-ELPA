# Repository Guide

HKUST-ELPA is a lightweight, student-maintained ELPA preparation website: vanilla HTML/CSS/JavaScript, browser-local learning records, a Cloudflare submission Worker, and GitHub-native moderation.

**Core principles: Every line of code should justify its existence. Define once. Reuse everywhere.**

Treat the website, question bank, submission protocol, moderation, and deployment as one coherent system. Prefer stable behavior, a single authoritative source for each fact, accessible interfaces, portable static output, and long-term maintainability over isolated patches or artificially small diffs.

## Architecture and ownership

- Root HTML files own their respective page UI. Public output is built into `_site/`. `assets/css/` and `assets/js/` own browser styles and scripts; `assets/images/`, `assets/icons/`, and `assets/demos/` own media. `index.html` owns shared navigation and footer, which are reused during the build. CSS and browser JavaScript implement presentation and interactions. Avoid introducing a frontend framework or runtime dependency without a demonstrated need.
- `question-bank/` owns canonical questions, reported encounters, reviewed advice, stable taxonomy, and source provenance. The same question must not be recreated for each appearance.
- Browser learning records are local to the current origin; no account or server database is required.
- `worker/` accepts untrusted submissions and creates GitHub Issues. It never publishes questions directly. Cloudflare secrets must never enter the website or repository.
- `.github/workflows/` orchestrates CI and owner-approved publication; importing, validating, and identifying data belongs in scripts, not shell text matching.
- `tests/` protects compatibility, data integrity, UI behavior, and server-side security. Tests should assert observable contracts rather than accidental source formatting.

## Non-negotiable compatibility

- Preserve all published question IDs, historical ID aliases, URL routes and query parameters, and previously recorded follow-up order. User notes associate follow-ups by position.
- Preserve existing localStorage keys (`elpa-q-status-v1`, `elpa-notes-v1`, `elpa-data-snapshot-v2`, `elpa-autosave`) and the IndexedDB folder-handle store until migration is explicitly implemented and tested. The snapshot storage key is v2 but its payload version is currently 1.
- Preserve JSON export/import behavior and the origin-local storage boundary. Do not publish personal learning data, including the public `elpa_data.json` template.
- Preserve historical student recollections, attribution, uncertainty, source links, and verbatim-versus-paraphrased distinctions. Never invent missing questions, translations, follow-ups, or exam dates.
- Keep already-published data and outstanding v1/v2 Issues importable; do not remove legacy handling based on file names alone.

## Data and submission boundaries

- Canonical question content, exam appearances, reviewed advice, and personal learning records are different entities. Keep their ownership clear even if their physical file layout changes.
- Consolidate genuine duplicate rules, but validate submissions independently at the browser, Worker, and trusted importer boundaries. Browser validation is UX, not a security control.
- GitHub Issues are the audit trail. Only a completed closure by the repository owner authorizes publication. Other closure reasons must not publish. Completed is approval, not proof of a successful commit or deployment.
- Importing an Issue must be idempotent. Distinguish already-recorded Issues from matching-but-unrecorded content. Bound retries, restrict changed files, and never force-push.
- Status labels describe the import outcome, not the authoritative moderation decision; reopening an Issue does not undo a published record.
- Do not collapse meaningful source documentation into generated summaries until all original details survive.

## Engineering and change management

- Treat cross-project alignment as a quality baseline, not a fixed repository template. Prefer familiar, purpose-driven organization; reuse proven logic only when it suits this project. Each site may evolve its UI, dependencies and structure independently.

- Read the affected callers, dependencies, source data, tests, and deployment configuration before changing structure.
- Prefer removing the underlying cause of drift over adding checks for multiple manually maintained copies. Use generation only when it reduces total maintenance and keeps portable static output.
- Reuse code where semantics really match. Do not create generic services, abstract layers, or a large number of small files solely to reduce line count.
- Remove obsolete implementation and unused tests after migration; avoid permanent dual paths, speculative fallbacks, or redundant state.
- Keep substantial structural changes in a reviewable PR. Make coherent, verified commits; avoid repeated deployment-triggering pushes and never rewrite shared history without explicit authorization.


- Edit each root HTML page directly. Shared navigation and footer follow `index.html` during the build. Keep site-specific organization simple; no external shared package, generated source synchronization or separate template directory is required.

## Verification and documentation

- Run the common Python suite `python -m unittest discover -s tests -t . -p 'test_*.py'`, `npm run check`, `npm test`, and, for user-facing changes, `npm run test:browser`. For Worker changes, include Worker security and contract tests. Report exactly what ran.
- `preview.py` is the single Python build and local preview entry point: Windows `py -3 preview.py`, otherwise `python3 preview.py`. Vercel, Pages and CI must use `preview.py --build-only` to publish the same `_site/` build, without a parallel build wrapper. Verify root and `/HKUST-ELPA/` paths; keep deployment secrets external.
- Test old backup restore, existing note keys, linked/supplement submission semantics, duplicate/failed publication, mobile layouts, keyboard interactions, and timer behavior whenever related code changes.
- `README.md` describes project usage. `question-bank/README.md` owns question sources and editorial provenance. `question-bank/MODERATION.md` owns approval and recovery operations. `docs/submission-v2-spec.md` owns the submission data contract; `worker/README.md` owns Worker operations. Reference these documents rather than copying their full rules into multiple places.
- This guide governs engineering priorities and document ownership. Update the relevant owner document when behavior changes; do not duplicate business policy here.
