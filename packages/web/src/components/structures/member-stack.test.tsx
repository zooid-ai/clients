import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { makeFakeClient } from "../../../test/factories";
import { MatrixClientPeg } from "../../client/peg";
import { roleForLevel } from "../../lib/roles";
import type { MemberRole } from "../../hooks/use-member-roles";
import { MemberStack, pickStackMembers } from "./member-stack";

const me = "@me:h.example";

function member(userId: string, displayName: string): MemberRole {
  return { userId, displayName, powerLevel: 0, role: roleForLevel(0) };
}

afterEach(() => MatrixClientPeg.reset());

describe("pickStackMembers", () => {
  it("orders by last-active descending and caps at three", () => {
    const members = [
      member("@a:h", "Alice"),
      member("@b:h", "Bob"),
      member("@c:h", "Carol"),
      member("@d:h", "Dave"),
    ];
    const ts: Record<string, number> = { "@a:h": 10, "@b:h": 40, "@c:h": 20, "@d:h": 30 };
    const shown = pickStackMembers(members, (id) => ts[id] ?? 0);
    expect(shown.map((m) => m.userId)).toEqual(["@b:h", "@d:h", "@c:h"]);
  });

  it("falls back to a stable display-name order when activity data is absent", () => {
    const members = [member("@c:h", "Carol"), member("@a:h", "Alice"), member("@b:h", "Bob")];
    const shown = pickStackMembers(members, () => 0);
    expect(shown.map((m) => m.displayName)).toEqual(["Alice", "Bob", "Carol"]);
  });
});

function setupClient() {
  const client = makeFakeClient({ userId: me });
  (client as unknown as { getUser: (id: string) => unknown }).getUser = () => null;
  MatrixClientPeg.injectClientForTest(client);
}

describe("<MemberStack>", () => {
  it("renders an avatar per shown member plus a +N overflow chip", () => {
    setupClient();
    const members = [
      member("@a:h", "Alice"),
      member("@b:h", "Bob"),
      member("@c:h", "Carol"),
      member("@d:h", "Dave"),
      member("@e:h", "Eve"),
    ];
    render(<MemberStack members={members} />);
    expect(screen.getByRole("button", { name: /5 members/i })).toBeInTheDocument();
    expect(screen.getAllByRole("img")).toHaveLength(3);
    expect(screen.getByText("+2")).toBeInTheDocument();
  });

  it("shows no overflow chip when everyone fits", () => {
    setupClient();
    render(<MemberStack members={[member("@a:h", "Alice"), member("@b:h", "Bob")]} />);
    expect(screen.getByRole("button", { name: /2 members/i })).toBeInTheDocument();
    expect(screen.queryByText(/^\+/)).toBeNull();
  });

  it("fires onToggle when clicked", async () => {
    setupClient();
    const onToggle = vi.fn();
    render(<MemberStack members={[member(me, "me")]} open={false} onToggle={onToggle} />);
    await userEvent.click(screen.getByRole("button", { name: /1 member/i }));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
