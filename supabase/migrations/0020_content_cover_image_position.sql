-- =============================================================================
-- CLP Hub · Migration 0020 · Content cover image Y position (2026-09-19 request)
-- Adds: content_versions.cover_image_position
--
-- A 0-100 vertical crop focus for the cover image banner (migration 0019) —
-- "keep the image centred, but add an option to reposition in the Y axis".
-- 50 is centred, matching the plain `object-position: center` the banner
-- used before this field existed.
-- =============================================================================

alter table content_versions
  add column if not exists cover_image_position integer not null default 50;

alter table content_versions
  add constraint content_versions_cover_position_range
  check (cover_image_position between 0 and 100);
