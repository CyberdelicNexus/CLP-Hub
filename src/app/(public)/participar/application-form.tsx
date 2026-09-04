"use client";

import { useActionState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LONG_TEXT_MAX_LENGTH, SHORT_TEXT_MAX_LENGTH, type QuestionType } from "@/domain/recruitment";
import { submitPublicApplication, type SubmitState } from "./actions";

/** Lives here, not in actions.ts: a "use server" module may only export functions. */
const initialSubmitState: SubmitState = {
  status: "idle",
  errors: {},
  formError: null,
  values: {},
  attempt: 0,
};

export interface RenderQuestion {
  id: string;
  key: string;
  type: QuestionType;
  required: boolean;
  label: string;
  help: string | null;
  options: { value: string; label: string }[];
}

export interface FormLabels {
  submit: string;
  submitting: string;
  optional: string;
  successTitle: string;
  successBody: string;
  closed: string;
  failed: string;
  tooFast: string;
  requiredNote: string;
  errors: Record<string, string>;
}

/**
 * Renders whatever questions the study has configured. The shape of this form is
 * data, not code — a different study asks different questions without a deploy.
 */
export function ApplicationForm({
  questions,
  labels,
  renderedAt,
}: {
  questions: RenderQuestion[];
  labels: FormLabels;
  /**
   * Server-stamped render time, compared against a fill-time floor when the
   * form is submitted. Stamped on the server so rendering stays pure — and so
   * the value cannot be back-dated by simply re-rendering on the client.
   */
  renderedAt: number;
}) {
  const [state, action, pending] = useActionState(submitPublicApplication, initialSubmitState);

  if (state.status === "success") {
    return (
      <div
        role="status"
        className="rounded-2xl bg-surface-mint p-6 text-surface-mint-ink sm:p-8"
      >
        <CheckCircle2 className="size-7" aria-hidden />
        <h2 className="mt-3 text-xl font-semibold">{labels.successTitle}</h2>
        <p className="mt-2 text-sm leading-relaxed">{labels.successBody}</p>
      </div>
    );
  }

  return (
    // Keyed on the attempt count: a rejected submission remounts the fields so
    // the echoed values are applied at initialisation rather than mutating an
    // already-initialised uncontrolled input.
    <form key={state.attempt} action={action} className="space-y-6" noValidate>
      {/* Honeypot: positioned off-screen rather than display:none, and hidden
          from assistive tech, so real users never encounter it. */}
      <div aria-hidden className="absolute left-[-9999px] h-px w-px overflow-hidden">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      <input type="hidden" name="renderedAt" value={renderedAt} />

      <p className="text-xs text-muted-foreground">{labels.requiredNote}</p>

      {questions.map((question) => {
        const error = state.errors[question.key];
        const errorId = `${question.key}-error`;
        const helpId = `${question.key}-help`;
        const describedBy = [question.help ? helpId : null, error ? errorId : null]
          .filter(Boolean)
          .join(" ");

        return (
          <div key={question.id} className="space-y-2">
            <Label htmlFor={question.key}>
              {question.label}
              {question.required ? (
                <span aria-hidden className="text-destructive">
                  *
                </span>
              ) : (
                <span className="text-xs font-normal text-muted-foreground">{labels.optional}</span>
              )}
            </Label>

            {question.help ? (
              <p id={helpId} className="text-xs text-muted-foreground">
                {question.help}
              </p>
            ) : null}

            <QuestionField
              question={question}
              defaultValue={state.values[question.key]}
              invalid={Boolean(error)}
              describedBy={describedBy || undefined}
            />

            {error ? (
              <p id={errorId} role="alert" className="text-sm text-destructive">
                {labels.errors[error] ?? error}
              </p>
            ) : null}
          </div>
        );
      })}

      {state.formError ? (
        <p role="alert" className="text-sm text-destructive">
          {labels[state.formError]}
        </p>
      ) : null}

      <Button type="submit" size="lg" className="w-full rounded-xl" disabled={pending}>
        {pending ? labels.submitting : labels.submit}
      </Button>
    </form>
  );
}

function QuestionField({
  question,
  defaultValue,
  invalid,
  describedBy,
}: {
  question: RenderQuestion;
  defaultValue?: string | string[];
  invalid: boolean;
  describedBy?: string;
}) {
  const shared = {
    id: question.key,
    name: question.key,
    "aria-invalid": invalid || undefined,
    "aria-describedby": describedBy,
  };
  const single = typeof defaultValue === "string" ? defaultValue : undefined;
  const many = Array.isArray(defaultValue) ? defaultValue : single ? [single] : [];

  switch (question.type) {
    case "LONG_TEXT":
      return (
        <textarea
          {...shared}
          rows={4}
          maxLength={LONG_TEXT_MAX_LENGTH}
          defaultValue={single}
          className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive"
        />
      );

    case "SELECT":
      return (
        <select
          {...shared}
          defaultValue={single ?? ""}
          className="h-9 w-full rounded-lg border border-input bg-card px-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive"
        >
          <option value="" />
          {question.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      );

    case "MULTI_SELECT":
      return (
        <fieldset
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className="flex flex-wrap gap-2"
        >
          <legend className="sr-only">{question.label}</legend>
          {question.options.map((o) => (
            <label
              key={o.value}
              className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-card px-3 py-2 text-sm ring-1 ring-foreground/10 transition-colors hover:bg-muted has-checked:bg-accent has-checked:text-accent-foreground"
            >
              <input
                type="checkbox"
                name={question.key}
                value={o.value}
                defaultChecked={many.includes(o.value)}
                className="size-4 accent-primary"
              />
              {o.label}
            </label>
          ))}
        </fieldset>
      );

    case "BOOLEAN":
      return (
        <label className="inline-flex cursor-pointer items-start gap-2 text-sm">
          <input
            {...shared}
            type="checkbox"
            defaultChecked={single === "on" || single === "true"}
            className="mt-0.5 size-4 accent-primary"
          />
          <span className="sr-only">{question.label}</span>
        </label>
      );

    case "DATE":
      return <Input {...shared} type="date" defaultValue={single} />;

    case "EMAIL":
      return (
        <Input {...shared} type="email" autoComplete="email" maxLength={254} defaultValue={single} />
      );

    case "PHONE":
      return (
        <Input {...shared} type="tel" autoComplete="tel" maxLength={32} defaultValue={single} />
      );

    default:
      return <Input {...shared} type="text" maxLength={SHORT_TEXT_MAX_LENGTH} defaultValue={single} />;
  }
}
