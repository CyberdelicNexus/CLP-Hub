"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createArmAction, type SettingsState } from "./actions";
import type { SettingsLabels } from "./settings-forms";

/** A "use server" module may only export functions, so initial state lives here. */
const initial: SettingsState = { error: null };

function ErrorLine({ state, errors }: { state: SettingsState; errors: Record<string, string> }) {
  if (!state.error) return null;
  return (
    <p role="alert" className="text-sm text-destructive">
      {errors[state.error] ?? state.error}
    </p>
  );
}

/**
 * Add a study arm (D-116) — "Grupo control", "Grupo del programa". Creating one
 * allocates nobody; allocations are still recorded from the approved mechanism.
 */
export function CreateArmForm({
  labels,
}: {
  labels: SettingsLabels & {
    code: string;
    name: string;
    physicalConsent: string;
    help: string;
  };
}) {
  const [state, action, pending] = useActionState(createArmAction, initial);
  return (
    <form key={state.ok ? "done" : "new"} action={action} className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="armCode">{labels.code}</Label>
        <Input id="armCode" name="code" required maxLength={24} placeholder="CONTROL" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="armName">{labels.name}</Label>
        <Input id="armName" name="nameEs" required maxLength={80} placeholder="Grupo control" />
      </div>
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input type="checkbox" name="requiresPhysicalConsent" className="size-4 rounded border-input" />
        {labels.physicalConsent}
      </label>
      <p className="text-xs text-muted-foreground sm:col-span-2">{labels.help}</p>
      <div className="sm:col-span-2">
        <ErrorLine state={state} errors={labels.errors} />
        <Button type="submit" size="sm" className="mt-2 rounded-lg" disabled={pending}>
          {pending ? labels.submitting : labels.submit}
        </Button>
      </div>
    </form>
  );
}
