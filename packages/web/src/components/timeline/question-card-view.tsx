import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { FormField, FormModel, FormValues } from "@/lib/elicitation-form";
import { toSubmission } from "@/lib/elicitation-form";
import type { ElicitationStatus } from "@/events/elicitation";

export type QuestionCardState = "open" | "sending" | "awaiting_confirmation" | "resolved";

export interface QuestionCardViewProps {
  agentName: string;
  message: string;
  model: FormModel;
  state: QuestionCardState;
  resolution?: { status: ElicitationStatus; respondedBy?: string };
  /** Daemon validation errors for this user's last response. */
  fieldErrors?: Record<string, string>;
  answerValues?: FormValues;
  /** Send failure. */
  error?: string;
  /** The daemon is no longer waiting on this question. */
  stale?: boolean;
  canAnswer?: boolean;
  onSubmit?: (content: Record<string, string | number | boolean | string[]>) => void;
  onSkip?: () => void;
  onCancel?: () => void;
}

const RESOLVED_TEXT: Record<ElicitationStatus, (by?: string) => string> = {
  accepted: (by) => `Answered by ${by ?? "someone"}`,
  declined: (by) => `Skipped by ${by ?? "someone"}`,
  cancelled: () => "Cancelled",
  interrupted: () => "No longer answerable — the agent restarted",
};

export function QuestionCardView({
  agentName, message, model, state, resolution, fieldErrors, answerValues, error, stale,
  canAnswer = true, onSubmit, onSkip, onCancel,
}: QuestionCardViewProps) {
  const [values, setValues] = useState<FormValues>(() => ({ ...model.initialValues }));
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({});
  const readOnly = state !== "open" || !canAnswer || Boolean(stale);
  const errors = { ...(fieldErrors ?? {}), ...localErrors };
  const set = (key: string, v: unknown) => setValues((prev) => ({ ...prev, [key]: v }));

  function submit() {
    const r = toSubmission(model, values);
    if (!r.ok) return setLocalErrors(r.errors);
    setLocalErrors({});
    onSubmit?.(r.content);
  }

  return (
    <Card data-testid="question-card" className="my-2 max-w-xl">
      <CardHeader>
        <CardDescription>
          <span className="font-medium text-foreground">{agentName}</span> is asking
        </CardDescription>
        <CardTitle className="text-base whitespace-pre-wrap break-words">{message}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {model.fields.map((f) => (
          <QuestionField key={f.key} field={f} values={resolution && answerValues ? answerValues : values} errors={errors} disabled={readOnly} onChange={set} />
        ))}
        {model.unsupported.length > 0 && (
          <div role="alert" className="text-destructive text-sm">
            Some fields in this question can't be shown here: {model.unsupported.join(", ")}. Skip it or answer in another client.
          </div>
        )}
        {stale && (
          <div role="alert" className="text-sm text-muted-foreground">
            The agent is no longer waiting for this answer.
          </div>
        )}
        {error && (
          <div role="alert" className="text-destructive text-sm">{error}</div>
        )}
      </CardContent>
      {resolution ? (
        <CardFooter>
          <p className="text-sm text-muted-foreground">{RESOLVED_TEXT[resolution.status](resolution.respondedBy)}</p>
        </CardFooter>
      ) : !canAnswer ? (
        <CardFooter>
          <p className="text-sm text-muted-foreground">You have insufficient permission to answer this question.</p>
        </CardFooter>
      ) : (
        <CardFooter className="flex flex-wrap items-center gap-2">
          <Button type="button" disabled={readOnly || model.unsupported.length > 0} onClick={submit}>Submit</Button>
          <Button type="button" variant="outline" disabled={readOnly} onClick={() => onSkip?.()}>Skip</Button>
          <Button type="button" variant="ghost" disabled={readOnly} onClick={() => onCancel?.()}>Cancel</Button>
          {state === "awaiting_confirmation" && (
            <span className="text-xs text-muted-foreground">Waiting for confirmation…</span>
          )}
        </CardFooter>
      )}
    </Card>
  );
}

function QuestionField({ field, values, errors, disabled, onChange }: {
  field: FormField;
  values: FormValues;
  errors: Record<string, string>;
  disabled: boolean;
  onChange: (key: string, value: unknown) => void;
}) {
  const id = useId();
  const label = `${field.label}${field.required ? " *" : ""}`;
  const helper = <>
    {field.description && <p id={`${id}-description`} className="text-xs text-muted-foreground whitespace-pre-wrap break-words">{field.description}</p>}
    {errors[field.key] && <p id={`${id}-error`} role="alert" className="text-xs text-destructive">{errors[field.key]}</p>}
  </>;
  const a11y = {
    "aria-required": field.required,
    "aria-invalid": Boolean(errors[field.key]),
    "aria-describedby": [field.description ? `${id}-description` : "", errors[field.key] ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined,
  };
  if (field.kind === "select" || field.kind === "multiselect") {
    const multi = field.kind === "multiselect";
    const selected = Array.isArray(values[field.key]) ? values[field.key] as string[] : [];
    return <fieldset className="min-w-0 space-y-2" disabled={disabled} {...a11y}>
      <legend className="mb-2 font-medium">{label}</legend>
      {helper}
      {field.options?.map((option, index) => <div key={option.value} className="min-w-0">
        <label className="flex items-start gap-2 break-words">
          <input className="mt-1 shrink-0 accent-primary" type={multi ? "checkbox" : "radio"} name={id} value={option.value}
            checked={multi ? selected.includes(option.value) : values[field.key] === option.value}
            aria-describedby={option.description ? `${id}-option-${index}` : undefined}
            onChange={(event) => onChange(field.key, multi
              ? event.target.checked ? [...selected, option.value] : selected.filter((value) => value !== option.value)
              : option.value)} />
          <span className="min-w-0 break-words [overflow-wrap:anywhere]">{option.label}</span>
        </label>
        {option.description && <p id={`${id}-option-${index}`} className="ml-5 text-xs text-muted-foreground break-words">{option.description}</p>}
      </div>)}
      {field.customKey && <div className="space-y-1 pt-1">
        <label htmlFor={`${id}-custom`} className="text-sm">{field.customLabel ?? "Other"}</label>
        <Input id={`${id}-custom`} value={String(values[field.customKey] ?? "")} disabled={disabled}
          aria-invalid={Boolean(errors[field.customKey])} onChange={(event) => onChange(field.customKey!, event.target.value)} />
        {field.customDescription && <p className="text-xs text-muted-foreground">{field.customDescription}</p>}
        {errors[field.customKey] && <p role="alert" className="text-xs text-destructive">{errors[field.customKey]}</p>}
      </div>}
    </fieldset>;
  }
  return <div className="min-w-0 space-y-1">
    {field.kind === "boolean" ? <label className="flex items-center gap-2" htmlFor={id}>
      <input id={id} type="checkbox" disabled={disabled} checked={values[field.key] === true}
        {...a11y} onChange={(event) => onChange(field.key, event.target.checked)} />{label}
    </label> : <>
      <label htmlFor={id} className="font-medium">{label}</label>
      <Input id={id} disabled={disabled} {...a11y} value={String(values[field.key] ?? "")}
        inputMode={field.kind === "integer" ? "numeric" : field.kind === "number" ? "decimal" : "text"}
        onChange={(event) => onChange(field.key, event.target.value)} />
    </>}
    {helper}
  </div>;
}
