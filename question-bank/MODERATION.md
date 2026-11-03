# Community submission moderation

Community reports are untrusted input. A Cloudflare Worker creates a public GitHub Issue with a structured `elpa-submission-v2` marker; legacy `v1` reports remain supported. Neither the Worker nor the website directly modifies the published question bank.

## One-click owner review

1. Open the public Issue, check provenance, privacy, existing question links, wording and duplicates.
2. **Close as completed** (repository owner `FuTseYi` only) to approve the report for automatic publication.
3. **Close as not planned** to reject; **Close as duplicate** to discard a redundant report. Neither publishes data.
4. Leave the Issue **Open** when more review is needed.

The `issues: closed` workflow checks the trusted GitHub sender and `state_reason=completed`. It decodes the Issue marker **as data**, validates it, reuses canonical IDs, updates only the allowlisted `question-bank/` files, and runs site checks, unit tests and browser smoke tests before pushing a commit to `main`. The Vercel Git integration should deploy updates to `main`; an optional repository secret `VERCEL_DEPLOY_HOOK_URL` can explicitly request a deployment. Always verify the production deployment.

**Completed means approved, not necessarily published.** A failed workflow leaves the Issue closed and posts a run link for diagnosis; after fixing the cause, rerun the failed workflow. For a completed Issue with no new changes, the importer exits without writing or publishing. Never use closure as a bypass for validating a submission.

## Safety boundaries

- Only GitHub's authenticated owner closure event is accepted; comments, labels, reopen and any other close reason never approve.
- Input is read from the event payload, never evaluated as code. Exact duplicate detection does not replace reviewing similar wording.
- No automated translations, invented follow-up questions, or personal details in published data.
- New v2 question IDs are `<bank>-(1000000 + issue number)`: D (GZ Regular), F (GZ Fast Track), H (HK Regular), T (HK Fast Track). Existing questions retain their ID. Legacy v1 imports to D.
- `intent=encounter` records a new exam experience; `intent=supplement` adds alternative wording or follow-ups without increasing encounter counts. Do not reorder published follow-ups: old notes refer to their positions.
- Changes are strictly limited by `scripts/check-submission-diff.cjs` to `questions.js`, `fast-track.js`, `appearances.js`, `advice.js`, `community-submissions.md`, and `community-advice.md` inside `question-bank/`.
- The workflow retries publication against a fresh `main` checkout if another commit races it. Each Issue is imported idempotently. Do not force-push.
- GitHub's `GITHUB_TOKEN` pushes do not trigger ordinary GitHub Actions `push` workflows. The submission workflow runs checks itself. Verify that Vercel received the new production commit, or set a Vercel deploy hook secret.
- A manually reopened Issue does not undo a published item. Correct already-published data through a reviewed repository change.
- The workflow requires Actions to have `contents: write` on `main`. If branch protection prohibits bot pushes, change the protection/permissions deliberately; do not bypass them by removing validation.

## Operational setup

- Create the `submission:pending` label for incoming Issues. The former `submission:approved` label is not used by the workflow and can be deleted when no longer needed.
- Keep Worker secrets only in Cloudflare and deployment-hook URLs only in GitHub Actions secrets.
- Keep the Worker disabled until its scoped GitHub Issues token, Turnstile, rate limiting and actual production origins are verified.
- Confirm the repository's Actions write permissions, and that Vercel production deployments track `main`.
- A rejection or duplicate closure must not silently publish; check the Actions run and live website after the first successful completed closure.
