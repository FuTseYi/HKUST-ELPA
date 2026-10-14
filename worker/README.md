# ELPA submission Worker (stage 2)

This **separate Cloudflare Worker** accepts anonymous submissions from
`https://futseyi.github.io/HKUST-ELPA/submit.html` and creates a **public GitHub Issue**.
It does **not** edit website files or publish a question. Maintainer review remains mandatory.

## Deploy prerequisites

1. Create a Cloudflare Turnstile widget restricted to hostname **futseyi.github.io**.
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
5. Deploy with `npx wrangler deploy`. In the public `submission-config.js`,
   fill in the deployed **https** Worker URL ending in `/submit` and public Turnstile Site Key.
6. Verify CORS and protection with invalid requests **before** activating the frontend.
   Only submit actual question reports after successful end-to-end testing.
   Any manual test Issues must be clearly marked as tests and closed without approval.

## Security posture

- Exact-origin CORS, exact Turnstile hostname and action validation;
  the Worker also checks token server-side with Siteverify. The endpoint is opt-in: `SUBMISSIONS_DISABLED` must be explicitly `false`.
- Cloudflare native binding limits attempted POSTs to **3 per 60 seconds per IP
  at each edge location**. This is approximate/edge-local, not a globally strict quota.
- Request body is streamed with a 16 KiB cap; text lengths, types and
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

## Verified provisioned resources (2026-10-14)

- Worker: `hkust-elpa-submissions`; endpoint `https://hkust-elpa-submissions.futseyi.workers.dev/submit`
- Turnstile widget: `HKUST-ELPA Question Submissions`, hostname `futseyi.github.io`
- Public Turnstile Site Key: `0x4AAAAAAFWWsgbB9w0JPOm3` (safe to publish)
- Turnstile secret: bound to Worker (never commit or paste it)
- Rate limiter: `SUBMISSION_LIMITER`, namespace `11247601`, 3 requests / 60 seconds per IP per Cloudflare location
- Worker plaintext switch: `SUBMISSIONS_DISABLED=true` (submission remains closed)
- GitHub token: configured as encrypted Worker Secret `GITHUB_TOKEN`; its value is never committed
- Old Worker public endpoint disabled; historical script retained
- GitHub repository is `FuTseYi/HKUST-ELPA`; moderation labels and Actions PR-creation permission have been configured by the owner
- Existing `visit-counter` Worker is unaffected; keep all development branches after merges

**Pending**: verify external health endpoint, browser Turnstile flow, rejected/valid submissions,
GitHub Issues, label-triggered PR, and the final GitHub Pages path after deploying the merged code.
Do not remove the kill switch until these checks pass.
