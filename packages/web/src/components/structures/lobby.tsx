import { useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MatrixClientPeg } from "../../client/peg";
import { useJoinRoom } from "../../hooks/use-join-room";
import { useRoomTopic } from "../../hooks/use-room-topic";
import { useSpaceHierarchy, type SpaceChild } from "../../hooks/use-space-hierarchy";
import { useSpaceName } from "../../hooks/use-space-name";
import { TopicText } from "../timeline/topic-text";
import { EmptyRoom } from "./empty-room";
import type { LoggedInOutletContext } from "./logged-in-view";
import type { Scope } from "./sidebar/scope";
import { SpaceChildRow } from "./space-child-row";

/** Route wrapper: resolves the active space from the logged-in Outlet context. */
export function LobbyRoute() {
  const { spaceId, setScope } = useOutletContext<LoggedInOutletContext>();
  if (!spaceId) return <EmptyRoom />;
  return <Lobby spaceId={spaceId} setScope={setScope} />;
}

export function Lobby({
  spaceId,
  setScope,
}: {
  spaceId: string;
  setScope: (scope: Scope) => void;
}) {
  const navigate = useNavigate();
  const name = useSpaceName(spaceId) ?? MatrixClientPeg.safeGet()?.getRoom(spaceId)?.name ?? spaceId;
  const topic = useRoomTopic(spaceId);
  const memberCount = MatrixClientPeg.safeGet()?.getRoom(spaceId)?.getJoinedMemberCount() ?? 0;
  const { children } = useSpaceHierarchy(spaceId, true);
  const { joinRoom } = useJoinRoom();
  const [term, setTerm] = useState("");
  const [joinedOnly, setJoinedOnly] = useState(false);

  const q = term.trim().toLowerCase();
  const matches = (c: SpaceChild) =>
    !q || (c.name ?? c.roomId).toLowerCase().includes(q) || (c.topic ?? "").toLowerCase().includes(q);

  const rooms = children.filter((c) => c.kind === "room" && matches(c) && (!joinedOnly || c.joined));
  const spaces = children.filter((c) => c.kind === "space" && matches(c));

  const activateRoom = (child: SpaceChild) => {
    if (child.joined) navigate(`/room/${child.roomId}`);
    else void joinRoom(child.roomId);
  };
  const activateSpace = (child: SpaceChild) => {
    setScope({ kind: "space", spaceId: child.roomId });
    navigate("/");
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto">
      <header className="border-b border-border px-6 py-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{name}</h1>
        {topic && (
          <div className="mt-2 text-sm leading-6 text-muted-foreground">
            <TopicText topic={topic} clamp={false} />
          </div>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          {memberCount} member{memberCount !== 1 ? "s" : ""}
        </p>
      </header>
      <div className="flex items-center gap-2 border-b border-border px-6 py-3">
        <Input
          type="search"
          aria-label="Filter rooms"
          placeholder="Filter…"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          className="flex-1"
        />
        <div className="ml-auto flex items-center gap-1">
          <Button
            size="sm"
            variant={joinedOnly ? "ghost" : "secondary"}
            aria-pressed={!joinedOnly}
            onClick={() => setJoinedOnly(false)}
          >
            All
          </Button>
          <Button
            size="sm"
            variant={joinedOnly ? "secondary" : "ghost"}
            aria-pressed={joinedOnly}
            onClick={() => setJoinedOnly(true)}
          >
            Joined
          </Button>
        </div>
      </div>
      <div className="flex flex-col gap-6 p-6">
        {rooms.length === 0 && spaces.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {q ? `No rooms or spaces match “${term.trim()}”.` : "Nothing here yet."}
          </p>
        )}
        <ul className="flex flex-col gap-2">
          {rooms.map((r) => (
            <SpaceChildRow
              key={r.roomId}
              name={r.name ?? r.roomId}
              topic={r.topic}
              memberCount={r.memberCount}
              kind="room"
              joined={r.joined}
              onActivate={() => activateRoom(r)}
            />
          ))}
        </ul>
        {spaces.length > 0 && (
          <section role="region" aria-label="Spaces" className="flex flex-col gap-2">
            <h2 className="text-xs font-semibold uppercase text-muted-foreground">Spaces</h2>
            <ul className="flex flex-col gap-2">
              {spaces.map((s) => (
                <SpaceChildRow
                  key={s.roomId}
                  name={s.name ?? s.roomId}
                  topic={s.topic}
                  memberCount={s.memberCount}
                  kind="space"
                  joined={s.joined}
                  onActivate={() => activateSpace(s)}
                />
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
