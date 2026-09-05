export interface RuntimeConfig {
  homeserver_url?: string;
  default_idp_label?: string;
  global_search?: boolean;
  push_gateway_url?: string;
  vapid_public_key?: string;
}

export async function loadRuntimeConfig(): Promise<RuntimeConfig | null> {
  try {
    const res = await fetch("/config.json", { cache: "no-store" });
    if (!res.ok) return null;
    const json = (await res.json()) as Partial<RuntimeConfig> & Record<string, unknown>;
    const out: RuntimeConfig = {};
    if (typeof json.homeserver_url === "string") out.homeserver_url = json.homeserver_url;
    if (typeof json.default_idp_label === "string") out.default_idp_label = json.default_idp_label;
    if (typeof json.global_search === "boolean") out.global_search = json.global_search;
    if (typeof json.push_gateway_url === "string") out.push_gateway_url = json.push_gateway_url;
    if (typeof json.vapid_public_key === "string") out.vapid_public_key = json.vapid_public_key;
    return out;
  } catch {
    return null;
  }
}
