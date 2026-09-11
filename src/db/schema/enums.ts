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
import { CONSENT_STATUSES, CONSENT_TYPES } from "@/domain/consent";
import { ELIGIBILITY_STATUSES, ENROLLMENT_STATUSES } from "@/domain/participant-state";
import { SCREENING_STATUSES } from "@/domain/screening";
import { COHORT_STATUSES } from "@/domain/cohort";
import { ALLOCATION_METHODS } from "@/domain/randomization";
import {
  ATTENDANCE_STATUSES,
  SESSION_MODALITIES,
  SESSION_STATUSES,
} from "@/domain/session";
import { CONTENT_STATUSES, CONTENT_TYPES } from "@/domain/content";
import { ELIGIBILITY_REASON_CATEGORIES } from "@/domain/eligibility-reason";
import { RESPONSIBILITY_ROLES, VISIT_STATUSES } from "@/domain/responsibility";
import {
  INTAKE_TARGETS,
  INTEGRATION_MODES,
  QUALTRICS_FIELD_CLASSES,
} from "@/domain/intake";

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

// Participant operations (Phase 2, migration 0003)
export const eligibilityStatusEnum = pgEnum("eligibility_status", ELIGIBILITY_STATUSES);
export const enrollmentStatusEnum = pgEnum("enrollment_status", ENROLLMENT_STATUSES);
export const screeningStatusEnum = pgEnum("screening_status", SCREENING_STATUSES);
export const consentStatusEnum = pgEnum("consent_status", CONSENT_STATUSES);

// Cohorts and allocation (Phase 3a, migration 0004)
export const cohortStatusEnum = pgEnum("cohort_status", COHORT_STATUSES);
export const allocationMethodEnum = pgEnum("allocation_method", ALLOCATION_METHODS);

// Sessions and attendance (Phase 3b, migration 0005)
export const sessionModalityEnum = pgEnum("session_modality", SESSION_MODALITIES);
export const sessionStatusEnum = pgEnum("session_status", SESSION_STATUSES);
export const attendanceStatusEnum = pgEnum("attendance_status", ATTENDANCE_STATUSES);

// Study content (Phase 5, migration 0006)
export const contentTypeEnum = pgEnum("content_type", CONTENT_TYPES);
export const contentStatusEnum = pgEnum("content_status", CONTENT_STATUSES);

// Intake boundary and eligibility reasons (Phase 4a, migration 0007)
export const eligibilityReasonCategoryEnum = pgEnum(
  "eligibility_reason_category",
  ELIGIBILITY_REASON_CATEGORIES,
);
export const qualtricsFieldClassEnum = pgEnum("qualtrics_field_class", QUALTRICS_FIELD_CLASSES);
export const intakeTargetEnum = pgEnum("intake_target", INTAKE_TARGETS);
export const integrationModeEnum = pgEnum("integration_mode", INTEGRATION_MODES);

// Consent types and scopes (Phase 4b, migration 0008)
export const consentTypeEnum = pgEnum("consent_type", CONSENT_TYPES);

// Responsibles and the initial visit (Phase 4d, migration 0010)
export const responsibilityRoleEnum = pgEnum("responsibility_role", RESPONSIBILITY_ROLES);
export const visitStatusEnum = pgEnum("visit_status", VISIT_STATUSES);
