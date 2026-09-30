import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { QuestionCardView } from "./question-card-view";
import { buildFormModel } from "../../lib/elicitation-form";

const model = buildFormModel({
  type: "object",
  properties: {
    question_0: { type: "string", title: "Env", oneOf: [{ const: "staging", title: "Staging" }, { const: "prod", title: "Production" }] },
    question_0_custom: { type: "string", title: "Other", _meta: { _askUserQuestionCustomAnswer: { questionId: "question_0", isCustomAnswer: true } } },
  },
});

const base = { agentName: "architect", message: "Which environment?", model, state: "open" as const };

describe("<QuestionCardView />", () => {
  it("renders the agent, question, options, custom field and three actions", () => {
    render(<QuestionCardView {...base} onSubmit={vi.fn()} onSkip={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText("architect")).toBeInTheDocument();
    expect(screen.getByText("Which environment?")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Production" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /other/i })).toBeInTheDocument();
    for (const name of ["Submit", "Skip", "Cancel"]) expect(screen.getByRole("button", { name })).toBeEnabled();
  });

  it("submits typed content", async () => {
    const onSubmit = vi.fn();
    render(<QuestionCardView {...base} onSubmit={onSubmit} onSkip={vi.fn()} onCancel={vi.fn()} />);
    await userEvent.click(screen.getByRole("radio", { name: "Production" }));
    await userEvent.type(screen.getByRole("textbox", { name: /other/i }), "after 5pm");
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(onSubmit).toHaveBeenCalledWith({ question_0: "prod", question_0_custom: "after 5pm" });
  });

  it("flags an empty required field and does not submit", async () => {
    const required = buildFormModel({ type: "object", properties: { env: { type: "string" } }, required: ["env"] });
    const onSubmit = vi.fn();
    render(<QuestionCardView {...base} model={required} onSubmit={onSubmit} onSkip={vi.fn()} onCancel={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText("required")).toBeInTheDocument();
  });

  it("shows server field errors passed in", () => {
    render(<QuestionCardView {...base} fieldErrors={{ question_0: "must be one of: staging, prod" }} onSubmit={vi.fn()} onSkip={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText("must be one of: staging, prod")).toBeInTheDocument();
  });

  it("disables actions while sending", () => {
    render(<QuestionCardView {...base} state="sending" onSubmit={vi.fn()} onSkip={vi.fn()} onCancel={vi.fn()} />);
    for (const name of ["Submit", "Skip", "Cancel"]) expect(screen.getByRole("button", { name })).toBeDisabled();
  });

  it("renders read-only with the responder once resolved", () => {
    render(<QuestionCardView {...base} state="resolved" resolution={{ status: "accepted", respondedBy: "Beno" }} />);
    expect(screen.getByText(/answered by/i)).toHaveTextContent("Answered by Beno");
    expect(screen.queryByRole("button", { name: "Submit" })).not.toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Production" })).toBeDisabled();
  });

  it.each([
    ["declined", /skipped by/i],
    ["cancelled", /cancelled/i],
    ["interrupted", /no longer answerable/i],
  ] as const)("renders %s as read-only", (status, text) => {
    render(<QuestionCardView {...base} state="resolved" resolution={{ status, respondedBy: "Beno" }} />);
    expect(screen.getByText(text)).toBeInTheDocument();
  });

  it("shows stale feedback", () => {
    render(<QuestionCardView {...base} stale onSubmit={vi.fn()} onSkip={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole("alert")).toHaveTextContent(/no longer waiting/i);
  });

  it("renders unsupported fields visibly and disables Submit", () => {
    const bad = buildFormModel({ type: "object", properties: { o: { type: "object" } } });
    render(<QuestionCardView {...base} model={bad} onSubmit={vi.fn()} onSkip={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole("alert")).toHaveTextContent(/can't be shown/i);
    expect(screen.getByRole("button", { name: "Submit" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Skip" })).toBeEnabled();
  });

  it("renders untrusted text as text, never HTML", () => {
    render(<QuestionCardView {...base} message={'<img src=x onerror="alert(1)">'} onSubmit={vi.fn()} onSkip={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText('<img src=x onerror="alert(1)">')).toBeInTheDocument();
    expect(document.querySelector("img")).toBeNull();
  });
});
