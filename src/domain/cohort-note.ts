/**
 * Sticky notes on a cohort's workspace (2026-09-19 request): a place for the
 * team to leave quick reminders ("remember the Zoom link changed", "David
 * still needs a new headset") that don't belong in the audited task
 * checklist — a note is never a research or permission-relevant change, just
 * a shared scratchpad, so it carries no status/priority/assignment workflow.
 *
 * Colours are the same four pastel surface tones the rest of the UI already
 * uses (`--surface-lilac/peach/mint/sky` in globals.css), not a new palette.
 */
export const NOTE_COLORS = ["LILAC", "PEACH", "MINT", "SKY"] as const;
export type NoteColor = (typeof NOTE_COLORS)[number];

export const NOTE_BODY_MAX_LENGTH = 280;
