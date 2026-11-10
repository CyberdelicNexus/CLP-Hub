"use client";

import { useActionState, useTransition } from "react";
import Link from "next/link";
import { CalendarClock, ClipboardCheck, Mail, Phone } from "lucide-react";
import { toast } from "sonner";
import { APPLICATION_TONES, ApplicationStatusBadge } from "@/components/team/application-status-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  APPLICATION_STATUS_TRANSITIONS,
  type ApplicationStatus,
} from "@/domain/recruitment";
import { TEAM_BASE_PATH } from "@/domain/navigation";
import { cn } from "@/lib/utils";
import type { ApplicationCardRow } from "@/services/recruitment";
import { scheduleScreeningAction, type OpState } from "../participantes/actions";
import {
  CloseScreeningForm,
  CompleteScreeningForm,
  type ReasonOption,
} from "../participantes/participant-forms";
import { moveApplicationStatus } from "./actions";

/** Everything the card says, resolved on the server so this stays message-free. */
export interface ApplicationCardLabels {
  statusLabels: Record<ApplicationStatus, string>;
  screeningStatusLabels: Record<string, string>;
  eligibilityLabels: Record<string, string>;
  statusLabel: string;
  noTransitions: string;
  screeningWhen: string;
  schedule: string;
  screeningOn: string;
  screeningResult: string;
  recordResult: string;
  recordResultTitle: string;
  recordResultBoundary: string;
  noResultTitle: string;
  openParticipant: string;
  submitting: string;
  statusErrors: Record<string, string>;
  screeningErrors: Record<string, string>;
  completeForm: {
    submit: string;
    submitting: string;
    result: string;
    reference: string;
    referenceHelp: string;
    reason: string;
    reasonRequiredHint: string;
    reasonNote: string;
    reasonNoteHelp: string;
    reasonNoneConfigured: string;
  };
  closeOptions: { value: string; label: string }[];
  results: { value: string; label: string }[];
}

/**
 * The card's edge-glow colour (2026-11-09): its status badge's colour, so the
 * light also says where the application is. Neutral statuses have no colour of
 * their own and keep the default brand glow (null).
 */
export function applicationGlowColor(status: ApplicationStatus): string | null {
  const tone = APPLICATION_TONES[status];
  return tone === "neutral" ? null : `var(--status-${tone}-fg)`;
}

/**
 * One application as a card (2026-10-28: "all should be manageable in the
 * applications cards"). Three steps live on it, each appearing once the one
 * before has happened:
 *
 *   1. the application's status, as a dropdown of the moves the domain allows
 *      (`moveApplicationStatus`, the kanban's call and audit row);
 *   2. once it passes to screening, a date to book the screening
 *      (`scheduleScreeningAction`, the participant page's own action);
 *   3. once a screening is booked, a button opening the result form in a
 *      modal (`CompleteScreeningForm` / `CloseScreeningForm`, reused as-is).
 *
 * The result is typed by staff, never worked out here (CLAUDE.md rule 3).
 * The card itself opens the PARTICIPANT, not the application detail: the
 * application holds only the basic data, and the participant page is where
 * anything else is managed. A stretched link on the code makes the whole card
 * clickable without nesting the controls inside a link.
 */
export function ApplicationCard({
  row,
  includeContact,
  canManageApplication,
  canManageScreening,
  reasons,
  labels,
  timeZone,
  compact = false,
}: {
  row: ApplicationCardRow;
  includeContact: boolean;
  canManageApplication: boolean;
  canManageScreening: boolean;
  reasons: ReasonOption[];
  labels: ApplicationCardLabels;
  timeZone: string;
  /** Kanban: the column already says the status, so no dropdown. */
  compact?: boolean;
}) {
  const screening = row.screening;
  const scheduled = screening?.status === "SCHEDULED" ? screening : null;
  const inScreening = row.status === "ACCEPTED_FOR_SCREENING";
  const glowColor = applicationGlowColor(row.status);

  return (
    <article
      // Gallery cards glow like the cohort cards (`.edge-glow`), with the light
      // following the pointer. In the kanban the board's card frame glows instead.
      style={!compact && glowColor ? ({ "--glow-color": glowColor } as React.CSSProperties) : undefined}
      onPointerMove={
        compact
          ? undefined
          : (e) => {
              const r = e.currentTarget.getBoundingClientRect();
              e.currentTarget.style.setProperty("--glow-x", `${e.clientX - r.left}px`);
              e.currentTarget.style.setProperty("--glow-y", `${e.clientY - r.top}px`);
            }
      }
      className={cn(
        "relative flex min-w-0 flex-col",
        // In the kanban the column's own card frames this one.
        compact
          ? "gap-1.5"
          : "edge-glow gap-3 rounded-2xl bg-card p-4 shadow-soft ring-1 ring-foreground/10 hover:bg-muted/30",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link
            href={`${TEAM_BASE_PATH}/participantes/${row.participantId}`}
            aria-label={labels.openParticipant.replace("{code}", row.participantCode)}
            data-numeric
            className="rounded text-sm font-semibold outline-none after:absolute after:inset-0 after:rounded-2xl after:content-[''] focus-visible:after:ring-3 focus-visible:after:ring-ring/50"
          >
            {row.participantCode}
          </Link>
          {includeContact && row.fullName ? (
            <p className={cn("truncate font-medium", compact ? "text-xs text-muted-foreground" : "text-base")}>
              {row.fullName}
            </p>
          ) : null}
        </div>
        {compact ? null : (
          <ApplicationStatusBadge status={row.status} label={labels.statusLabels[row.status]} />
        )}
      </div>

      {includeContact && !compact && (row.email || row.phone) ? (
        <div className="space-y-0.5 text-xs text-muted-foreground">
          {row.email ? (
            <p className="flex items-center gap-1.5 truncate">
              <Mail className="size-3 shrink-0" aria-hidden />
              <span className="truncate">{row.email}</span>
            </p>
          ) : null}
          {row.phone ? (
            <p className="flex items-center gap-1.5">
              <Phone className="size-3 shrink-0" aria-hidden />
              <span data-numeric>{row.phone}</span>
            </p>
          ) : null}
        </div>
      ) : null}

      <p data-numeric className="text-[0.7rem] text-muted-foreground">
        {formatDate(row.submittedAt, timeZone, false)}
      </p>

      {screening ? (
        <p className="flex flex-wrap items-center gap-1.5 text-xs">
          <CalendarClock className="size-3.5 text-muted-foreground" aria-hidden />
          <span data-numeric>
            {labels.screeningOn.replace(
              "{date}",
              screening.scheduledAt ? formatDate(screening.scheduledAt, timeZone, true) : "—",
            )}
          </span>
          <span className="text-muted-foreground">· {labels.screeningStatusLabels[screening.status]}</span>
          {screening.result ? (
            <span className="font-medium">
              · {labels.screeningResult.replace("{result}", labels.eligibilityLabels[screening.result])}
            </span>
          ) : null}
        </p>
      ) : null}

      {/* Controls sit above the stretched link, and keep pointer and key
          presses to themselves so a kanban card does not start a drag. */}
      <div
        className="relative z-10 mt-auto space-y-2 empty:hidden"
        onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        {!compact && canManageApplication ? (
          <StatusSelect applicationId={row.id} status={row.status} labels={labels} />
        ) : null}

        {inScreening && canManageScreening && !scheduled ? (
          <ScheduleInline participantId={row.participantId} labels={labels} />
        ) : null}

        {scheduled && canManageScreening ? (
          <Dialog>
            <DialogTrigger render={<Button size="sm" variant="outline" className="w-full gap-1.5 rounded-lg" />}>
              <ClipboardCheck className="size-3.5" aria-hidden />
              {labels.recordResult}
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{labels.recordResultTitle.replace("{code}", row.participantCode)}</DialogTitle>
              </DialogHeader>
              <p className="text-xs text-muted-foreground">{labels.recordResultBoundary}</p>
              {/* Once saved, the screening is no longer SCHEDULED, the page
                  re-renders without this button, and the dialog goes with it. */}
              <CompleteScreeningForm
                participantId={row.participantId}
                screeningId={scheduled.id}
                results={labels.results}
                reasons={reasons}
                labels={{ ...labels.completeForm, errors: labels.screeningErrors }}
              />
              <div className="space-y-1.5 border-t border-border pt-3">
                <p className="text-xs font-medium text-muted-foreground">{labels.noResultTitle}</p>
                <CloseScreeningForm
                  participantId={row.participantId}
                  screeningId={scheduled.id}
                  options={labels.closeOptions}
                  labels={{
                    submit: labels.completeForm.submit,
                    submitting: labels.submitting,
                    errors: labels.screeningErrors,
                  }}
                />
              </div>
            </DialogContent>
          </Dialog>
        ) : null}
      </div>
    </article>
  );
}

/** The status as a dropdown of the moves the domain allows from here. */
function StatusSelect({
  applicationId,
  status,
  labels,
}: {
  applicationId: string;
  status: ApplicationStatus;
  labels: ApplicationCardLabels;
}) {
  const [pending, startTransition] = useTransition();
  const next = APPLICATION_STATUS_TRANSITIONS[status];
  if (next.length === 0) {
    return <p className="text-xs text-muted-foreground">{labels.noTransitions}</p>;
  }
  return (
    <select
      aria-label={labels.statusLabel}
      value={status}
      disabled={pending}
      onChange={(e) => {
        const to = e.target.value;
        startTransition(async () => {
          const result = await moveApplicationStatus(applicationId, to);
          if (!result.ok) {
            toast.error((result.error && labels.statusErrors[result.error]) || labels.statusErrors.failed);
          }
        });
      }}
      className="h-8 w-full rounded-lg border border-input bg-card px-2 text-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
    >
      <option value={status}>{labels.statusLabels[status]}</option>
      {next.map((s) => (
        <option key={s} value={s}>
          {labels.statusLabels[s]}
        </option>
      ))}
    </select>
  );
}

const scheduleInitial: OpState = { error: null };

/** Book the screening from the card, once the application passes to screening. */
function ScheduleInline({ participantId, labels }: { participantId: string; labels: ApplicationCardLabels }) {
  const [state, action, pending] = useActionState(scheduleScreeningAction, scheduleInitial);
  return (
    <form action={action} className="space-y-1.5">
      <input type="hidden" name="participantId" value={participantId} />
      <label className="block text-[0.7rem] font-medium text-muted-foreground" htmlFor={`when-${participantId}`}>
        {labels.screeningWhen}
      </label>
      <div className="flex gap-1.5">
        <Input
          id={`when-${participantId}`}
          name="scheduledAt"
          type="datetime-local"
          required
          className="h-8 min-w-0 flex-1 text-xs"
        />
        <Button type="submit" size="sm" className="h-8 rounded-lg" disabled={pending}>
          {pending ? labels.submitting : labels.schedule}
        </Button>
      </div>
      {state.error ? (
        <p role="alert" className="text-xs text-destructive">
          {labels.screeningErrors[state.error] ?? state.error}
        </p>
      ) : null}
    </form>
  );
}

function formatDate(value: Date, timeZone: string, withTime: boolean): string {
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "medium",
    ...(withTime ? { timeStyle: "short" } : {}),
    timeZone,
  }).format(value);
}
