import { describe, expect, it } from "vitest";
import { buildFormModel, toSubmission } from "./elicitation-form";

const askSchema = {
  type: "object",
  properties: {
    question_0: {
      type: "string", title: "Env", description: "Which environment?",
      oneOf: [{ const: "staging", title: "Staging" }, { const: "prod", title: "Production", description: "Live" }],
    },
    question_0_custom: {
      type: "string", title: "Other",
      _meta: { _askUserQuestionCustomAnswer: { questionId: "question_0", isCustomAnswer: true } },
    },
    question_1: {
      type: "array", title: "Checks",
      items: { anyOf: [{ const: "lint", title: "Lint" }, { const: "test", title: "Test" }] },
    },
    question_1_custom: {
      type: "string", title: "Other",
      _meta: { _askUserQuestionCustomAnswer: { questionId: "question_1", isCustomAnswer: true } },
    },
  },
};

const typed = {
  type: "object",
  properties: {
    name: { type: "string", minLength: 2, maxLength: 5, default: "abc" },
    count: { type: "integer", minimum: 1, maximum: 3 },
    ok: { type: "boolean", default: true },
    tags: { type: "array", items: { type: "string", enum: ["a", "b", "c"] }, maxItems: 2 },
  },
  required: ["name", "ok"],
};

describe("buildFormModel", () => {
  it("builds select + multiselect fields and groups custom answers under their question", () => {
    const m = buildFormModel(askSchema);
    expect(m.unsupported).toEqual([]);
    expect(m.fields.map((f) => [f.key, f.kind, f.customKey])).toEqual([
      ["question_0", "select", "question_0_custom"],
      ["question_1", "multiselect", "question_1_custom"],
    ]);
    expect(m.fields[0]!.options).toEqual([
      { value: "staging", label: "Staging", description: undefined },
      { value: "prod", label: "Production", description: "Live" },
    ]);
  });

  it("keeps an unrecognized custom field as a plain text field rather than dropping it", () => {
    const m = buildFormModel({
      type: "object",
      properties: { note: { type: "string", _meta: { _askUserQuestionCustomAnswer: { questionId: "ghost" } } } },
    });
    expect(m.fields.map((f) => [f.key, f.kind])).toEqual([["note", "text"]]);
  });

  it("maps primitive types and required flags, with defaults as initial values", () => {
    const m = buildFormModel(typed);
    expect(m.fields.map((f) => [f.key, f.kind, f.required])).toEqual([
      ["name", "text", true], ["count", "integer", false], ["ok", "boolean", true], ["tags", "multiselect", false],
    ]);
    expect(m.initialValues).toEqual({ name: "abc", ok: true });
  });

  it("reports unsupported property types instead of coercing them", () => {
    const m = buildFormModel({ type: "object", properties: { o: { type: "object" } } });
    expect(m.unsupported).toEqual(["o"]);
  });
});

describe("toSubmission (serializes the form; the daemon validates)", () => {
  it("drops empty optional values and passes a valid answer", () => {
    const m = buildFormModel(askSchema);
    expect(toSubmission(m, { question_0: "prod", question_0_custom: "", question_1: [] })).toEqual({
      ok: true, content: { question_0: "prod" },
    });
  });
  it("flags empty required fields", () => {
    const m = buildFormModel(typed);
    expect(toSubmission(m, { name: "", ok: undefined })).toEqual({
      ok: false, errors: { name: "required", ok: "required" },
    });
  });
  it("leaves schema rules to the daemon: out-of-bounds values pass through", () => {
    const m = buildFormModel(typed);
    expect(toSubmission(m, { name: "x", count: "9", ok: true, tags: ["a", "b", "c"] })).toEqual({
      ok: true, content: { name: "x", count: 9, ok: true, tags: ["a", "b", "c"] },
    });
  });
  it("parses integer/number inputs from strings and rejects non-numbers", () => {
    const m = buildFormModel(typed);
    expect(toSubmission(m, { name: "ab", ok: false, count: "2" })).toEqual({
      ok: true, content: { name: "ab", ok: false, count: 2 },
    });
    expect(toSubmission(m, { name: "ab", ok: false, count: "two" })).toEqual({
      ok: false, errors: { count: "must be an integer" },
    });
  });
});
