"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EXTERNAL_REF_MAX_LENGTH } from "@/domain/intake";
import { recordQualtricsIntakeAction, type IntakeActionState } from "./actions";

/** A "use server" module may only export functions, so initial state lives here. */
const initial: IntakeActionState = { error: null };

/**
 * Register a person who completed the Qualtrics screening (D-031).
 *
 * ONE FIELD, ON PURPOSE. The form asks for the anonymized response reference
 * and nothing else — no name, no email, no phone. Those were given in Qualtrics
 * after the digital consent was accepted, and they stay there. A second field
 * here would be the whole boundary undone, so the absence is the feature.
 *
 * On success it reports the generated participant code, because that code is
 * now the only handle staff have on the record and they need to be able to find
 * it again immediately.
 */
export function QualtricsIntakeForm({
  labels,
}: {
  labels: {
    reference: string;
    referenceHelp: string;
    submit: string;
    submitting: string;
    created: string;
    errors: Record<string, string>;
  };
}) {
  const [state, action, pending] = useActionState(recordQualtricsIntakeAction, initial);

  return (
    <form action={action} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="externalRef">{labels.reference}</Label>
        <Input
          id="externalRef"
          name="externalRef"
          required
          maxLength={EXTERNAL_REF_MAX_LENGTH}
          autoComplete="off"
          spellCheck={false}
          className="font-mono"
          aria-describedby="externalRefHelp"
        />
        <p id="externalRefHelp" className="text-xs text-muted-foreground">
          {labels.referenceHelp}
        </p>
      </div>

      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {labels.errors[state.error] ?? state.error}
        </p>
      ) : null}

      {state.participantCode ? (
        <p role="status" className="text-sm">
          {labels.created}{" "}
          <span data-numeric className="font-medium">
            {state.participantCode}
          </span>
        </p>
      ) : null}

      <Button type="submit" size="sm" className="rounded-lg" disabled={pending}>
        {pending ? labels.submitting : labels.submit}
      </Button>
    </form>
  );
}
