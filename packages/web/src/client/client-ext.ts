import type { MatrixClient } from "matrix-js-sdk";

export interface PublicRoomsChunkRoom {
  room_id: string;
  name?: string;
  topic?: string;
  canonical_alias?: string;
  num_joined_members?: number;
  avatar_url?: string;
  room_type?: string;
}

export interface PublicRoomsResponse {
  chunk: PublicRoomsChunkRoom[];
  next_batch?: string;
  total_room_count_estimate?: number;
}

export interface PublicRoomsQuery {
  filter?: { generic_search_term?: string };
  limit?: number;
  since?: string;
  server?: string;
}

export interface HierarchyResponse {
  rooms: Array<{
    room_id: string;
    name?: string;
    topic?: string;
    num_joined_members?: number;
    room_type?: string;
  }>;
}

/** `IPusher["data"]` is declared `{format?, url?, brand?}` in matrix-js-sdk 34 — no room for a web-push subscription. */
export interface WebPushPusherData {
  url: string;
  endpoint: string;
  auth: string;
  events_only: boolean;
  default_payload: Record<string, never>;
}

export interface WebPushPusher {
  kind: "http";
  app_id: string;
  pushkey: string;
  app_display_name: string;
  device_display_name: string;
  lang: string;
  append: boolean;
  data: WebPushPusherData;
}

export interface MatrixPusher {
  app_id: string;
  pushkey: string;
  data?: { url?: string };
}

/** Methods that are under-typed on MatrixClient in matrix-js-sdk 34. */
interface ClientExt {
  publicRooms(opts: PublicRoomsQuery): Promise<PublicRoomsResponse>;
  getRoomHierarchy(roomId: string): Promise<HierarchyResponse>;
  getRoomIdForAlias(alias: string): Promise<{ room_id: string } | null>;
  joinRoom(idOrAlias: string): Promise<{ roomId: string }>;
  setPusher(pusher: WebPushPusher): Promise<object>;
  getPushers(): Promise<{ pushers: MatrixPusher[] }>;
  removePusher(pushkey: string, appId: string): Promise<object>;
}

export function clientExt(client: MatrixClient): ClientExt {
  return client as unknown as ClientExt;
}
