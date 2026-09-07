import { useState } from "react";
import { Navigate, useNavigate, useOutletContext } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs } from "@/components/ui/tabs";
import { MatrixClientPeg } from "../../client/peg";
import { clientExt } from "../../client/client-ext";
import { useGlobalSearchEnabled } from "../../client/feature-flags";
import { type PublicRoom, usePublicRooms } from "../../hooks/use-public-rooms";
import { useJoinRoom } from "../../hooks/use-join-room";
import type { Scope } from "./sidebar/scope";
import type { LoggedInOutletContext } from "./logged-in-view";
import { SpaceChildRow } from "./space-child-row";

type TabValue = "all";

/**
 * Route wrapper: resolves the active space from the logged-in Outlet context.
 * With People/Messages still deferred (ZNC023 cycle 2), All rooms is the only
 * tab and it is global_search-gated — off the flag, /search has nothing to
 * show, so it bounces back to the Lobby.
 */
export function SearchPageRoute() {
  const { activeScope, setScope } = useOutletContext<LoggedInOutletContext>();
  const spaceId = activeScope.kind === "space" ? activeScope.spaceId : null;
  if (!useGlobalSearchEnabled()) return <Navigate to="/" replace />;
  return <SearchPage spaceId={spaceId} setScope={setScope} />;
}

export function SearchPage({
  setScope,
}: {
  spaceId: string | null;
  setScope?: (scope: Scope) => void;
}) {
  const [term, setTerm] = useState("");

  const tabs: { value: TabValue; label: string }[] = [{ value: "all", label: "All rooms" }];
  const activeTab: TabValue = tabs[0].value;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="border-b border-border px-6 py-4">
        <h1 className="font-heading text-lg font-medium">All rooms</h1>
        <Input
          autoFocus
          aria-label="search"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search rooms…"
          className="mt-2"
        />
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        <Tabs value={activeTab} onValueChange={() => {}} tabs={tabs}>
          <AllRoomsTab term={term} setScope={setScope} />
        </Tabs>
      </div>
    </div>
  );
}

function AllRoomsTab({ term, setScope }: { term: string; setScope?: (scope: Scope) => void }) {
  const { rooms, loading, error, hasMore, loadMore } = usePublicRooms(term);
  return (
    <div className="flex flex-col gap-3">
      {error && <p className="text-xs text-destructive">{error}</p>}
      {loading && rooms.length === 0 ? (
        <p className="text-sm text-muted-foreground">Searching…</p>
      ) : rooms.length === 0 ? (
        <p className="text-sm text-muted-foreground">No public rooms found.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rooms.map((r: PublicRoom) => (
            <PublicRoomRow key={r.roomId} room={r} setScope={setScope} />
          ))}
        </ul>
      )}
      {hasMore && (
        <Button size="sm" variant="outline" onClick={() => loadMore()}>
          Load more
        </Button>
      )}
    </div>
  );
}

function PublicRoomRow({
  room,
  setScope,
}: {
  room: PublicRoom;
  setScope?: (scope: Scope) => void;
}) {
  const { joinRoom, joining } = useJoinRoom();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const onActivate = async () => {
    if (room.isSpace) {
      const client = MatrixClientPeg.safeGet();
      if (!client) return;
      setBusy(true);
      try {
        await clientExt(client).joinRoom(room.roomId);
        setScope?.({ kind: "space", spaceId: room.roomId });
        navigate("/");
      } finally {
        setBusy(false);
      }
      return;
    }
    await joinRoom(room.roomId);
  };

  return (
    <SpaceChildRow
      name={room.name ?? room.roomId}
      topic={room.topic}
      memberCount={room.memberCount}
      kind={room.isSpace ? "space" : "room"}
      joined={false}
      busy={joining || busy}
      onActivate={() => void onActivate()}
    />
  );
}
