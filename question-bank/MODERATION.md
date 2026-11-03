# Community submission moderation

Community reports are untrusted input. A Cloudflare Worker creates a public GitHub Issue with a structured `elpa-submission-v2` marker; legacy `v1` reports remain supported. Neither the Worker nor the website directly modifies the published question bank.

## One-click owner review

1. Open the public Issue, check provenance, privacy, existing question links, wording and duplicates.
2. **Close as completed** (repository owner `FuTseYi` only) to approve the report for automatic publication.
3. **Close as not planned** to reject; **Close as duplicate** to discard a redundant report. Neither publishes data.
4. Leave the Issue **Open** when more review is needed. Reopening an Issue restores the pending review label; it never rolls back published data.

The `issues: closed` workflow checks the trusted GitHub sender and `state_reason=completed`. It decodes the Issue marker **as data**, validates it, reuses canonical IDs, updates only the allowlisted `question-bank/` files, and runs site and unit checks before pushing to `main`. Browser regression tests remain in PR CI. Vercel Git integration is the single production deployment path; confirm the first bot-authored publication reaches READY.

**Completed means approved, not necessarily published.** The workflow sets `submission:published` only after the Issue's record is confirmed in `main` (including a repeat run). If data import fails, it sets `submission:failed` and posts a run link; fix the cause and rerun the failed workflow. When an unchanged report merely matches an existing question but the Issue itself is not recorded, neither publication nor a `published` label is claimed. Labels do not certify Vercel deployment. Never use closure as a bypass for validating a submission.

Historical synthetic test Issue [#13](https://github.com/FuTseYi/HKUST-ELPA/issues/13) was accidentally imported into the public question bank despite its explicit DO NOT PUBLISH marking. Its non-genuine D-1000013 entry has been removed from published practice content; the Issue and Git history retain the audit record. This is an intentional exception to preserving real question IDs. Never approve synthetic test Issues as real student recollections.

## Safety boundaries

- Only GitHub's authenticated owner closure event is accepted; comments, labels, reopen and any other close reason never approve.
- Input is read from the event payload, never evaluated as code. Exact duplicate detection does not replace reviewing similar wording.
- No automated translations, invented follow-up questions, or personal details in published data.
- New v2 question IDs are `<bank>-(1000000 + issue number)`: D (GZ Regular), F (GZ Fast Track), H (HK Regular), T (HK Fast Track). Existing questions retain their ID. Legacy v1 imports to D.
- `intent=encounter` records a new exam experience; `intent=supplement` adds alternative wording or follow-ups without increasing encounter counts. Do not reorder published follow-ups: old notes refer to their positions.
- Changes are strictly limited by `scripts/check-submission-diff.cjs` to `questions.js`, `fast-track.js`, `appearances.js`, `advice.js`, `community-submissions.md`, and `community-advice.md` inside `question-bank/`.
- GitHub Actions queues submissions in one concurrency group (`queue: max`, up to 100 waiting runs). Unrelated updates to `main` are handled by bounded retries with a clean checkout; pushes never force-update `main`. Each Issue is imported idempotently.
- GitHub's `GITHUB_TOKEN` pushes do not trigger ordinary GitHub Actions `push` workflows. The submission workflow validates structure and runs unit tests itself. Verify Vercel's Git integration deploys bot-authored commits; do not add a second deployment trigger by default.
- A manually reopened Issue does not undo a published item. Correct already-published data through a reviewed repository change.
- The workflow requires Actions to have `contents: write` on `main`. If branch protection prohibits bot pushes, change the protection/permissions deliberately; do not bypass them by removing validation.

## Operational setup

- `submission:pending` marks an open Issue requiring review. The workflow creates `submission:published` (record committed to `main`) and `submission:failed` (import failure) if needed; they do not duplicate the native Completed / Not planned / Duplicate decisions. Closure removes `pending`; rejection/duplicate do not mark `published`. Reopening restores `pending` and clears `failed`, but retains `published` if data was previously committed. The former `submission:approved` label is obsolete.
- Keep Worker secrets only in Cloudflare. The normal Git-connected Vercel deployment requires no extra deployment secret.
- Keep the Worker disabled until its scoped GitHub Issues token, Turnstile, rate limiting and actual production origins are verified.
- Confirm the repository's Actions write permissions, and that Vercel production deployments track `main`.
- A rejection or duplicate closure must not silently publish; check the Actions run and live website after the first successful completed closure.
