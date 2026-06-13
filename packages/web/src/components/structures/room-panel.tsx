import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Bell, Globe, Lock, LogOut, Pencil, Star, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { MatrixClientPeg } from "../../client/peg";
import { useJoinRule } from "../../hooks/use-join-rule";
import { useMyPowerLevel } from "../../hooks/use-my-power-level";
import { useRoomFavorite } from "../../hooks/use-room-favorite";
import { useRoomNotifState } from "../../hooks/use-room-notif-state";
import { useRoomTopic } from "../../hooks/use-room-topic";
import type { RoomNotifState } from "../../lib/matrix/notification-prefs";
import { RoomAvatar } from "../room-avatar";
import { MemberPanel } from "./member-panel";

const RULE_LABEL = {
  invite: { Icon: Lock, text: "Invite only" },
  restricted: { Icon: Users, text: "Space members" },
  public: { Icon: Globe, text: "Anyone can join" },
} as const;

interface RoomPanelProps {
  roomId: string;
  spaceId: string | null;
  view: "home" | "people" | "notifications";
  onNavigate: (view: "home" | "people" | "notifications") => void;
  onClose: () => void;
}

// Rows sit inside a p-1 container (like the sidebar user-menu footer), so each row
// has 4px breathing room from the separator and panel edges. Content padding is px-3
// so icon lands at 4+12=16px from the panel edge, same as before.
const ROW = "flex h-8 w-full items-center gap-2.5 px-3 text-sm";
const ACTION_ROW = `${ROW} cursor-pointer rounded-md transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`;

function HomeView({ roomId, onNavigate, onClose }: Omit<RoomPanelProps, "view" | "spaceId">) {
  const navigate = useNavigate();
  const client = MatrixClientPeg.safeGet();
  const room = client?.getRoom(roomId);
  const topic = useRoomTopic(roomId);
  const { rule, spaceName } = useJoinRule(roomId);
  const { isFavorite, toggle: toggleFavorite } = useRoomFavorite(roomId);
  const myPL = useMyPowerLevel(roomId);
  const canEdit = myPL.canSendStateEvent("m.room.name");

  const [editingTopic, setEditingTopic] = useState(false);
  const [topicValue, setTopicValue] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState("");
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const { Icon: RuleIcon, text: ruleText } = RULE_LABEL[rule];
  const roomName = room?.name ?? roomId;
  const alias = (room as unknown as { getCanonicalAlias?: () => string | null })?.getCanonicalAlias?.() ?? null;
  const memberCount = room?.getJoinedMemberCount() ?? 0;

  const onSaveTopic = async () => {
    await (client as unknown as { setRoomTopic: (r: string, t: string) => Promise<unknown> })
      .setRoomTopic(roomId, topicValue);
    setEditingTopic(false);
  };

  const onSaveName = async () => {
    await (client as unknown as { setRoomName: (r: string, n: string) => Promise<unknown> })
      .setRoomName(roomId, nameValue);
    setEditingName(false);
  };

  const onAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !client) return;
    const { content_uri } = await (client as unknown as {
      uploadContent: (f: File) => Promise<{ content_uri: string }>;
    }).uploadContent(file);
    await (client as unknown as {
      sendStateEvent: (r: string, t: string, c: unknown, k: string) => Promise<unknown>;
    }).sendStateEvent(roomId, "m.room.avatar", { url: content_uri }, "");
  };

  const onLeave = async () => {
    await client?.leave(roomId);
    onClose();
    navigate("/");
  };

  return (
    <div className="flex flex-col">
      {/* Avatar + name — uses p-4 block padding, not ROW */}
      <div className="flex items-start gap-3 p-4">
        {canEdit ? (
          <label aria-label="Room avatar" className="cursor-pointer">
            <RoomAvatar roomId={roomId} name={roomName} size="lg" />
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => void onAvatarChange(e)}
            />
          </label>
        ) : (
          <RoomAvatar roomId={roomId} name={roomName} size="lg" />
        )}
        <div className="min-w-0 flex-1 pt-0.5">
          {editingName ? (
            <div className="flex items-center gap-1">
              <Input
                aria-label="Room name"
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                className="h-7 text-sm font-semibold"
              />
              <Button size="sm" onClick={() => void onSaveName()}>Save</Button>
              <Button size="sm" variant="ghost" onClick={() => setEditingName(false)}>Cancel</Button>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <p className="truncate font-semibold">{roomName}</p>
              {canEdit && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-5 shrink-0"
                  aria-label="Edit name"
                  onClick={() => { setNameValue(roomName); setEditingName(true); }}
                >
                  <Pencil className="size-3" />
                </Button>
              )}
            </div>
          )}
          {alias && <p className="truncate text-xs text-muted-foreground">{alias}</p>}
        </div>
      </div>

      {/* Info rows — each row has its own px-4 so icons land at the panel edge */}
      <div className="p-1">
        <div className={`${ROW} text-muted-foreground`}>
          <RuleIcon className="size-4 shrink-0" />
          <span>{ruleText}{rule === "restricted" && spaceName ? ` · ${spaceName}` : ""}</span>
        </div>
        <div className={`${ROW} text-muted-foreground`}>
          <Users className="size-4 shrink-0" />
          <span>{memberCount} members</span>
        </div>
      </div>

      {/* Topic */}
      <div className="p-1">
        {editingTopic ? (
          <div className="space-y-2 px-3 pb-2">
            <Label htmlFor="topic-input">Topic</Label>
            <Textarea
              id="topic-input"
              aria-label="topic"
              value={topicValue}
              onChange={(e) => setTopicValue(e.target.value)}
              rows={3}
              className="text-sm"
            />
            <div className="flex gap-1">
              <Button size="sm" onClick={() => void onSaveTopic()}>Save</Button>
              <Button size="sm" variant="ghost" onClick={() => setEditingTopic(false)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <>
            {topic && <p className="px-3 pb-1 text-sm text-muted-foreground">{topic}</p>}
            {canEdit && (
              <button
                type="button"
                aria-label="Edit topic"
                className={`${ACTION_ROW} text-muted-foreground`}
                onClick={() => { setTopicValue(topic ?? ""); setEditingTopic(true); }}
              >
                <Pencil className="size-4 shrink-0" />
                Edit topic
              </button>
            )}
          </>
        )}
      </div>

      <Separator />

      {/* Action rows — raw <button> so padding is never overridden by a variant */}
      <div className="p-1">
        <button
          type="button"
          className={ACTION_ROW}
          onClick={() => void toggleFavorite()}
        >
          <Star className={`size-4 shrink-0 ${isFavorite ? "fill-current text-amber-500" : ""}`} />
          {isFavorite ? "Remove from Favourites" : "Add to Favourites"}
        </button>
        <button
          type="button"
          className={ACTION_ROW}
          onClick={() => onNavigate("people")}
        >
          <Users className="size-4 shrink-0" />
          People
        </button>
        <button
          type="button"
          className={ACTION_ROW}
          onClick={() => onNavigate("notifications")}
        >
          <Bell className="size-4 shrink-0" />
          Notifications
        </button>
      </div>

      <Separator />

      <div className="p-1">
        <button
          type="button"
          className={`${ACTION_ROW} text-destructive hover:bg-destructive/10 hover:text-destructive`}
          onClick={() => void onLeave()}
        >
          <LogOut className="size-4 shrink-0" />
          Leave room
        </button>
      </div>
    </div>
  );
}

function NotificationsView({ roomId, onNavigate }: { roomId: string; onNavigate: (v: "home") => void }) {
  const { state, setState } = useRoomNotifState(roomId);

  return (
    <div className="flex flex-col">
      <div className="flex h-10 items-center gap-1 px-2">
        <Button variant="ghost" size="icon" aria-label="Back" onClick={() => onNavigate("home")}>
          <ArrowLeft className="size-4" />
        </Button>
        <h2 className="text-sm font-semibold">Notifications</h2>
      </div>
      <Separator />
      <div className="px-4 py-3">
        <fieldset className="space-y-1">
          <legend className="sr-only">Notification setting</legend>
          {(["all", "mentions", "mute"] as RoomNotifState[]).map((value) => (
            <label key={value} className="flex h-8 cursor-pointer items-center gap-2.5 text-sm">
              <input
                type="radio"
                name="notif"
                value={value}
                checked={state === value}
                onChange={() => void setState(value)}
                aria-label={value === "all" ? "All messages" : value === "mentions" ? "Mentions & keywords" : "Mute"}
              />
              {value === "all" ? "All messages" : value === "mentions" ? "Mentions & keywords" : "Mute"}
            </label>
          ))}
        </fieldset>
      </div>
    </div>
  );
}

function PeopleView({
  roomId,
  spaceId,
  onNavigate,
}: {
  roomId: string;
  spaceId: string | null;
  onNavigate: (v: "home") => void;
}) {
  return (
    <div className="flex flex-col">
      <div className="flex h-10 items-center gap-1 px-2">
        <Button variant="ghost" size="icon" aria-label="Back" onClick={() => onNavigate("home")}>
          <ArrowLeft className="size-4" />
        </Button>
        <h2 className="text-sm font-semibold">People</h2>
      </div>
      <Separator />
      <MemberPanel roomId={roomId} spaceId={spaceId} />
    </div>
  );
}

export function RoomPanel({ roomId, spaceId, view, onNavigate, onClose }: RoomPanelProps) {
  return (
    <aside className="flex h-full w-64 shrink-0 flex-col overflow-y-auto border-l border-border bg-background">
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
        <span className="text-sm font-semibold">Room info</span>
        <Button variant="ghost" size="icon" aria-label="Close panel" onClick={onClose}>
          <X className="size-4" />
        </Button>
      </div>
      {view === "home" && (
        <HomeView roomId={roomId} onNavigate={onNavigate} onClose={onClose} />
      )}
      {view === "notifications" && (
        <NotificationsView roomId={roomId} onNavigate={(v) => onNavigate(v)} />
      )}
      {view === "people" && (
        <PeopleView roomId={roomId} spaceId={spaceId} onNavigate={(v) => onNavigate(v)} />
      )}
    </aside>
  );
}
