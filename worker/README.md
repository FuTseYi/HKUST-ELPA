# HKUST-ELPA submission Worker

This **separate Cloudflare Worker** accepts anonymous submissions from
`https://futseyi.github.io/HKUST-ELPA/submit.html` and
`https://hkust-elpa.vercel.app/submit.html`; both create a **public GitHub Issue**.
It does **not** edit website files or publish a question. Maintainer review remains mandatory.

## Deploy prerequisites

1. Create a Cloudflare Turnstile widget restricted to **futseyi.github.io** and **hkust-elpa.vercel.app**.
   Use action **elpa_submit**. Keep the Site Key public; keep the Secret private.
2. Use Wrangler 4.36+ in `worker/`. The configured `namespace_id` is `11247601` (account-specific; already deployed).
3. Create the GitHub labels `submission:pending` and `submission:approved` in the repository before accepting submissions. The pending label is applied by the Worker when it creates an Issue. Then create a **fine-grained GitHub PAT** restricted to only
   `FuTseYi/HKUST-ELPA`, permission **Issues: Read and write**;
   no Contents/Actions/Admin permissions. Store it only as a Worker secret.
4. Configure Worker secrets via:
   - `npx wrangler secret put TURNSTILE_SECRET`
   - `npx wrangler secret put GITHUB_TOKEN`
   Optional kill switch (plaintext Worker environment variable):
   `SUBMISSIONS_DISABLED=true` disables POST submissions; requests are accepted **only** when set explicitly to `false` and all other validations succeed. If the binding is missing, submissions remain disabled.
5. Deploy with `npx wrangler deploy`. The checked-in `wrangler.jsonc` deliberately
   defaults to `SUBMISSION_MODE=closed` and `SUBMISSIONS_DISABLED=true`.
   **After every production deployment**, explicitly verify the live Worker settings
   and restore `SUBMISSION_MODE=public`, `SUBMISSIONS_DISABLED=false` only if submissions
   are intended to remain open. Never check secrets into the repository. In the public
   `submission-config.js`, set the HTTPS Worker URL ending in `/submit` and the public
   Turnstile Site Key.
6. Verify CORS and protection with invalid requests **before** activating the frontend.
   Only submit actual question reports after successful end-to-end testing.
   Any manual test Issues must be clearly marked as tests and closed without approval.

## Security posture

- Exact-origin CORS for the two production domains (no wildcard/preview hosts), with the verified Turnstile hostname matched against each request's own origin and action validation;
  the Worker also checks token server-side with Siteverify. The endpoint is opt-in: `SUBMISSIONS_DISABLED` must be explicitly `false`.
- Cloudflare native binding limits attempted POSTs to **3 per 60 seconds per IP
  at each edge location**. This is approximate/edge-local, not a globally strict quota.
- Request body is streamed with a **24 KiB (24,576 bytes)** cap; text lengths, types and
  allowed source/term values are validated. Requests fail closed if secrets,
  limiter or external verification are unavailable.
- No DB, no submitted attachments, no contact details requested, no visitor IP
  stored in Issues. GitHub Issues are **public**, including unapproved entries.
- A malicious actor may still attempt automated abuse; rotate the GitHub PAT,
  monitor Worker usage, and toggle `SUBMISSIONS_DISABLED` when needed.

## Interface

`POST /submit` accepts **v2 submissions** from the current website:

- **Question:** `version: 2`, `kind: "question"`, `term` (e.g. `2026 Fall`),
  `examStage` (`start` / `mid` / `end`), bilingual `main: {en, cn}`,
  optional bilingual `subs: [{en, cn}]`, `source` (`firsthand` / `secondhand`),
  and `turnstileToken`.
- **Preparation advice:** `version: 2`, `kind: "advice"`, `phase`
  (`before` / `during` / `after`), `tags` (1–4 predefined taxonomy tags),
  `title`, `body`, and `turnstileToken`.
- **Legacy v1 compatibility:** `term`, `question`, `subquestions`, `source`,
  and `turnstileToken`. The time-bounded `test` mode accepts only its exact
  allowlisted legacy payload; it does not accept v2 submissions.

Successful response: HTTP 201 `{"ok":true,"issueUrl":"..."}`. The Issue
contains readable Markdown and a base64url machine-readable marker
(`elpa-submission-v1` or `elpa-submission-v2`). Both versions enter the
same `submission:pending` review queue. Unapproved Issues are never added
straight to the question bank.

## Verified provisioned resources (2026-10-14)

- Worker: `hkust-elpa-submissions`; endpoint `https://hkust-elpa-submissions.futseyi.workers.dev/submit`
- Turnstile widget: `HKUST-ELPA Question Submissions`, hostnames `futseyi.github.io` and `hkust-elpa.vercel.app`
- Public Turnstile Site Key: `0x4AAAAAAFWWsgbB9w0JPOm3` (safe to publish)
- Turnstile secret: bound to Worker (never commit or paste it)
- Rate limiter: `SUBMISSION_LIMITER`, namespace `11247601`, 3 requests / 60 seconds per IP per Cloudflare location
- Worker plaintext switch: production uses `SUBMISSION_MODE=public` and `SUBMISSIONS_DISABLED=false`; repository Wrangler defaults stay closed to prevent accidental public re-enablement.
- GitHub token: configured as encrypted Worker Secret `GITHUB_TOKEN`; its value is never committed
- Old Worker public endpoint disabled; historical script retained
- GitHub repository is `FuTseYi/HKUST-ELPA`; moderation labels and Actions PR-creation permission have been configured by the owner
- Existing `visit-counter` Worker is unaffected; keep all development branches after merges

**Production status**: The GitHub Pages form completed real Turnstile-to-Issue testing (test Issue #13, closed); the owner-approved Issue-to-PR automation was separately verified (test Issue #9 / PR #10, closed). The Vercel form requires a final live-browser verification after its domain has been added to the widget and the Worker deployed. Never merge test questions into the bank. To stop submissions immediately, set `SUBMISSIONS_DISABLED=true` in Cloudflare.


## Time-bounded live verification

The Worker accepts submissions only when `SUBMISSIONS_DISABLED=false` **and**
`SUBMISSION_MODE` is explicitly `test` or `public`.

For a controlled browser smoke test, set:

- `SUBMISSION_MODE=test`
- `SUBMISSION_TEST_DEADLINE_MS`: an absolute **13-digit Unix timestamp in milliseconds**.
  All submissions automatically fail after this time, regardless of other settings.
- `SUBMISSION_TEST_QUESTION`: the exact synthetic question to permit.
- `SUBMISSIONS_DISABLED=false` only after verifying the deadline and allowlist.

During test mode, the Worker rejects all other questions; the permitted question
must use `term=2026 Fall`, empty `subquestions`, and `source=firsthand`.
It still requires Turnstile Siteverify, rate limiting and a functioning GitHub
Issue token. Clearly label the test question as **TEST ONLY / DO NOT PUBLISH**.
Close any test Issue / generated PR without merging. Keep the test branch for
development traceability.

For immediate rollback set `SUBMISSIONS_DISABLED=true` and
`SUBMISSION_MODE=closed`. **Production launch must be deliberate**:
`SUBMISSION_MODE=public` together with `SUBMISSIONS_DISABLED=false`.
Never enable the public mode as part of this test.
