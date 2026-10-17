# HKUST-ELPA · Contribution v2 specification

**Status:** v2 is in production; this document describes the backward-compatible contribution and review contract.

## Product principles

- Submission is structured; maintainer reviews substance, not translation, formatting or tagging.
- Question submissions require the remembered English main question; Chinese translations are optional. Each submitted follow-up requires English, while Chinese is optional. Never manufacture a missing translation.
- Follow-ups are optional and dynamically added, removed and ordered; if provided, English text is required. Initial count is zero and cap is 20.
- Preparation advice uses **a single-language required title and body**, regardless of the site's interface language. No compulsory translation.
- Advice may include `track` (`regular` or `fast-track`); older submissions without it belong to Regular. The guide shows reviewed advice for the selected track and offers a Fast Track sharing link when that track is empty.
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
  "track": "regular",
  "phase": "before",
  "tags": ["speaking-strategy"],
  "title": "我的口语备考建议",
  "body": "以自己的研究经历准备可灵活调整的例子。"
}
```

Submission envelope also contains the short-lived Turnstile token. It is **never** embedded in Issues or stored in the question bank.

Recommended rules: question en 8–1000 characters, cn 0–1000, follow-up en 1–400, cn 0–400, up to 20 subquestions; advice title 4–120, body 20–6000; 1–4 taxonomy tags. Cap full UTF-8 request body to a safe explicit size (e.g. 24 KiB); enforce limits in both browser and Worker and repeat validation in importer. No private fields or file uploads.

## Linked question and exam-occurrence counting

- `linkedQuestionId` is optional for new questions. When present, `intent` is either `encounter` (one additional reported experience) or `supplement` (no new exam occurrence; must include alternative wording or at least one follow-up).
- The Worker validates the payload; the importer checks that the ID actually exists in the selected campus/track bank **and** matches the canonical English text. Legacy v2 records without these fields are still treated as encounters.
- Existing baseline student recollections contribute one historic occurrence, or the known sourced `records` count. For imported questions, the originating Issue is counted once, not both as a baseline and a new Issue.
- Individual reviewed Issue numbers count once, regardless of the number of follow-ups or whether the same term/slot appears elsewhere. Human reviewers should decline duplicate retellings of the very same encounter.
- Follow-up supplements are stored as reviewed appearance metadata and displayed on the question card after merging the approved PR. No new account, database, or high-frequency filter is introduced.

## Approval and archive rules

1. Strict two-origin CORS, source-matching Turnstile hostname/action, per-edge rate limiter, secrets and kill switch remain unchanged.
2. A **public** GitHub Issue stores human-readable fields plus `elpa-submission-v2:<base64url>` structured payload. Do not expose tokens, IPs or credentials.
3. Maintain backwards compatibility with `elpa-submission-v1`; old pending Issues must remain approvable.
4. Import approved v2 reports by trusted repository code only. Only the owner can trigger label-based approval. Generation of a data PR must **not** automatically merge it.
5. A new question receives a stable ID. An exact existing question reported in another term/slot should **record that appearance** and retain the existing ID, not create a duplicate card or discard the term. More ambiguous similarity remains for maintainer review.
6. Existing learning records use stable question IDs and positional follow-up note keys. **Do not reorder existing published follow-ups** without an explicit note-key migration. New questions may use the contributor's order.
7. Each approved advice report becomes one separately indexed article with its phase and standard tags. The raw text language is preserved; UI tag labels can be localized.
8. Existing community `cn` entries contain mixtures of translation and provenance. Before adding “show Chinese” controls, split **confirmed translation** from source notes; never present provenance as a translation or silently invent a verified translation.
9. Existing older questions without stage or translation remain usable. New v2 reports require the English original and session metadata, but do not force translations; do not fabricate old data.
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

## Historical rollout and release acceptance

The PR sequence below records the original v2 rollout plan. For routine maintenance,
run `npm run check`, `npm test` and `npm run test:browser`; deployments still need the
separate production verification described below.

- **PR 1:** contract and taxonomy only; no production workflow change.
- **PR 2:** v1/v2 importer and tested data storage; no public v2 form.
- **PR 3:** v2 Worker acceptance deployed only after validation; retain v1 compatibility and active public switches.
- **PR 4:** form and practice/guide UI update after Worker deploy; exercise responsive and keyboard access.
- **Final smoke:** both domains × question/advice submissions (synthetic), verify actual Issues, owner approval-to-PR for both types, no auto-merge; close synthetic Issues/PRs without merging data; retain all development branches.
- CI tests optional translations, linked-ID validation, supplement-only counting, dynamic followups, taxonomy, size, CORS, Turnstile, v1 imports, multi-term deduplication, rendering and notebook backup/restore.
