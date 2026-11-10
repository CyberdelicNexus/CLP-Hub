-- =============================================================================
-- CLP Hub · Migration 0033 · Where a headset is (2026-10-30 request, D-143)
-- Columns: devices.location_label, location_lat, location_lng, location_updated_at
--
-- A headset out with a participant is at their home, so this is Category A
-- location data (docs/research-data-boundaries.md). It is cleared when the
-- headset comes back, and never copied into an audit snapshot.
-- =============================================================================

alter table devices
  add column if not exists location_label text,
  add column if not exists location_lat double precision,
  add column if not exists location_lng double precision,
  add column if not exists location_updated_at timestamptz;

alter table devices drop constraint if exists devices_location_pin_complete;
alter table devices add constraint devices_location_pin_complete
  check ((location_lat is null) = (location_lng is null));

alter table devices drop constraint if exists devices_location_pin_range;
alter table devices add constraint devices_location_pin_range
  check (
    location_lat is null
    or (location_lat between -90 and 90 and location_lng between -180 and 180)
  );

alter table devices drop constraint if exists devices_location_label_length;
alter table devices add constraint devices_location_label_length
  check (location_label is null or char_length(location_label) <= 160);
