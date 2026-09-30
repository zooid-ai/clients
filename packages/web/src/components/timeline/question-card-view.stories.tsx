import type { Meta, StoryObj } from "@storybook/react-vite";
import { buildFormModel } from "../../lib/elicitation-form";
import { QuestionCardView } from "./question-card-view";

export const askSchema = {
  type: "object",
  properties: {
    question_0: { type: "string", title: "Environment", description: "Where should I deploy?", oneOf: [
      { const: "staging", title: "Staging (Recommended)", description: "Try the change before production." },
      { const: "production", title: "Production", description: "Make the change available to everyone." },
      { const: "local", title: "Local", description: "Run on your computer." },
    ] },
    question_0_custom: { type: "string", title: "Other", description: "Add a custom answer or context.", _meta: { _askUserQuestionCustomAnswer: { questionId: "question_0", isCustomAnswer: true } } },
  },
};
export const typedSchema = {
  type: "object",
  properties: {
    name: { type: "string", title: "Project name", minLength: 2 },
    email: { type: "string", title: "Contact email", format: "email" },
    count: { type: "integer", title: "Instances", minimum: 1, maximum: 5 },
    ratio: { type: "number", title: "Traffic share", minimum: 0, maximum: 1 },
    enabled: { type: "boolean", title: "Enable logging", default: true },
    tags: { type: "array", title: "Checks", items: { type: "string", enum: ["lint", "test", "build"] }, maxItems: 2 },
  },
  required: ["name", "count"],
};
const meta = {
  title: "Timeline/QuestionCardView",
  component: QuestionCardView,
  args: { agentName: "architect", message: "Which environment should I deploy to?", model: buildFormModel(askSchema), state: "open", onSubmit: (content) => { window.dispatchEvent(new CustomEvent("question-submit", { detail: content })); } },
} satisfies Meta<typeof QuestionCardView>;
export default meta;
type Story = StoryObj<typeof meta>;
export const SingleQuestion: Story = {};
export const MultipleQuestions: Story = { args: { model: buildFormModel({ ...askSchema, properties: {
  ...askSchema.properties,
  question_1: { type: "array", title: "Checks", description: "Which checks should run?", items: { anyOf: [{ const: "lint", title: "Lint" }, { const: "test", title: "Test" }] } },
  question_1_custom: { type: "string", title: "Other checks", _meta: { _askUserQuestionCustomAnswer: { questionId: "question_1", isCustomAnswer: true } } },
} }) } };
export const TypedFields: Story = { args: { message: "Configure the deployment", model: buildFormModel(typedSchema) } };
export const ServerErrors: Story = { args: { model: buildFormModel(typedSchema), fieldErrors: { name: "must be at least 2 characters", count: "must be ≤ 5" } } };
export const Sending: Story = { args: { state: "sending" } };
export const AwaitingConfirmation: Story = { args: { state: "awaiting_confirmation" } };
export const Stale: Story = { args: { stale: true } };
export const SendError: Story = { args: { error: "M_FORBIDDEN: Your response could not be sent. Try again." } };
export const Unsupported: Story = { args: { model: buildFormModel({ type: "object", properties: { note: { type: "string", title: "Note" }, nested: { type: "object" } } }) } };
export const Answered: Story = { args: { state: "resolved", model: buildFormModel({ ...askSchema, properties: { ...askSchema.properties, question_0: { ...askSchema.properties.question_0, default: "staging" } } }), resolution: { status: "accepted", respondedBy: "Ori" } } };
export const Skipped: Story = { args: { state: "resolved", resolution: { status: "declined", respondedBy: "Ori" } } };
export const Cancelled: Story = { args: { state: "resolved", resolution: { status: "cancelled" } } };
export const Interrupted: Story = { args: { state: "resolved", resolution: { status: "interrupted" } } };
export const NoPermission: Story = { args: { canAnswer: false } };
export const LongContent: Story = { args: { message: "Please consider the deployment environment and the implications of this change. ".repeat(6), model: buildFormModel({ type: "object", properties: { env: { type: "string", title: "Environment", enum: ["production-with-a-very-long-environment-name", "/workspace/" + "very-long-unbreakable-path".repeat(12)] } } }) } };
export const UntrustedMarkup: Story = { args: { message: '<img src=x onerror="alert(1)"> **Which environment?**', model: buildFormModel({ type: "object", properties: { env: { type: "string", oneOf: [{ const: "prod", title: "<script>alert(1)</script> **Production**" }] } } }) } };
