# Community submission moderation

The front end and Cloudflare Worker never change published question-bank data.
The Worker creates a public Issue with a readable summary and machine-readable
`elpa-submission-v2` marker. Older `elpa-submission-v1` records remain supported.

## Maintainer-only process

1. Review the Issue: reliability, privacy, duplicate and wording.
2. To reject, close the Issue; leave `submission:approved` absent.
3. To approve, add `submission:approved` **yourself** as repository owner
   (`FuTseYi`) while the Issue is open.
4. The `issues:labeled` workflow reads the event JSON **as data**, validates
   its fields, checks exact duplicates, and writes **only**
   the files allowed by `scripts/check-submission-diff.cjs`:
   - `question-bank/questions.js` — regular GZ questions;
   - `question-bank/fast-track.js` — GZ Fast Track and HK campus banks;
   - `question-bank/appearances.js` — session reports, alternative wording and follow-ups;
   - `question-bank/advice.js` — reviewed preparation advice;
   - `question-bank/community-submissions.md` and `question-bank/community-advice.md` — review/source records.
5. It creates a PR against `main`. Check the diffs, source qualifiers and
   site-checks; merge manually. It does **not** auto-merge or add unapproved
   content to the website.

To use this workflow, create the `submission:approved` repository label and
enable **Settings → Actions → General → Workflow permissions →
Allow GitHub Actions to create and approve pull requests** if disabled.

Limitations:
- Exact normalized duplicate detection only. Similar wording still needs review.
- No automatic translation or fabricated follow-up questions.
- New v2 question IDs are `<bank>-(1000000 + issue number)`, using `D` (GZ Regular),
  `F` (GZ Fast Track), `H` (HK Regular) or `T` (HK Fast Track). Legacy v1 creates D IDs.
  An exact existing question keeps its ID and v2 records its reported session.
- `intent=encounter` counts an exam experience; `intent=supplement` adds alternative
  wording or follow-ups without increasing the encounter count. Keep published
  follow-up order stable to preserve positional note keys.
- GitHub `GITHUB_TOKEN`-created PRs may not trigger separate
  `pull_request` workflows. Check the PR manually and run the normal site CI
  against any human-updated branch before merging.
- No personally identifiable details should be copied into public questions.

## Release policy

The Cloudflare Worker must remain closed until a repository-scoped GitHub token,
Turnstile verification, both `submission:pending` and `submission:approved`
labels, and permission for Actions to create PRs are available.
Set `SUBMISSIONS_DISABLED=false` **only after** the full workflow has been
verified. Missing or misspelled values are treated as disabled.

For a new question, review the generated PR diff, provenance and any similar
questions. Do not merge a PR generated from a synthetic test report.
Do not delete implementation branches after PR merges.
