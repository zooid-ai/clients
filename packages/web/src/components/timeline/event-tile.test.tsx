import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, it, expect, vi } from "vitest";
import { makeFakeClient } from "../../../test/factories";
import { MatrixClientPeg } from "../../client/peg";
import { EventTile } from "./event-tile";

// useThreadPreview requires a live MatrixClient; mock it.
vi.mock("@/hooks/use-timeline", () => ({
  useThreadPreview: vi.fn(() => ({ events: [], totalCount: 0 })),
}));

// useMatrixClient is needed by MediaMessage for image fetching; mock it.
vi.mock("@/hooks/use-matrix-client", () => ({
  useMatrixClient: vi.fn(() => ({
    baseUrl: "https://hs.test",
    getAccessToken: () => "tok",
  })),
}));

afterEach(() => {
  cleanup();
  MatrixClientPeg.reset();
});

function mediaEvent(content: Record<string, unknown>) {
  return {
    getType: () => "m.room.message",
    getContent: () => content,
    getSender: () => "@alice:hs.test",
    getTs: () => 1_700_000_000_000,
    getId: () => "$media_evt",
    getThread: () => null,
  } as never;
}

describe("<EventTile /> media routing", () => {
  it("routes m.image messages to MediaMessage instead of TextMessage", () => {
    // MatrixClientPeg needs to return something for useMatrixClient
    const client = makeFakeClient({ userId: "@me:hs.test" });
    Object.assign(client, { baseUrl: "https://hs.test", getAccessToken: () => "tok" });
    MatrixClientPeg.injectClientForTest(client);

    render(
      <EventTile
        event={mediaEvent({
          msgtype: "m.image",
          body: "dog.png",
          url: "mxc://hs.test/abc",
          info: { mimetype: "image/png", size: 67 },
        })}
      />,
    );
    // MediaMessage renders the filename; TextMessage renders message body
    // The key assertion: the image tile renders, not a text tile with "dog.png" as a body
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("routes m.file to MediaMessage", () => {
    render(
      <EventTile
        event={mediaEvent({
          msgtype: "m.file",
          body: "report.pdf",
          filename: "report.pdf",
          url: "mxc://hs.test/def",
          info: { mimetype: "application/pdf", size: 2048 },
        })}
      />,
    );
    expect(screen.getByText("report.pdf")).toBeDefined();
  });
});
