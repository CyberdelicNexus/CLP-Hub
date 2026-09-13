import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getStudyContext } from "@/auth/study-context";
import { NoAccess } from "@/components/team/no-access";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PERMISSIONS, permissionsForRoles } from "@/domain/permissions";
import { STAFF_ROLES } from "@/domain/roles";
import { listStaffWithoutRole, listStudyMembers } from "@/services/staff";
import { GrantRoleForm, RevokeRoleForm } from "./team-forms";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("team") };
}

/**
 * Team and roles.
 *
 * WHAT THIS PAGE CANNOT DO: create a login. Staff accounts live in Supabase
 * Auth (D-044). Someone is invited there, appears here once they exist, and is
 * then granted a role — which is the part this application owns and audits.
 *
 * Each member's row shows what their roles actually let them do, derived from
 * `permissionsForRoles` rather than restated here. The permission matrix is the
 * single source of truth (CLAUDE.md rule 8), and a screen that listed
 * capabilities in its own words would drift from it within a release.
 *
 * A revoked grant is never deleted, so this list is "who can do what today" and
 * the audit log answers "who could in March".
 */
export default async function TeamPage() {
  const ctx = await getStudyContext();
  if (!ctx) return null;

  const t = await getTranslations();
  if (!ctx.permissions.has("team.read")) {
    return <NoAccess message={t("common.noAccess")} />;
  }

  const canManage = ctx.permissions.has("team.manage");

  const [members, candidates] = await Promise.all([
    listStudyMembers(ctx.study.id),
    canManage ? listStaffWithoutRole(ctx.study.id) : [],
  ]);

  const labels = {
    submit: t("common.save"),
    submitting: t("common.loading"),
    errors: {
      forbidden: t("team.errors.forbidden"),
      invalid: t("team.errors.invalid"),
      notFound: t("team.errors.notFound"),
      duplicate: t("team.errors.duplicate"),
      failed: t("team.errors.failed"),
    },
  };

  // Everyone who could be granted something: people with no role yet, plus
  // people who already have one — roles are not exclusive, and a facilitator may
  // also need logistics.
  const people = [
    ...candidates.map((c) => ({ value: c.id, label: `${c.displayName} · ${c.email}` })),
    ...members.map((m) => ({ value: m.userId, label: `${m.displayName} · ${m.email}` })),
  ];

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("nav.team")}</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">{t("team.subtitle")}</p>
      </header>

      <p className="rounded-xl bg-surface-sky px-4 py-3 text-xs leading-relaxed text-surface-sky-ink">
        {t("team.accountsNote")}
      </p>

      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("team.grant")}</CardTitle>
          </CardHeader>
          <CardContent>
            <GrantRoleForm
              people={people}
              roles={STAFF_ROLES.map((r) => ({ value: r, label: t(`roles.${r}`) }))}
              labels={{
                ...labels,
                submit: t("team.grant"),
                person: t("team.person"),
                role: t("team.role"),
                noCandidates: t("team.noCandidates"),
              }}
            />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{t("team.members")}</CardTitle>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("team.noMembers")}</p>
          ) : (
            <ul className="divide-y">
              {members.map((member) => {
                // Derived, never restated. If the matrix changes, this changes.
                const granted = permissionsForRoles(member.roles);
                const capabilities = PERMISSIONS.filter((p) => granted.has(p));

                return (
                  <li key={member.userId} className="space-y-2 py-4 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="font-medium">{member.displayName}</p>
                        <p className="text-xs text-muted-foreground">{member.email}</p>
                        <div className="flex flex-wrap items-center gap-2">
                          {member.grants.map((grant) => (
                            <span key={grant.id} className="inline-flex items-center gap-1">
                              <StatusBadge tone="info">{t(`roles.${grant.role}`)}</StatusBadge>
                              {canManage ? (
                                <RevokeRoleForm
                                  grantId={grant.id}
                                  labels={{ ...labels, submit: t("team.revoke") }}
                                />
                              ) : null}
                            </span>
                          ))}
                          {member.active ? null : (
                            <StatusBadge tone="neutral">{t("team.inactive")}</StatusBadge>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground" data-numeric>
                        {t("team.permissionCount", { count: capabilities.length })}
                      </p>
                    </div>

                    <details className="text-xs text-muted-foreground">
                      <summary className="cursor-pointer">{t("team.showPermissions")}</summary>
                      {/*
                        Permission KEYS, untranslated on purpose. They are the
                        vocabulary of src/domain/permissions.ts and of
                        docs/permissions.md, and a translated paraphrase would be
                        a second, slightly different, list of what people can do.
                      */}
                      <ul className="mt-2 grid gap-x-4 gap-y-0.5 font-mono sm:grid-cols-2 lg:grid-cols-3">
                        {capabilities.map((p) => (
                          <li key={p}>{p}</li>
                        ))}
                      </ul>
                    </details>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
