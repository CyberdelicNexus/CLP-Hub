"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getStaffSession } from "@/auth/session";
import { createSupabaseServerClient } from "@/auth/supabase/server";
import { isLocale } from "@/domain/locale";
import { TEAM_BASE_PATH } from "@/domain/navigation";
import { LOCALE_COOKIE, PREFERENCE_COOKIE_OPTIONS, STUDY_COOKIE } from "@/i18n/cookies";
import { logger } from "@/lib/logger";
import { updatePreferredLocale } from "@/services/staff";

const LOGIN_PATH = `${TEAM_BASE_PATH}/login`;

export type LoginState = { error: "invalid" | "inactive" | "unavailable" | null };

const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(256),
});

export async function signIn(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: "invalid" };

  const supabase = await createSupabaseServerClient();
  let signInError: { code?: string; name: string } | null = null;
  try {
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    signInError = error;
  } catch (err) {
    logger.error({ event: "auth.provider_unavailable", err: err instanceof Error ? err.message : String(err) }, "auth provider unreachable");
    return { error: "unavailable" };
  }
  if (signInError) {
    logger.info({ event: "auth.login_failed", reason: signInError.code ?? signInError.name }, "login failed");
    return { error: "invalid" };
  }

  const session = await getStaffSession();
  if (!session) {
    // Authenticated in Supabase but no active staff profile: refuse access.
    await supabase.auth.signOut();
    logger.warn({ event: "auth.login_inactive" }, "login refused: no active staff profile");
    return { error: "inactive" };
  }

  const store = await cookies();
  store.set(LOCALE_COOKIE, session.preferredLocale, PREFERENCE_COOKIE_OPTIONS);
  logger.info({ event: "auth.login", userId: session.userId }, "staff signed in");
  redirect(TEAM_BASE_PATH);
}

export async function signOut(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  const store = await cookies();
  store.delete(STUDY_COOKIE);
  redirect(LOGIN_PATH);
}

export async function setLocale(value: string): Promise<void> {
  if (!isLocale(value)) return;
  const store = await cookies();
  store.set(LOCALE_COOKIE, value, PREFERENCE_COOKIE_OPTIONS);

  const session = await getStaffSession();
  if (session) await updatePreferredLocale(session.userId, value);

  revalidatePath("/", "layout");
}

export async function setActiveStudy(studyId: string): Promise<void> {
  const session = await getStaffSession();
  if (!session) return;
  const allowed = session.memberships.some((m) => m.studyId === studyId);
  if (!allowed) return;

  const store = await cookies();
  store.set(STUDY_COOKIE, studyId, PREFERENCE_COOKIE_OPTIONS);
  revalidatePath(TEAM_BASE_PATH, "layout");
}
