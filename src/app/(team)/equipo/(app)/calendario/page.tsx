import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { CalendarDays, ChevronLeft, ChevronRight, Glasses, MapPin, Video, Clock } from "lucide-react";
import { getStudyContext } from "@/auth/study-context";
import { NoAccess } from "@/components/team/no-access";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { TEAM_BASE_PATH } from "@/domain/navigation";
import type { SessionModality } from "@/domain/session";
import { listSessions } from "@/services/sessions";
import { sessionTone } from "../sesiones/tone";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("calendar") };
}

const MODALITY_ICON: Record<SessionModality, typeof Video> = {
  ZOOM: Video,
  VR: Glasses,
  IN_PERSON: MapPin,
  ASYNCHRONOUS: Clock,
  OTHER: Clock,
};

/**
 * Every scheduled session across every visible cohort — an agenda by
 * default (the underlying data is sparse, a handful of sessions a week, so
 * a 7-column grid is mostly empty cells), plus a month-grid view
 * (2026-09-19: "should have the agenda list, but also a calendar where we
 * can see the events") for when seeing a whole month's shape at a glance is
 * what's actually useful. Both read `listSessions`' existing shape; the
 * month view just re-buckets the same rows by calendar day instead of by
 * upcoming/past. View and month are both plain links (`?vista=`, `?mes=`),
 * not client state — shareable, and works without JS, same as every other
 * view toggle in this app.
 */
export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string; mes?: string }>;
}) {
  const ctx = await getStudyContext();
  if (!ctx) return null;

  const t = await getTranslations();
  if (!ctx.permissions.has("cohorts.read")) {
    return <NoAccess message={t("common.noAccess")} />;
  }

  const { vista, mes } = await searchParams;
  const isMonth = vista === "mes";

  const sessions = await listSessions(ctx.study.id, { scope: ctx.cohortScope, limit: 500 });
  const dated = sessions.filter((s) => s.scheduledStart !== null);

  const base = `${TEAM_BASE_PATH}/calendario`;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{t("nav.calendar")}</h1>
          <p className="text-sm text-muted-foreground">{t("calendar.subtitle")}</p>
        </div>
        <div className="inline-flex shrink-0 gap-0.5 rounded-lg bg-muted p-0.5">
          <Link
            href={base}
            aria-current={!isMonth ? "true" : undefined}
            className={
              !isMonth
                ? "rounded-md bg-card px-2.5 py-1.5 text-xs font-medium shadow-soft"
                : "rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            }
          >
            {t("calendar.viewAgenda")}
          </Link>
          <Link
            href={`${base}?vista=mes`}
            aria-current={isMonth ? "true" : undefined}
            className={
              isMonth
                ? "rounded-md bg-card px-2.5 py-1.5 text-xs font-medium shadow-soft"
                : "rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            }
          >
            {t("calendar.viewMonth")}
          </Link>
        </div>
      </header>

      {isMonth ? (
        <MonthView sessions={dated} monthParam={mes} timezone={ctx.study.timezone} t={t} />
      ) : (
        <AgendaView sessions={dated} timezone={ctx.study.timezone} t={t} />
      )}
    </div>
  );
}

function AgendaView({
  sessions,
  timezone,
  t,
}: {
  sessions: SessionRow[];
  timezone: string;
  t: Awaited<ReturnType<typeof getTranslations>>;
}) {
  const now = new Date();
  const upcoming = sessions.filter((s) => s.scheduledStart! >= now);
  const past = sessions.filter((s) => s.scheduledStart! < now).reverse();

  const groups = groupByDay(upcoming, timezone);
  const pastGroups = groupByDay(past, timezone);

  return (
    <>
      {groups.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("calendar.emptyTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{t("calendar.emptyDescription")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-5">
          {groups.map((group) => (
            <DayGroup key={group.key} group={group} timezone={timezone} t={t} />
          ))}
        </div>
      )}

      {pastGroups.length > 0 ? (
        <details className="group/section rounded-2xl bg-card ring-1 ring-foreground/10">
          <summary className="cursor-pointer list-none px-6 py-4 text-sm font-medium text-muted-foreground [&::-webkit-details-marker]:hidden">
            {t("calendar.pastToggle", { count: past.length })}
          </summary>
          <div className="space-y-5 border-t border-border p-4 pt-5">
            {pastGroups.map((group) => (
              <DayGroup key={group.key} group={group} timezone={timezone} t={t} muted />
            ))}
          </div>
        </details>
      ) : null}
    </>
  );
}

function parseMonth(param: string | undefined, timeZone: string): { year: number; month: number } {
  if (param && /^\d{4}-\d{2}$/.test(param)) {
    const [y, m] = param.split("-").map(Number);
    return { year: y, month: m - 1 };
  }
  const [y, m] = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit" })
    .format(new Date())
    .split("-")
    .map(Number);
  return { year: y, month: m - 1 };
}

function monthParam(year: number, month: number): string {
  const normalizedMonth = ((month % 12) + 12) % 12;
  const normalizedYear = year + Math.floor(month / 12);
  return `${normalizedYear}-${String(normalizedMonth + 1).padStart(2, "0")}`;
}

function dateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function MonthView({
  sessions,
  monthParam: monthParamValue,
  timezone,
  t,
}: {
  sessions: SessionRow[];
  monthParam: string | undefined;
  timezone: string;
  t: Awaited<ReturnType<typeof getTranslations>>;
}) {
  const { year, month } = parseMonth(monthParamValue, timezone);
  const base = `${TEAM_BASE_PATH}/calendario?vista=mes`;

  const byDay = new Map<string, SessionRow[]>();
  for (const row of sessions) {
    const key = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, dateStyle: "short" }).format(
      row.scheduledStart!,
    );
    const bucket = byDay.get(key);
    if (bucket) bucket.push(row);
    else byDay.set(key, [row]);
  }

  const first = new Date(Date.UTC(year, month, 1));
  const firstWeekday = (first.getUTCDay() + 6) % 7; // 0 = Monday
  const gridStart = new Date(first);
  gridStart.setUTCDate(first.getUTCDate() - firstWeekday);
  const last = new Date(Date.UTC(year, month + 1, 0));
  const lastWeekday = (last.getUTCDay() + 6) % 7;
  const gridEnd = new Date(last);
  gridEnd.setUTCDate(last.getUTCDate() + (6 - lastWeekday));

  const days: { year: number; month: number; day: number; inMonth: boolean }[] = [];
  for (let d = new Date(gridStart); d <= gridEnd; d.setUTCDate(d.getUTCDate() + 1)) {
    days.push({
      year: d.getUTCFullYear(),
      month: d.getUTCMonth(),
      day: d.getUTCDate(),
      inMonth: d.getUTCMonth() === month,
    });
  }

  const todayKey = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, dateStyle: "short" }).format(new Date());
  const monthLabel = new Intl.DateTimeFormat("es-ES", { timeZone: timezone, month: "long", year: "numeric" }).format(
    new Date(Date.UTC(year, month, 1)),
  );

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
        <CardTitle className="capitalize">{monthLabel}</CardTitle>
        <div className="flex items-center gap-1">
          <Link
            href={`${base}&mes=${monthParam(year, month - 1)}`}
            aria-label={t("calendar.prevMonth")}
            className="inline-flex rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <ChevronLeft className="size-4" aria-hidden />
          </Link>
          <Link
            href={`${base}&mes=${monthParam(year, month + 1)}`}
            aria-label={t("calendar.nextMonth")}
            className="inline-flex rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <ChevronRight className="size-4" aria-hidden />
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {t.raw("calendar.weekdays").map((w: string) => (
            <div key={w} className="py-1">
              {w}
            </div>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {days.map((d) => {
            const key = dateKey(d.year, d.month, d.day);
            const rows = byDay.get(key) ?? [];
            const isToday = key === todayKey;
            return (
              <div
                key={key}
                className={cn(
                  "flex min-h-20 flex-col gap-1 rounded-lg p-1.5 sm:min-h-24",
                  d.inMonth ? "bg-muted/40" : "bg-transparent opacity-40",
                  isToday && "ring-1 ring-inset ring-ring",
                )}
              >
                <span data-numeric className="text-xs font-medium">
                  {d.day}
                </span>
                <div className="flex flex-col gap-0.5">
                  {rows.slice(0, 2).map((row) => (
                    <Link
                      key={row.id}
                      href={`${TEAM_BASE_PATH}/sesiones/${row.id}`}
                      className="truncate rounded bg-card px-1 py-0.5 text-[0.65rem] leading-tight shadow-soft hover:shadow-lift"
                      title={`${row.cohortCode} · ${row.name}`}
                    >
                      {row.cohortCode}
                    </Link>
                  ))}
                  {rows.length > 2 ? (
                    <span className="text-[0.65rem] text-muted-foreground">
                      {t("calendar.more", { count: rows.length - 2 })}
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

type SessionRow = Awaited<ReturnType<typeof listSessions>>[number];

function groupByDay(
  rows: SessionRow[],
  timeZone: string,
): { key: string; label: string; rows: SessionRow[] }[] {
  const map = new Map<string, SessionRow[]>();
  for (const row of rows) {
    const key = new Intl.DateTimeFormat("en-CA", { timeZone, dateStyle: "short" }).format(row.scheduledStart!);
    const bucket = map.get(key);
    if (bucket) bucket.push(row);
    else map.set(key, [row]);
  }
  return Array.from(map.entries()).map(([key, rowsForDay]) => ({
    key,
    label: new Intl.DateTimeFormat("es-ES", {
      timeZone,
      weekday: "long",
      day: "numeric",
      month: "long",
    }).format(rowsForDay[0].scheduledStart!),
    rows: rowsForDay,
  }));
}

function DayGroup({
  group,
  timezone,
  t,
  muted,
}: {
  group: { key: string; label: string; rows: SessionRow[] };
  timezone: string;
  t: Awaited<ReturnType<typeof getTranslations>>;
  muted?: boolean;
}) {
  return (
    <div>
      <p
        data-numeric
        className={`mb-2 flex items-center gap-1.5 text-xs font-medium tracking-wide uppercase ${muted ? "text-muted-foreground/70" : "text-muted-foreground"}`}
      >
        <CalendarDays className="size-3.5" aria-hidden />
        {group.label}
      </p>
      <div className="space-y-2">
        {group.rows.map((row) => {
          const Icon = MODALITY_ICON[row.modality];
          return (
            <Link
              key={row.id}
              href={`${TEAM_BASE_PATH}/sesiones/${row.id}`}
              className="card-accent flex flex-wrap items-center gap-3 rounded-2xl p-4 transition-shadow hover:shadow-lift focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <span
                data-numeric
                className="w-14 shrink-0 text-sm font-semibold"
              >
                {new Intl.DateTimeFormat("es-ES", { timeZone: timezone, timeStyle: "short" }).format(
                  row.scheduledStart!,
                )}
              </span>
              <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="min-w-0 flex-1 truncate font-medium">{row.name}</span>
              <span data-numeric className="text-xs text-muted-foreground">{row.cohortCode}</span>
              <StatusBadge tone={sessionTone(row.status)}>{t(`sessions.status.${row.status}`)}</StatusBadge>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
