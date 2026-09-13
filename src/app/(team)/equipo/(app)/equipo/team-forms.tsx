"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { grantRoleAction, revokeRoleAction, type TeamState } from "./actions";

/** A "use server" module may only export functions, so initial state lives here. */
const initial: TeamState = { error: null };

const SELECT_CLASS =
  "h-9 w-full rounded-lg border border-input bg-card px-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

export interface TeamLabels {
  submit: string;
  submitting: string;
  errors: Record<string, string>;
}

function ErrorLine({ state, errors }: { state: TeamState; errors: Record<string, string> }) {
  if (!state.error) return null;
  return (
    <p role="alert" className="text-sm text-destructive">
      {errors[state.error] ?? state.error}
    </p>
  );
}

/**
 * Give someone a role.
 *
 * The person list is everyone with an account who does not already hold a role
 * here, plus everyone who does — because roles are not exclusive and a
 * facilitator may also need logistics. The service refuses a duplicate grant
 * rather than this form trying to predict one.
 */
export function GrantRoleForm({
  people,
  roles,
  labels,
}: {
  people: { value: string; label: string }[];
  roles: { value: string; label: string }[];
  labels: TeamLabels & { person: string; role: string; noCandidates: string };
}) {
  const [state, action, pending] = useActionState(grantRoleAction, initial);

  if (people.length === 0) {
    return <p className="text-sm text-muted-foreground">{labels.noCandidates}</p>;
  }

  return (
    <form key={state.ok ? "done" : "new"} action={action} className="grid gap-3 sm:grid-cols-3">
      <div className="space-y-1.5">
        <Label htmlFor="grantUser">{labels.person}</Label>
        <select id="grantUser" name="userId" required className={SELECT_CLASS}>
          {people.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="grantRole">{labels.role}</Label>
        <select id="grantRole" name="role" required className={SELECT_CLASS}>
          {roles.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-end">
        <Button type="submit" size="sm" className="rounded-lg" disabled={pending}>
          {pending ? labels.submitting : labels.submit}
        </Button>
      </div>
      <div className="sm:col-span-3">
        <ErrorLine state={state} errors={labels.errors} />
      </div>
    </form>
  );
}

/** Revoke one grant. The row stays in the database with a `revokedAt`. */
export function RevokeRoleForm({ grantId, labels }: { grantId: string; labels: TeamLabels }) {
  const [state, action, pending] = useActionState(revokeRoleAction, initial);
  return (
    <form action={action} className="inline">
      <input type="hidden" name="grantId" value={grantId} />
      <Button type="submit" size="sm" variant="ghost" className="rounded-lg" disabled={pending}>
        {pending ? labels.submitting : labels.submit}
      </Button>
      <ErrorLine state={state} errors={labels.errors} />
    </form>
  );
}
