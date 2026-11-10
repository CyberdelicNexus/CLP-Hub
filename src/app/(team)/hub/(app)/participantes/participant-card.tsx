"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { TEAM_BASE_PATH } from "@/domain/navigation";
import { RESPONSIBILITY_ROLES, type ResponsibilityRole } from "@/domain/responsibility";
import { cn } from "@/lib/utils";
import type { ParticipantListRow } from "@/services/participant-ops";
import { assignToCohortAction, type CohortState } from "../cohortes/actions";
import {
  assignResponsibleAction,
  revokeResponsibleAction,
  type CareState,
} from "./care-actions";
import { ContactField } from "./participant-forms";

/** Everything the card says, resolved on the server so this stays message-free. */
export interface ParticipantCardLabels {
  openParticipant: string;
  showProperties: string;
  hideProperties: string;
  name: string;
  phone: string;
  email: string;
  cohort: string;
  unassigned: string;
  roles: Record<ResponsibilityRole, string>;
  contactName: { empty: string; edit: string };
  contactPhone: { empty: string; edit: string };
  contactEmail: { empty: string; edit: string };
  form: { submit: string; submitting: string; errors: Record<string, string> };
  cohortErrors: Record<string, string>;
  careErrors: Record<string, string>;
}

export interface CardResponsible {
  role: ResponsibilityRole;
  userId: string;
  displayName: string;
}

export interface ParticipantCardOptions {
  includeContact: boolean;
  canManageParticipant: boolean;
  /** Empty when the viewer can't assign, or no cohort is open. */
  cohorts: { id: string; label: string }[];
  /** Empty when the viewer can't name a responsible. */
  candidates: { id: string; label: string }[];
  responsibles: Record<string, CardResponsible[]>;
  labels: ParticipantCardLabels;
}

const FIELD_SELECT_CLASS =
  "h-7 w-full min-w-0 rounded-md border border-input bg-card px-1.5 text-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60";

/** What a card shows while it is being dragged: its identity, no controls. */
export function ParticipantCardPreview({
  row,
  includeContact,
}: {
  row: ParticipantListRow;
  includeContact: boolean;
}) {
  return (
    <div className="space-y-1">
      <p data-numeric className="text-sm font-medium">
        {row.code}
      </p>
      {includeContact ? (
        <p className="truncate text-xs text-muted-foreground">{row.fullName ?? "—"}</p>
      ) : null}
    </div>
  );
}

/**
 * One participant on the board, with the properties staff change most editable
 * where they stand (D-142). Each control is the one the participant page uses:
 * same action, permission and audit row.
 *
 * The cohort is offered only while the person has none. Moving someone needs a
 * reason, so that stays on the participant page. As on the application cards, a
 * stretched link makes the card clickable without nesting controls in a link,
 * and the controls keep pointer and key presses from starting a drag.
 *
 * The properties start folded, so a column stays scannable; the chevron opens
 * them for that one card.
 */
export function ParticipantCard({
  row,
  options,
}: {
  row: ParticipantListRow;
  options: ParticipantCardOptions;
}) {
  const { includeContact, canManageParticipant, cohorts, candidates, labels } = options;
  const responsibles = options.responsibles[row.id] ?? [];
  const [expanded, setExpanded] = useState(false);
  const toggleLabel = expanded ? labels.hideProperties : labels.showProperties;

  return (
    <article className="relative flex min-w-0 flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <Link
          href={`${TEAM_BASE_PATH}/participantes/${row.id}`}
          aria-label={labels.openParticipant.replace("{code}", row.code)}
          data-numeric
          className="rounded text-sm font-medium outline-none after:absolute after:inset-0 after:rounded-xl after:content-[''] focus-visible:after:ring-3 focus-visible:after:ring-ring/50"
        >
          {row.code}
        </Link>
        <button
          type="button"
          aria-expanded={expanded}
          aria-label={toggleLabel}
          title={toggleLabel}
          onClick={() => setExpanded(!expanded)}
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          className="relative z-10 inline-flex cursor-pointer rounded-md p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <ChevronDown
            className={cn("size-4 transition-transform duration-150", expanded && "rotate-180")}
            aria-hidden
          />
        </button>
      </div>

      {!expanded ? (
        <>
          {includeContact ? (
            <p className="truncate text-xs text-muted-foreground">{row.fullName ?? "—"}</p>
          ) : null}
          {row.cohortCode ? (
            <p data-numeric className="text-[0.7rem] text-muted-foreground">
              {row.cohortCode}
            </p>
          ) : null}
        </>
      ) : (
        <dl
          className="relative z-10 w-fit max-w-full cursor-default space-y-1 text-xs"
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          {includeContact ? (
            <>
              <Contact row={row} field="fullName" options={options} label={labels.name} />
              <Contact row={row} field="phone" options={options} label={labels.phone} />
              <Contact row={row} field="email" options={options} label={labels.email} />
            </>
          ) : null}

          <div>
            <dt className="text-[0.7rem] text-muted-foreground">{labels.cohort}</dt>
            {row.cohortCode ? (
              <dd data-numeric>{row.cohortCode}</dd>
            ) : (
              <dd>
                {cohorts.length > 0 ? (
                  <CohortSelect participantId={row.id} options={options} />
                ) : (
                  "—"
                )}
              </dd>
            )}
          </div>

          {RESPONSIBILITY_ROLES.map((role) => {
            const held = responsibles.find((r) => r.role === role);
            return (
              <div key={role}>
                <dt className="text-[0.7rem] text-muted-foreground">{labels.roles[role]}</dt>
                <dd>
                  {canManageParticipant && candidates.length > 0 ? (
                    <ResponsibleSelect
                      participantId={row.id}
                      role={role}
                      current={held?.userId ?? ""}
                      candidates={candidates}
                      labels={labels}
                    />
                  ) : (
                    (held?.displayName ?? labels.unassigned)
                  )}
                </dd>
              </div>
            );
          })}
        </dl>
      )}
    </article>
  );
}

function Contact({
  row,
  field,
  options,
  label,
}: {
  row: ParticipantListRow;
  field: "fullName" | "phone" | "email";
  options: ParticipantCardOptions;
  label: string;
}) {
  const { labels } = options;
  const value = row[field];
  const words = {
    fullName: labels.contactName,
    phone: labels.contactPhone,
    email: labels.contactEmail,
  }[field];

  return (
    <div>
      <dt className="text-[0.7rem] text-muted-foreground">{label}</dt>
      {options.canManageParticipant ? (
        <ContactField
          field={field}
          participantId={row.id}
          value={value}
          inputType={field === "email" ? "email" : field === "phone" ? "tel" : "text"}
          maxLength={field === "email" ? 254 : field === "phone" ? 40 : undefined}
          labels={{ ...labels.form, ...words }}
        />
      ) : (
        <dd className="break-words">{value ?? "—"}</dd>
      )}
    </div>
  );
}

const cohortInitial: CohortState = { error: null };

/** Saves on change: a dropdown on a card has no room for a button of its own. */
function CohortSelect({
  participantId,
  options,
}: {
  participantId: string;
  options: ParticipantCardOptions;
}) {
  const [state, action, actionPending] = useActionState(assignToCohortAction, cohortInitial);
  const [transitionPending, startTransition] = useTransition();
  const { labels, cohorts } = options;

  return (
    <>
      <select
        aria-label={labels.cohort}
        value=""
        disabled={actionPending || transitionPending}
        onChange={(e) => {
          const data = new FormData();
          data.set("participantId", participantId);
          data.set("cohortId", e.target.value);
          startTransition(() => action(data));
        }}
        className={FIELD_SELECT_CLASS}
      >
        <option value="" disabled />
        {cohorts.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label}
          </option>
        ))}
      </select>
      <FieldError error={state.error} errors={labels.cohortErrors} />
    </>
  );
}

const careInitial: CareState = { error: null };

/** Picking a person assigns them; picking the empty row leaves the role unassigned. */
function ResponsibleSelect({
  participantId,
  role,
  current,
  candidates,
  labels,
}: {
  participantId: string;
  role: ResponsibilityRole;
  current: string;
  candidates: { id: string; label: string }[];
  labels: ParticipantCardLabels;
}) {
  const [assigned, assign, assigning] = useActionState(assignResponsibleAction, careInitial);
  const [revoked, revoke, revoking] = useActionState(revokeResponsibleAction, careInitial);
  const [transitionPending, startTransition] = useTransition();

  return (
    <>
      <select
        aria-label={labels.roles[role]}
        value={current}
        disabled={assigning || revoking || transitionPending}
        onChange={(e) => {
          const userId = e.target.value;
          const data = new FormData();
          data.set("participantId", participantId);
          data.set("role", role);
          if (userId) data.set("userId", userId);
          startTransition(() => (userId ? assign(data) : revoke(data)));
        }}
        className={FIELD_SELECT_CLASS}
      >
        <option value="">{labels.unassigned}</option>
        {candidates.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label}
          </option>
        ))}
      </select>
      <FieldError error={assigned.error ?? revoked.error} errors={labels.careErrors} />
    </>
  );
}

function FieldError({ error, errors }: { error: string | null; errors: Record<string, string> }) {
  if (!error) return null;
  return (
    <p role="alert" className="text-[0.7rem] text-destructive">
      {errors[error] ?? errors.failed}
    </p>
  );
}
