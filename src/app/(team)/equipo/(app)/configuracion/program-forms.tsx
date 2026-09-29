"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SessionModality } from "@/domain/session";
import {
  createProgramStageAction,
  createSessionTemplateAction,
  toggleProgramStageAction,
  toggleSessionTemplateAction,
  updateProgramStageAction,
  updateSessionTemplateAction,
  type SettingsState,
} from "./actions";
import type { SettingsLabels } from "./settings-forms";

/** A "use server" module may only export functions, so initial state lives here. */
const initial: SettingsState = { error: null };

const SELECT_CLASS =
  "h-9 w-full rounded-lg border border-input bg-card px-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

function ErrorLine({ state, errors }: { state: SettingsState; errors: Record<string, string> }) {
  if (!state.error) return null;
  return (
    <p role="alert" className="text-sm text-destructive">
      {errors[state.error] ?? state.error}
    </p>
  );
}

// ---------------------------------------------------------------------------
// Programme stages
// ---------------------------------------------------------------------------

export function CreateProgramStageForm({
  modalities,
  labels,
}: {
  modalities: { value: SessionModality; label: string }[];
  labels: SettingsLabels & {
    code: string;
    codeHelp: string;
    nameEs: string;
    nameEn: string;
    modality: string;
    position: string;
  };
}) {
  const [state, action, pending] = useActionState(createProgramStageAction, initial);
  return (
    <form key={state.ok ? "done" : "new"} action={action} className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="stageCode">{labels.code}</Label>
        <Input id="stageCode" name="code" required maxLength={48} placeholder="preparacion" />
        <p className="text-xs text-muted-foreground">{labels.codeHelp}</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="stageNameEs">{labels.nameEs}</Label>
        <Input id="stageNameEs" name="nameEs" required maxLength={120} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="stageNameEn">{labels.nameEn}</Label>
        <Input id="stageNameEn" name="nameEn" maxLength={120} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="stageModality">{labels.modality}</Label>
        <select id="stageModality" name="modality" required defaultValue="IN_PERSON" className={SELECT_CLASS}>
          {modalities.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="stagePosition">{labels.position}</Label>
        <Input id="stagePosition" name="position" type="number" min={0} defaultValue={0} inputMode="numeric" />
      </div>
      <div className="sm:col-span-2">
        <ErrorLine state={state} errors={labels.errors} />
        <Button type="submit" size="sm" className="mt-2 rounded-lg" disabled={pending}>
          {pending ? labels.submitting : labels.submit}
        </Button>
      </div>
    </form>
  );
}

export function EditProgramStageForm({
  stage,
  modalities,
  labels,
}: {
  stage: { id: string; nameEs: string; nameEn: string | null; modality: SessionModality; position: number };
  modalities: { value: SessionModality; label: string }[];
  labels: SettingsLabels & { nameEs: string; nameEn: string; modality: string; position: string; saved: string };
}) {
  const [state, action, pending] = useActionState(updateProgramStageAction, initial);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="stageId" value={stage.id} />
      <div className="space-y-1.5">
        <Label htmlFor={`edit-stage-nameEs-${stage.id}`}>{labels.nameEs}</Label>
        <Input id={`edit-stage-nameEs-${stage.id}`} name="nameEs" required maxLength={120} defaultValue={stage.nameEs} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`edit-stage-nameEn-${stage.id}`}>{labels.nameEn}</Label>
        <Input id={`edit-stage-nameEn-${stage.id}`} name="nameEn" maxLength={120} defaultValue={stage.nameEn ?? ""} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`edit-stage-modality-${stage.id}`}>{labels.modality}</Label>
        <select
          id={`edit-stage-modality-${stage.id}`}
          name="modality"
          required
          defaultValue={stage.modality}
          className={SELECT_CLASS}
        >
          {modalities.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`edit-stage-position-${stage.id}`}>{labels.position}</Label>
        <Input
          id={`edit-stage-position-${stage.id}`}
          name="position"
          type="number"
          min={0}
          defaultValue={stage.position}
          inputMode="numeric"
        />
      </div>
      <div className="flex items-center gap-2 sm:col-span-2">
        <Button type="submit" size="xs" variant="outline" className="rounded-md" disabled={pending}>
          {pending ? labels.submitting : labels.submit}
        </Button>
        {state.ok ? <p className="text-xs text-muted-foreground">{labels.saved}</p> : null}
      </div>
      <div className="sm:col-span-2">
        <ErrorLine state={state} errors={labels.errors} />
      </div>
    </form>
  );
}

export function ToggleProgramStageForm({
  stageId,
  active,
  labels,
}: {
  stageId: string;
  active: boolean;
  labels: SettingsLabels;
}) {
  const [state, action, pending] = useActionState(toggleProgramStageAction, initial);
  return (
    <form action={action} className="inline">
      <input type="hidden" name="stageId" value={stageId} />
      <input type="hidden" name="active" value={active ? "false" : "true"} />
      <Button type="submit" size="xs" variant="ghost" className="rounded-md" disabled={pending}>
        {pending ? labels.submitting : labels.submit}
      </Button>
      <ErrorLine state={state} errors={labels.errors} />
    </form>
  );
}

// ---------------------------------------------------------------------------
// Session templates
// ---------------------------------------------------------------------------

export function CreateSessionTemplateForm({
  stages,
  arms,
  modalities,
  labels,
}: {
  stages: { id: string; nameEs: string }[];
  arms: { id: string; label: string }[];
  modalities: { value: SessionModality; label: string }[];
  labels: SettingsLabels & {
    code: string;
    codeHelp: string;
    nameEs: string;
    nameEn: string;
    modality: string;
    stage: string;
    stageNone: string;
    arm: string;
    armAny: string;
    duration: string;
    dayOffset: string;
    dayOffsetHelp: string;
    position: string;
  };
}) {
  const [state, action, pending] = useActionState(createSessionTemplateAction, initial);
  return (
    <form key={state.ok ? "done" : "new"} action={action} className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="templateCode">{labels.code}</Label>
        <Input id="templateCode" name="code" required maxLength={48} placeholder="vida" />
        <p className="text-xs text-muted-foreground">{labels.codeHelp}</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="templateNameEs">{labels.nameEs}</Label>
        <Input id="templateNameEs" name="nameEs" required maxLength={120} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="templateNameEn">{labels.nameEn}</Label>
        <Input id="templateNameEn" name="nameEn" maxLength={120} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="templateModality">{labels.modality}</Label>
        <select id="templateModality" name="modality" required defaultValue="IN_PERSON" className={SELECT_CLASS}>
          {modalities.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="templateStage">{labels.stage}</Label>
        <select id="templateStage" name="stageId" defaultValue="" className={SELECT_CLASS}>
          <option value="">{labels.stageNone}</option>
          {stages.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nameEs}
            </option>
          ))}
        </select>
      </div>
      {arms.length > 0 ? (
        <div className="space-y-1.5">
          <Label htmlFor="templateArm">{labels.arm}</Label>
          <select id="templateArm" name="armId" defaultValue="" className={SELECT_CLASS}>
            <option value="">{labels.armAny}</option>
            {arms.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <div className="space-y-1.5">
        <Label htmlFor="templateDuration">{labels.duration}</Label>
        <Input id="templateDuration" name="durationMinutes" type="number" min={1} inputMode="numeric" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="templateDayOffset">{labels.dayOffset}</Label>
        <Input id="templateDayOffset" name="dayOffset" type="number" inputMode="numeric" />
        <p className="text-xs text-muted-foreground">{labels.dayOffsetHelp}</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="templatePosition">{labels.position}</Label>
        <Input id="templatePosition" name="position" type="number" min={0} defaultValue={0} inputMode="numeric" />
      </div>
      <div className="sm:col-span-2">
        <ErrorLine state={state} errors={labels.errors} />
        <Button type="submit" size="sm" className="mt-2 rounded-lg" disabled={pending}>
          {pending ? labels.submitting : labels.submit}
        </Button>
      </div>
    </form>
  );
}

export function EditSessionTemplateForm({
  template,
  stages,
  arms,
  modalities,
  labels,
}: {
  template: {
    id: string;
    nameEs: string;
    nameEn: string | null;
    modality: SessionModality;
    stageId: string | null;
    armId: string | null;
    durationMinutes: number | null;
    dayOffset: number | null;
    position: number;
  };
  stages: { id: string; nameEs: string }[];
  arms: { id: string; label: string }[];
  modalities: { value: SessionModality; label: string }[];
  labels: SettingsLabels & {
    nameEs: string;
    nameEn: string;
    modality: string;
    stage: string;
    stageNone: string;
    arm: string;
    armAny: string;
    duration: string;
    dayOffset: string;
    dayOffsetHelp: string;
    position: string;
    saved: string;
  };
}) {
  const [state, action, pending] = useActionState(updateSessionTemplateAction, initial);
  const p = template.id;
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="templateId" value={template.id} />
      <div className="space-y-1.5">
        <Label htmlFor={`edit-tpl-nameEs-${p}`}>{labels.nameEs}</Label>
        <Input id={`edit-tpl-nameEs-${p}`} name="nameEs" required maxLength={120} defaultValue={template.nameEs} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`edit-tpl-nameEn-${p}`}>{labels.nameEn}</Label>
        <Input id={`edit-tpl-nameEn-${p}`} name="nameEn" maxLength={120} defaultValue={template.nameEn ?? ""} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`edit-tpl-modality-${p}`}>{labels.modality}</Label>
        <select
          id={`edit-tpl-modality-${p}`}
          name="modality"
          required
          defaultValue={template.modality}
          className={SELECT_CLASS}
        >
          {modalities.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`edit-tpl-stage-${p}`}>{labels.stage}</Label>
        <select id={`edit-tpl-stage-${p}`} name="stageId" defaultValue={template.stageId ?? ""} className={SELECT_CLASS}>
          <option value="">{labels.stageNone}</option>
          {stages.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nameEs}
            </option>
          ))}
        </select>
      </div>
      {arms.length > 0 ? (
        <div className="space-y-1.5">
          <Label htmlFor={`edit-tpl-arm-${p}`}>{labels.arm}</Label>
          <select id={`edit-tpl-arm-${p}`} name="armId" defaultValue={template.armId ?? ""} className={SELECT_CLASS}>
            <option value="">{labels.armAny}</option>
            {arms.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <div className="space-y-1.5">
        <Label htmlFor={`edit-tpl-duration-${p}`}>{labels.duration}</Label>
        <Input
          id={`edit-tpl-duration-${p}`}
          name="durationMinutes"
          type="number"
          min={1}
          inputMode="numeric"
          defaultValue={template.durationMinutes ?? ""}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`edit-tpl-dayOffset-${p}`}>{labels.dayOffset}</Label>
        <Input
          id={`edit-tpl-dayOffset-${p}`}
          name="dayOffset"
          type="number"
          inputMode="numeric"
          defaultValue={template.dayOffset ?? ""}
        />
        <p className="text-xs text-muted-foreground">{labels.dayOffsetHelp}</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`edit-tpl-position-${p}`}>{labels.position}</Label>
        <Input
          id={`edit-tpl-position-${p}`}
          name="position"
          type="number"
          min={0}
          defaultValue={template.position}
          inputMode="numeric"
        />
      </div>
      <div className="flex items-center gap-2 sm:col-span-2">
        <Button type="submit" size="xs" variant="outline" className="rounded-md" disabled={pending}>
          {pending ? labels.submitting : labels.submit}
        </Button>
        {state.ok ? <p className="text-xs text-muted-foreground">{labels.saved}</p> : null}
      </div>
      <div className="sm:col-span-2">
        <ErrorLine state={state} errors={labels.errors} />
      </div>
    </form>
  );
}

export function ToggleSessionTemplateForm({
  templateId,
  active,
  labels,
}: {
  templateId: string;
  active: boolean;
  labels: SettingsLabels;
}) {
  const [state, action, pending] = useActionState(toggleSessionTemplateAction, initial);
  return (
    <form action={action} className="inline">
      <input type="hidden" name="templateId" value={templateId} />
      <input type="hidden" name="active" value={active ? "false" : "true"} />
      <Button type="submit" size="xs" variant="ghost" className="rounded-md" disabled={pending}>
        {pending ? labels.submitting : labels.submit}
      </Button>
      <ErrorLine state={state} errors={labels.errors} />
    </form>
  );
}
