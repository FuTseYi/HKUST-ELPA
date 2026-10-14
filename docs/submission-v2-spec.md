# HKUST-ELPA · Contribution v2 specification

**Status:** accepted product design; deployment is staged. This document does not imply the v2 API is live.

## Product principles

- Submission is structured; maintainer reviews substance, not translation, formatting or tagging.
- Question submissions require **both English and Chinese** for the main question and each submitted follow-up. No English-text-provenance checkbox.
- Follow-ups are optional and dynamically added, removed and ordered; if provided, both language fields are required. Initial count is zero, not three, and cap is 20.
- Preparation advice uses **a single-language required title and body**, regardless of the site's interface language. No compulsory translation.
- All categories use fixed codes with bilingual labels in `question-bank/taxonomy.js`. No free-form categories.
- Placeholders are **short, professional and non-repetitive**; length limits, privacy notes and instructions belong in labels, helper text or errors—not placeholder prose.
- The new question form requires a year and one of six Spring/Fall × start/mid/end slots. No “unknown stage” option for **new** reports. Historic records without evidence of a stage remain unclassified.
- English speaking practice stays English-first; Chinese translations, including follow-up translations, appear **only on click**. UI language is independent of translation visibility.
- Exam stages are different from preparation-advice phases. Never conflate them.

## Canonical submission records (v2)

Question:
```json
{
  "version": 2,
  "kind": "question",
  "term": "2026 Fall",
  "examStage": "mid",
  "main": {"en": "What was your first impression of HKUST(GZ)?", "cn": "你初到港科广的第一印象是什么？"},
  "subs": [{"en": "What impressed you the most?", "cn": "什么让你印象最深？"}],
  "source": "firsthand"
}
```

Advice:
```json
{
  "version": 2,
  "kind": "advice",
  "phase": "before",
  "tags": ["speaking-strategy"],
  "title": "我的口语备考建议",
  "body": "以自己的研究经历准备可灵活调整的例子。"
}
```

Submission envelope also contains the short-lived Turnstile token. It is **never** embedded in Issues or stored in the question bank.

Recommended rules: question en 8–1000 characters, cn 4–1000, follow-up en/cn 1–400 each, up to 20 subquestions; advice title 4–120, body 20–6000; 1–4 taxonomy tags. Cap full UTF-8 request body to a safe explicit size (e.g. 24 KiB); enforce limits in both browser and Worker and repeat validation in importer. No private fields or file uploads.

## Approval and archive rules

1. Strict two-origin CORS, source-matching Turnstile hostname/action, per-edge rate limiter, secrets and kill switch remain unchanged.
2. A **public** GitHub Issue stores human-readable fields plus `elpa-submission-v2:<base64url>` structured payload. Do not expose tokens, IPs or credentials.
3. Maintain backwards compatibility with `elpa-submission-v1`; old pending Issues must remain approvable.
4. Import approved v2 reports by trusted repository code only. Only the owner can trigger label-based approval. Generation of a data PR must **not** automatically merge it.
5. A new question receives a stable ID. An exact existing question reported in another term/slot should **record that appearance** and retain the existing ID, not create a duplicate card or discard the term. More ambiguous similarity remains for maintainer review.
6. Existing learning records use stable question IDs and positional follow-up note keys. **Do not reorder existing published follow-ups** without an explicit note-key migration. New questions may use the contributor's order.
7. Each approved advice report becomes one separately indexed article with its phase and standard tags. The raw text language is preserved; UI tag labels can be localized.
8. Existing community `cn` entries contain mixtures of translation and provenance. Before adding “show Chinese” controls, split **confirmed translation** from source notes; never present provenance as a translation or silently invent a verified translation.
9. Existing older questions without stage or translation remain usable. New v2 reports require all fields; do not fabricate old data.
10. Both Vercel and GitHub Pages use the same static files; practice notes remain browser-origin-local with existing backup/restore support.

## Placeholder copy

| Input | Placeholder |
| --- | --- |
| Main English | Enter the question in English |
| Main Chinese | 填写主问题的中文表述 |
| Follow-up English | Enter the follow-up in English |
| Follow-up Chinese | 填写对应的中文小问 |
| Advice title | 填写经验标题 |
| Advice content | 分享具体方法或经验 |
| Search | 搜索题目 |

Placeholders are hints, **not field labels**. Required status, accessibility labels and error messages must remain visible without placeholders.

## Release and acceptance gates

- **PR 1:** contract and taxonomy only; no production workflow change.
- **PR 2:** v1/v2 importer and tested data storage; no public v2 form.
- **PR 3:** v2 Worker acceptance deployed only after validation; retain v1 compatibility and active public switches.
- **PR 4:** form and practice/guide UI update after Worker deploy; exercise responsive and keyboard access.
- **Final smoke:** both domains × question/advice submissions (synthetic), verify actual Issues, owner approval-to-PR for both types, no auto-merge; close synthetic Issues/PRs without merging data; retain all development branches.
- CI must test missing translations, multi-follow-up, unknown taxonomy tags, oversized UTF-8 payload, CORS, Turnstile action/hostname, original v1 submissions, duplicate multi-term preservation, page rendering and old notebook backup/restore.
