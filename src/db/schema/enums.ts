import { pgEnum } from "drizzle-orm/pg-core";
import { STAFF_ROLES } from "@/domain/roles";
import { STUDY_STATUSES } from "@/domain/study";
import { LOCALES } from "@/domain/locale";
import {
  APPLICATION_SOURCES,
  APPLICATION_STATUSES,
  QUESTION_TYPES,
  RECRUITMENT_STATUSES,
} from "@/domain/recruitment";

// Postgres enum names must match supabase/migrations/0001_foundation.sql
export const staffRoleEnum = pgEnum("staff_role", STAFF_ROLES);
export const studyStatusEnum = pgEnum("study_status", STUDY_STATUSES);
export const uiLocaleEnum = pgEnum("ui_locale", LOCALES);
export const auditActorTypeEnum = pgEnum("audit_actor_type", ["STAFF", "SYSTEM", "PARTICIPANT"]);

// Recruitment (Phase 1, migration 0002)
export const recruitmentStatusEnum = pgEnum("recruitment_status", RECRUITMENT_STATUSES);
export const applicationStatusEnum = pgEnum("application_status", APPLICATION_STATUSES);
export const applicationSourceEnum = pgEnum("application_source", APPLICATION_SOURCES);
export const questionTypeEnum = pgEnum("question_type", QUESTION_TYPES);
