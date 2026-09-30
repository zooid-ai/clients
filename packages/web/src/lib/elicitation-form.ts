// Builds the card from the request schema and serializes the answer. It doesn't
// validate schema rules: the daemon does (@zooid/core elicitation-schema.ts) and
// returns per-field errors in elicitation_rejected.

export type FieldKind = "text" | "number" | "integer" | "boolean" | "select" | "multiselect";

export interface FieldOption {
  value: string;
  label: string;
  description?: string;
}

export interface FormField {
  key: string;
  kind: FieldKind;
  label: string;
  description?: string;
  required: boolean;
  options?: FieldOption[];
  /** Grouped free-text answer (Claude's per-question "Other"). */
  customKey?: string;
  customLabel?: string;
  customDescription?: string;
}

export interface FormModel {
  schema: Record<string, unknown>;
  fields: FormField[];
  /** Property keys this client cannot render. */
  unsupported: string[];
  initialValues: Record<string, unknown>;
}

export type FormValues = Record<string, unknown>;
export type Submission =
  | { ok: true; content: Record<string, string | number | boolean | string[]> }
  | { ok: false; errors: Record<string, string> };

const CUSTOM_META = "_askUserQuestionCustomAnswer";
type Prop = Record<string, unknown>;
const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown) => (typeof v === "string" ? v : undefined);

function optionsOf(p: Prop): FieldOption[] | undefined {
  if (Array.isArray(p.oneOf)) {
    return p.oneOf.flatMap((o) =>
      isObj(o) && typeof o.const === "string"
        ? [{ value: o.const, label: str(o.title) ?? o.const, description: str(o.description) }]
        : [],
    );
  }
  if (Array.isArray(p.enum)) {
    return p.enum.flatMap((v) => (typeof v === "string" ? [{ value: v, label: v }] : []));
  }
  return undefined;
}

function itemOptionsOf(p: Prop): FieldOption[] | undefined {
  const items = p.items;
  if (!isObj(items)) return undefined;
  if (Array.isArray(items.anyOf)) return optionsOf({ oneOf: items.anyOf });
  if (items.type === "string" && Array.isArray(items.enum)) return optionsOf({ enum: items.enum });
  return undefined;
}

function customTarget(p: Prop): string | undefined {
  const meta = isObj(p._meta) ? p._meta[CUSTOM_META] : undefined;
  return isObj(meta) && meta.isCustomAnswer === true ? str(meta.questionId) : undefined;
}

export function buildFormModel(schema: Record<string, unknown>): FormModel {
  const props = (isObj(schema.properties) ? schema.properties : {}) as Record<string, Prop>;
  const required = new Set(Array.isArray(schema.required) ? schema.required : []);
  const fields: FormField[] = [];
  const unsupported: string[] = [];
  const initialValues: Record<string, unknown> = Object.create(null);
  const choiceKeys = new Set(
    Object.entries(props)
      .filter(([, p]) => (p.type === "string" && optionsOf(p)) || (p.type === "array" && itemOptionsOf(p)))
      .map(([k]) => k),
  );

  for (const [key, p] of Object.entries(props)) {
    if (p.default !== undefined && p.default !== null) initialValues[key] = p.default;
    const target = customTarget(p);
    if (target && choiceKeys.has(target)) continue; // grouped below
    let kind: FieldKind | undefined;
    let options: FieldOption[] | undefined;
    if (p.type === "string") {
      options = optionsOf(p);
      kind = options ? "select" : "text";
    } else if (p.type === "number" || p.type === "integer" || p.type === "boolean") {
      kind = p.type;
    } else if (p.type === "array") {
      options = itemOptionsOf(p);
      if (options) kind = "multiselect";
    }
    if (!kind) {
      unsupported.push(key);
      continue;
    }
    const field: FormField = {
      key,
      kind,
      label: str(p.title) ?? key,
      description: str(p.description),
      required: required.has(key),
      ...(options ? { options } : {}),
    };
    if (kind === "select" || kind === "multiselect") {
      const custom = Object.entries(props).find(([, cp]) => customTarget(cp) === key);
      if (custom) {
        field.customKey = custom[0];
        field.customLabel = str(custom[1].title) ?? "Other";
        field.customDescription = str(custom[1].description);
      }
    }
    fields.push(field);
    // Defaults are editable suggestions: pre-filled, never auto-submitted.
    if (p.default !== undefined && p.default !== null) initialValues[key] = p.default;
  }
  return { schema, fields, unsupported, initialValues };
}

export function toSubmission(model: FormModel, values: FormValues): Submission {
  const props = (isObj(model.schema.properties) ? model.schema.properties : {}) as Record<string, Prop>;
  const required = new Set(Array.isArray(model.schema.required) ? model.schema.required : []);
  const errors: Record<string, string> = Object.create(null);
  const content: Record<string, string | number | boolean | string[]> = Object.create(null);
  for (const [key, p] of Object.entries(props)) {
    let v = values[key];
    if ((p.type === "number" || p.type === "integer") && typeof v === "string" && v.trim() !== "") {
      v = Number(v);
      if (!Number.isFinite(v)) {
        errors[key] = p.type === "integer" ? "must be an integer" : "must be a number";
        continue;
      }
    }
    if ((p.type === "number" || p.type === "integer") && typeof v === "string" && v.trim() === "") v = undefined;
    const empty = v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
    if (empty) {
      if (required.has(key)) errors[key] = "required";
      continue;
    }
    content[key] = v as string | number | boolean | string[];
  }
  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, content };
}
