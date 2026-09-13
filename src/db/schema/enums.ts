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
import { DEVICE_STATUSES, INCIDENT_KINDS, VR_READINESS_STATES } from "@/domain/logistics";
import {
  COMMUNICATION_AUDIENCES,
  COMMUNICATION_CHANNELS,
  COMMUNICATION_STAGES,
  COMMUNICATION_STATUSES,
} from "@/domain/communication";
import {
  ACTION_KINDS,
  ALERT_KINDS,
  ALERT_SEVERITIES,
  ALERT_STATUSES,
  DELIVERY_MODES,
  EVENT_TYPES,
  SCHEDULED_ACTION_STATUSES,
  SUBJECT_KINDS,
  TASK_ORIGINS,
  TASK_PRIORITIES,
  TASK_STATUSES,
} from "@/domain/automation";
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

// VR logistics (Phase 6, migration 0011)
export const deviceStatusEnum = pgEnum("device_status", DEVICE_STATUSES);
export const vrReadinessEnum = pgEnum("vr_readiness", VR_READINESS_STATES);
export const incidentKindEnum = pgEnum("incident_kind", INCIDENT_KINDS);

// Communications (Phase 7, migration 0012)
export const communicationStageEnum = pgEnum("communication_stage", COMMUNICATION_STAGES);
export const communicationChannelEnum = pgEnum("communication_channel", COMMUNICATION_CHANNELS);
export const communicationStatusEnum = pgEnum("communication_status", COMMUNICATION_STATUSES);

// Audience (Phase 7b, migration 0014)
export const communicationAudienceEnum = pgEnum("communication_audience", COMMUNICATION_AUDIENCES);

// Automation (Phase 8, migration 0015)
export const automationEventTypeEnum = pgEnum("automation_event_type", EVENT_TYPES);
export const automationSubjectKindEnum = pgEnum("automation_subject_kind", SUBJECT_KINDS);
export const automationActionKindEnum = pgEnum("automation_action_kind", ACTION_KINDS);
export const automationDeliveryModeEnum = pgEnum("automation_delivery_mode", DELIVERY_MODES);
export const scheduledActionStatusEnum = pgEnum(
  "scheduled_action_status",
  SCHEDULED_ACTION_STATUSES,
);
export const taskStatusEnum = pgEnum("task_status", TASK_STATUSES);
export const taskPriorityEnum = pgEnum("task_priority", TASK_PRIORITIES);
export const taskOriginEnum = pgEnum("task_origin", TASK_ORIGINS);
export const alertKindEnum = pgEnum("alert_kind", ALERT_KINDS);
export const alertSeverityEnum = pgEnum("alert_severity", ALERT_SEVERITIES);
export const alertStatusEnum = pgEnum("alert_status", ALERT_STATUSES);
