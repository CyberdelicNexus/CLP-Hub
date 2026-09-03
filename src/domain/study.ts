export const STUDY_STATUSES = ["DRAFT", "ACTIVE", "PAUSED", "CLOSED", "ARCHIVED"] as const;
export type StudyStatus = (typeof STUDY_STATUSES)[number];
