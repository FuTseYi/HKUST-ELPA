# Community submission moderation

The front end and Cloudflare Worker never change published question-bank data.
The Worker creates a public Issue with a readable summary and machine-readable
`elpa-submission-v1` marker.

## Maintainer-only process

1. Review the Issue: reliability, privacy, duplicate and wording.
2. To reject, close the Issue; leave `submission:approved` absent.
3. To approve, add `submission:approved` **yourself** as repository owner
   (`FuTseYi`) while the Issue is open.
4. The `issues:labeled` workflow reads the event JSON **as data**, validates
   its fields, checks exact duplicates, and writes **only**
   `question-bank/questions.js` and
   `question-bank/community-submissions.md`.
5. It creates a PR against `main`. Check the diffs, source qualifiers and
   site-checks; merge manually. It does **not** auto-merge or add unapproved
   content to the website.

To use this workflow, create the `submission:approved` repository label and
enable **Settings → Actions → General → Workflow permissions →
Allow GitHub Actions to create and approve pull requests** if disabled.

Limitations:
- Exact normalized duplicate detection only. Similar wording still needs review.
- No automatic translation or fabricated follow-up questions.
- Generated IDs are `D-(1000000 + issue number)`, stable across
  parallel reviews and existing localStorage snapshots.
- GitHub `GITHUB_TOKEN`-created PRs may not trigger separate
  `pull_request` workflows. Check the PR manually and run the normal site CI
  against any human-updated branch before merging.
- No personally identifiable details should be copied into public questions.
