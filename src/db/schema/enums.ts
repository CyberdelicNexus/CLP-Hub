import { pgEnum } from "drizzle-orm/pg-core";
import { STAFF_ROLES } from "@/domain/roles";
import { STUDY_STATUSES } from "@/domain/study";
import { LOCALES } from "@/domain/locale";

// Postgres enum names must match supabase/migrations/0001_foundation.sql
export const staffRoleEnum = pgEnum("staff_role", STAFF_ROLES);
export const studyStatusEnum = pgEnum("study_status", STUDY_STATUSES);
export const uiLocaleEnum = pgEnum("ui_locale", LOCALES);
export const auditActorTypeEnum = pgEnum("audit_actor_type", ["STAFF", "SYSTEM", "PARTICIPANT"]);
