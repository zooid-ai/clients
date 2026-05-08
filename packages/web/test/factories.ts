import { EventEmitter } from "events";
import {
  EventType,
  type IRoomTimelineData,
  type MatrixClient,
  MatrixEvent,
  Room,
  RoomEvent,
  RoomStateEvent,
} from "matrix-js-sdk";
import { mkMatrixEvent } from "matrix-js-sdk/lib/testing";

export interface FakeClientOpts {
  userId: string;
  rooms?: Room[];
}

// A bare-minimum MatrixClient stub. It is *not* a full client — it only
// implements the methods our hooks actually read. If a hook reads something
// new, add it here, don't reach for vi.mock.
export function makeFakeClient(opts: FakeClientOpts): MatrixClient {
  const emitter = new EventEmitter();
  const rooms = new Map<string, Room>();
  for (const r of opts.rooms ?? []) rooms.set(r.roomId, r);

  const client = Object.assign(emitter, {
    getUserId: () => opts.userId,
    getSafeUserId: () => opts.userId,
    getRoom: (id: string) => rooms.get(id) ?? null,
    getRooms: () => Array.from(rooms.values()),
    credentials: { userId: opts.userId },
    supportsThreads: () => false,
    supportsExperimentalThreads: () => false,
    isInitialSyncComplete: () => true,
    decryptEventIfNeeded: async () => undefined,
    addRoom(room: Room) {
      rooms.set(room.roomId, room);
      emitter.emit(ClientEventName.Room, room);
    },
  }) as unknown as MatrixClient & { addRoom(r: Room): void };

  return client;
}

export const ClientEventName = {
  Room: "Room",
  RoomTimeline: "Room.timeline",
};

export function makeRoom(
  roomId: string,
  opts: {
    client: MatrixClient;
    myUserId: string;
    powerLevels?: Record<string, number>;
    usersDefault?: number;
  },
): Room {
  const room = new Room(roomId, opts.client, opts.myUserId);
  // Seed a power_levels state event so tests don't blow up on null state.
  const pl = mkMatrixEvent({
    roomId,
    sender: "@creator:h.example",
    type: EventType.RoomPowerLevels,
    stateKey: "",
    content: {
      users: opts.powerLevels ?? { "@creator:h.example": 100 },
      users_default: opts.usersDefault ?? 0,
      events_default: 0,
      state_default: 50,
    },
  });
  room.currentState.setStateEvents([pl]);
  return room;
}

export function pushTimelineEvent(room: Room, event: MatrixEvent): void {
  void room.addLiveEvents([event]);
  // matrix-js-sdk emits Room.timeline on the room and re-emits on the client.
  // For our fake client, re-emit explicitly so hooks subscribed to the room see it.
  const data: Partial<IRoomTimelineData> = { liveEvent: true, timeline: room.getLiveTimeline() };
  room.emit(RoomEvent.Timeline, event, room, false, false, data as IRoomTimelineData);
}

export function injectStateEvent(room: Room, event: MatrixEvent): void {
  room.currentState.setStateEvents([event]);
  room.currentState.emit(RoomStateEvent.Events, event, room.currentState, null);
}

export interface MakeMatrixEventOpts {
  eventId: string;
  roomId: string;
  sender: string;
  type: string;
  content: Record<string, unknown>;
  threadReplyCount?: number;
}

export function makeMatrixEvent(opts: MakeMatrixEventOpts): MatrixEvent {
  const event = mkMatrixEvent({
    eventId: opts.eventId,
    roomId: opts.roomId,
    sender: opts.sender,
    type: opts.type,
    content: opts.content,
  });
  if (opts.threadReplyCount !== undefined) {
    const count = opts.threadReplyCount;
    (event as unknown as { getThread: () => { length: number } }).getThread = () => ({
      length: count,
    });
  } else {
    (event as unknown as { getThread: () => null }).getThread = () => null;
  }
  return event;
}

export interface SeedAgent {
  userId: string;
  name?: string;
  rooms?: string[];
}

export function seedWorkforceRoster(
  space: Room,
  agents: SeedAgent[],
  opts: { sender?: string } = {},
): void {
  injectStateEvent(
    space,
    mkMatrixEvent({
      roomId: space.roomId,
      sender: opts.sender ?? "@zooid:h.example",
      type: "eco.zoon.workforce",
      stateKey: "",
      content: {
        version: 1,
        agents: agents.map((a) => ({
          user_id: a.userId,
          name: a.name ?? a.userId.slice(1).split(":")[0],
          rooms: a.rooms ?? [],
        })),
      },
    }),
  );
}

export { mkMatrixEvent, EventType, RoomEvent, RoomStateEvent };
