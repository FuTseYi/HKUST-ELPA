# ELPA submission Worker (stage 2)

This **separate Cloudflare Worker** accepts anonymous submissions from
`https://futseyi.github.io/HKUST-GZ-ELPA/submit.html` and creates a **public GitHub Issue**.
It does **not** edit website files or publish a question. Maintainer review remains mandatory.

## Deploy prerequisites

1. Create a Cloudflare Turnstile widget restricted to hostname **futseyi.github.io**.
   Use action **elpa_submit**. Keep the Site Key public; keep the Secret private.
2. Use Wrangler 4.36+ in `worker/`. Edit `wrangler.jsonc`'s `namespace_id`
   to an account-unique positive integer string (example value `1001` is provisional).
3. Create a **fine-grained GitHub PAT** restricted to only
   `FuTseYi/HKUST-GZ-ELPA`, permission **Issues: Read and write**;
   no Contents/Actions/Admin permissions. Store it only as a Worker secret.
4. Configure Worker secrets via:
   - `npx wrangler secret put TURNSTILE_SECRET`
   - `npx wrangler secret put GITHUB_TOKEN`
   Optional kill switch (plaintext Worker environment variable):
   `SUBMISSIONS_DISABLED=true` disables POST submissions.
5. Deploy with `npx wrangler deploy`. In the public `submission-config.js`,
   fill in the deployed **https** Worker URL ending in `/submit` and public Turnstile Site Key.
6. Verify CORS and protection with invalid requests **before** activating the frontend.
   Only submit actual question reports after successful end-to-end testing.
   Any manual test Issues must be clearly marked as tests and closed without approval.

## Security posture

- Exact-origin CORS, exact Turnstile hostname and action validation;
  the Worker also checks token server-side with Siteverify.
- Cloudflare native binding limits attempted POSTs to **3 per 60 seconds per IP
  at each edge location**. This is approximate/edge-local, not a globally strict quota.
- Request body is streamed with a 6.5 KB cap; text lengths, types and
  allowed source/term values are validated. Requests fail closed if secrets,
  limiter or external verification are unavailable.
- No DB, no submitted attachments, no contact details requested, no visitor IP
  stored in Issues. GitHub Issues are **public**, including unapproved entries.
- A malicious actor may still attempt automated abuse; rotate the GitHub PAT,
  monitor Worker usage, and toggle `SUBMISSIONS_DISABLED` when needed.

## Interface

`POST /submit` with JSON keys:
`term`, `question`, `subquestions`, `source` (`firsthand` / `secondhand`),
and `turnstileToken`. Successful response: HTTP 201 `{"ok":true,"issueUrl":"..."}`.

The Issue includes readable Markdown and a base64url machine-readable marker
(`elpa-submission-v1`) for the stage-3 review workflow. Unapproved Issues are
never added to the question bank.


## Deployment status (2026-10-14)

- Cloudflare account: `FuTseYi`.
- Worker script: `hkust-gz-elpa-submissions`.
- Worker URL: `https://hkust-gz-elpa-submissions.futseyi.workers.dev/submit`.
- Turnstile widget: `HKUST-GZ ELPA Question Submissions`.
- Public Site Key: `0x4AAAAAAFWWsgbB9w0JPOm3`.
- Server-side `TURNSTILE_SECRET`: **configured** as a Worker Secret.
- `SUBMISSIONS_DISABLED=true`: **configured** (submission endpoint remains closed).
- `GITHUB_TOKEN`: **not configured yet**; requires an owner-created fine-grained PAT.
- Public `submission-config.js`: deliberately left disabled pending protected end-to-end tests.
- The existing `visit-counter` Worker was not altered.
- All feature branches should be retained after merging PRs (do not delete PR heads).

**Not yet verified:** external `/health` reachability, live Turnstile
Siteverify, GitHub issue creation, and approved-issue import end-to-end.
Never set `SUBMISSIONS_DISABLED=false` until these tests pass.
