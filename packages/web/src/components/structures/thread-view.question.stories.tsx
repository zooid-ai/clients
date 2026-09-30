import type { Meta, StoryObj } from "@storybook/react-vite";
import { makeFakeClient, makeRoom, mkMatrixEvent, pushTimelineEvent } from "../../../test/factories";
import { MatrixClientPeg } from "../../client/peg";
import { ThreadView } from "./thread-view";
import { askSchema } from "../timeline/question-card-view.stories";

const me = "@me:h.example";
const agent = "@architect.acme:h.example";
const roomId = "!question:h.example";
const root = "$question-root";
const thread = { "m.relates_to": { rel_type: "m.thread", event_id: root } };
function seed(answered: boolean) {
  const client = makeFakeClient({ userId: me });
  const room = makeRoom(roomId, { client, myUserId: me });
  (client as unknown as { getRoom: (id: string) => unknown }).getRoom = (id) => id === roomId ? room : null;
  // Stories must stay offline even when TimelinePanel asks for pagination.
  (client as unknown as { paginateEventTimeline: unknown }).paginateEventTimeline = async () => false;
  const add = (id: string, type: string, sender: string, content: Record<string, unknown>) => pushTimelineEvent(room, mkMatrixEvent({ roomId, eventId: id, sender, type, content }));
  add(root, "m.room.message", me, { msgtype: "m.text", body: "Prepare a deployment. Ask me which environment first." });
  add("$question-prose", "m.room.message", agent, { msgtype: "m.notice", body: "I have the deployment ready. One choice before I continue.", ...thread });
  add("$question-tool", "dev.zooid.tool_call", agent, { session_id: "s1", tool_call_id: "tc1", title: "AskUserQuestion", kind: "other", status: "in_progress", ...thread });
  add("$question-request", "dev.zooid.elicitation_request", agent, { version: 1, request_id: "question-1", session_id: "s1", message: "Which environment should I deploy to?", requested_schema: askSchema, ...thread });
  if (answered) {
    add("$question-answer", "dev.zooid.elicitation_response", me, { request_id: "question-1", request_event_id: "$question-request", action: "accept", content: { question_0: "staging" }, ...thread });
    add("$question-resolved", "dev.zooid.elicitation_resolved", agent, { version: 1, request_id: "question-1", request_event_id: "$question-request", response_event_id: "$question-answer", status: "accepted", responded_by: me, content: { question_0: "staging" }, ...thread });
    add("$question-continued", "m.room.message", agent, { msgtype: "m.notice", body: "Thanks. I’m preparing the staging deployment now.", ...thread });
  }
  MatrixClientPeg.injectClientForTest(client);
}
const meta = { title: "Structures/ThreadViewQuestion", component: ThreadView, parameters: { layout: "fullscreen" }, args: { roomId, rootEventId: root, onBack: () => {} } } satisfies Meta<typeof ThreadView>;
export default meta;
type Story = StoryObj<typeof meta>;
export const OpenQuestion: Story = { render: (args) => { seed(false); return <ThreadView {...args} />; } };
export const AnsweredThenContinued: Story = { render: (args) => { seed(true); return <ThreadView {...args} />; } };
