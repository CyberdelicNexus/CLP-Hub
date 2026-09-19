-- =============================================================================
-- CLP Hub · Migration 0019 · Content cover image (2026-09-19 request)
-- Adds: content_versions.cover_image_url
--
-- An optional banner image for a published page — a version-level field, not
-- a block: it sits above the title, not in the body flow, and there is only
-- ever one per version. Validated as a safe URL at the application layer
-- (domain/markdown.ts's isSafeHref), same as every other author-supplied URL
-- in a content block.
-- =============================================================================

alter table content_versions add column if not exists cover_image_url text;
