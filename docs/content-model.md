# Content model (implemented in Phase 5 · migration 0006)

Two separate systems:

| | UI strings | Study content |
|---|---|---|
| Examples | Menu labels, buttons, status names | Session preparation, integration, VR guide, FAQ, email/WhatsApp templates |
| Where | `messages/es.json`, `messages/en.json` | Database (`contents`, `content_versions`) |
| Versioned | By git | Explicitly, per locale, never overwritten |
| Language | ES + EN | ES authoritative; EN optional for staff preview |

## Public content pages

Participants do not log in (D-003). Study content is published as blog-style Spanish pages, e.g. `/estudio/sesiones/<session-key>/preparacion` and `/estudio/sesiones/<session-key>/integracion`, `/estudio/preparacion-vr`, `/estudio/ayuda`. Pages contain **no participant-specific data**. Links to them are what emails and WhatsApp messages point to, so the page is the canonical source and messages stay short.

## Tables

- `contents` — `study_id`, `type` (SESSION_PREPARATION, SESSION_INTEGRATION, VR_GUIDE, TROUBLESHOOTING, FAQ, EMAIL_TEMPLATE, WHATSAPP_TEMPLATE), `key`, and a nullable `session_template_id` foreign key for session material (D-029).
- `content_versions` — `content_id`, `locale`, `version_number`, `title`, `body`, `status` (DRAFT, REVIEW, PUBLISHED, ARCHIVED), `created_by`, `approved_by`, `published_at`.

Body format: a JSON array of typed blocks (TEXT, VIDEO, IMAGE, CHECKLIST, CALLOUT, CONTEMPLATION, BUTTON, TECHNICAL_STEP, SUPPORT_BOX). Not a page builder.

Text-bearing blocks carry a small Markdown subset — bold, italic, inline code, links, paragraphs, lists. It is parsed to a typed token tree and rendered as React elements: **no HTML string is ever produced**, so there is no sanitiser in the path and raw HTML an author types appears as literal text (D-027). Link and media URLs are scheme-checked on save and on render.

Authors currently edit the block JSON with live validation and a preview; a block-by-block editor is a follow-up (D-029).

## Rules

- Publishing creates a new version and archives the previous published one; it never mutates a published row.
- A communication stores the `content_version_id` it used.
- A cohort session records which published version was active at session time so "which version did Cohort 04 receive?" is answerable.
- Session names ("Vida", etc.) are `session_templates` rows; content keys reference them, not code.
