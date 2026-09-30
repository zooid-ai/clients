import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EventType } from "matrix-js-sdk";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  injectStateEvent,
  makeFakeClient,
  makeRoom,
  mkMatrixEvent,
  pushTimelineEvent,
} from "../../../test/factories";
import { MatrixClientPeg } from "../../client/peg";
import { ElicitationEventType } from "../../events/elicitation";
import { QuestionCard } from "./question-card";

const me = "@me:h.example";
const agent = "@architect.acme:h.example";
const roomId = "!r:h.example";
const thread = { "m.relates_to": { rel_type: "m.thread", event_id: "$root" } };
const schema = {
  type: "object",
  properties: { env: { type: "string", title: "Env", oneOf: [{ const: "staging", title: "Staging" }, { const: "prod", title: "Production" }] } },
  required: ["env"],
};

function requestEvent() {
  return mkMatrixEvent({
    roomId, sender: agent, type: ElicitationEventType.Request, eventId: "$ereq",
    content: { version: 1, request_id: "e1", session_id: "s1", tool_call_id: "tc1", message: "Which env?", requested_schema: schema, ...thread },
  });
}

function setup(opts: { canAnswer?: boolean; sendEvent?: ReturnType<typeof vi.fn> } = {}) {
  const client = makeFakeClient({ userId: me });
  const room = makeRoom(roomId, { client, myUserId: me, powerLevels: { [me]: 50 } });
  if (opts.canAnswer === false) {
    injectStateEvent(room, mkMatrixEvent({
      roomId, sender: "@admin:h.example", type: EventType.RoomPowerLevels, stateKey: "",
      content: { users: { [me]: 0 }, users_default: 0, events_default: 0, state_default: 50, events: { [ElicitationEventType.Response]: 50 } },
    }));
  }
  (client as unknown as { getRoom: () => unknown }).getRoom = () => room;
  const sendEvent = opts.sendEvent ?? vi.fn().mockResolvedValue({ event_id: "$mine" });
  (client as unknown as { sendEvent: unknown }).sendEvent = sendEvent;
  MatrixClientPeg.injectClientForTest(client);
  const req = requestEvent();
  pushTimelineEvent(room, req);
  return { client, room, req, sendEvent };
}

afterEach(() => MatrixClientPeg.reset());

describe("<QuestionCard /> (Matrix-wired)", () => {
  it("submits an accept response that references the request and its thread", async () => {
    const { req, sendEvent } = setup();
    render(<QuestionCard event={req} />);
    await userEvent.click(screen.getByRole("radio", { name: "Production" }));
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(sendEvent).toHaveBeenCalledWith(roomId, ElicitationEventType.Response, {
      version: 1, request_id: "e1", request_event_id: "$ereq", action: "accept", content: { env: "prod" }, ...thread,
    });
    // Not shown as accepted until the daemon confirms.
    expect(await screen.findByText(/waiting for confirmation/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit" })).toBeDisabled();
  });

  it.each([["Skip", "decline"], ["Cancel", "cancel"]] as const)("%s sends action %s without content", async (label, action) => {
    const { req, sendEvent } = setup();
    render(<QuestionCard event={req} />);
    await userEvent.click(screen.getByRole("button", { name: label }));
    expect(sendEvent).toHaveBeenCalledWith(roomId, ElicitationEventType.Response, {
      version: 1, request_id: "e1", request_event_id: "$ereq", action, ...thread,
    });
  });

  it("goes read-only when the requesting agent publishes resolved", async () => {
    const { room, req } = setup();
    render(<QuestionCard event={req} />);
    act(() => pushTimelineEvent(room, mkMatrixEvent({
      roomId, sender: agent, type: ElicitationEventType.Resolved,
      content: { version: 1, request_id: "e1", request_event_id: "$ereq", status: "accepted", responded_by: "@bob:h.example", ...thread },
    })));
    expect(await screen.findByText(/answered by/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Submit" })).not.toBeInTheDocument();
  });

  it("ignores a resolved event forged by someone other than the agent", async () => {
    const { room, req } = setup();
    render(<QuestionCard event={req} />);
    act(() => pushTimelineEvent(room, mkMatrixEvent({
      roomId, sender: "@mallory:h.example", type: ElicitationEventType.Resolved,
      content: { version: 1, request_id: "e1", status: "accepted", responded_by: "@mallory:h.example", ...thread },
    })));
    expect(screen.getByRole("button", { name: "Submit" })).toBeEnabled();
  });

  it("shows the daemon's field errors for my rejected response and re-enables the form", async () => {
    const { room, req } = setup();
    render(<QuestionCard event={req} />);
    await userEvent.click(screen.getByRole("radio", { name: "Production" }));
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));
    act(() => pushTimelineEvent(room, mkMatrixEvent({
      roomId, sender: agent, type: ElicitationEventType.Rejected,
      content: { version: 1, request_id: "e1", request_event_id: "$ereq", response_event_id: "$mine", reason: "invalid", errors: { env: "must be one of: staging, prod" }, ...thread },
    })));
    expect(await screen.findByText("must be one of: staging, prod")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Submit" })).toBeEnabled());
  });

  it("shows stale feedback when the daemon is no longer waiting", async () => {
    const { room, req } = setup();
    render(<QuestionCard event={req} />);
    await userEvent.click(screen.getByRole("button", { name: "Skip" }));
    act(() => pushTimelineEvent(room, mkMatrixEvent({
      roomId, sender: agent, type: ElicitationEventType.Rejected,
      content: { version: 1, request_id: "e1", request_event_id: "$ereq", response_event_id: "$mine", reason: "stale", ...thread },
    })));
    expect(await screen.findByRole("alert")).toHaveTextContent(/no longer waiting/i);
  });

  it("surfaces a send failure and re-enables the form", async () => {
    const { req } = setup({ sendEvent: vi.fn().mockRejectedValue(new Error("M_FORBIDDEN")) });
    render(<QuestionCard event={req} />);
    await userEvent.click(screen.getByRole("button", { name: "Skip" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("M_FORBIDDEN");
    expect(screen.getByRole("button", { name: "Skip" })).toBeEnabled();
  });

  it("hides the controls when the user may not send responses", () => {
    const { req } = setup({ canAnswer: false });
    render(<QuestionCard event={req} />);
    expect(screen.queryByRole("button", { name: "Submit" })).not.toBeInTheDocument();
    expect(screen.getByText(/insufficient permission/i)).toBeInTheDocument();
  });
});

describe('confirmed answers after reload', () => {
  it('displays the accepted values for all viewers', () => {
    const { room, req } = setup();
    pushTimelineEvent(room, mkMatrixEvent({
      roomId, sender: agent, type: ElicitationEventType.Resolved,
      content: { version: 1, request_id: "e1", request_event_id: "$ereq", status: "accepted", responded_by: "@bob:h.example", content: { env: "prod" }, ...thread },
    }));
    render(<QuestionCard event={req} />);
    expect(screen.getByRole("radio", { name: "Production" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Production" })).toBeDisabled();
  });
});
