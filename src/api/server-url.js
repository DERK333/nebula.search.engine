export const DEFAULT_APP_ID = "69d5ed97546d249d76999368";
export const DEFAULT_APP_BASE_URL = "https://nebula--search.com";
export const DEFAULT_SERVER_URL = "https://base44.app";

export function resolveServerUrl({
  hostname = typeof window !== "undefined" ? window.location.hostname : "",
  hostedAppBaseUrl = DEFAULT_APP_BASE_URL,
} = {}) {
  const host = (hostname || "").toLowerCase();
  if (!host || host === "localhost" || host === "127.0.0.1") return "";
  try {
    if (hostedAppBaseUrl && new URL(hostedAppBaseUrl).hostname.toLowerCase() === host) return "";
  } catch {
    // ignore invalid app base URL
  }
  if (host === "base44.app" || host.endsWith(".base44.app")) return "";
  return DEFAULT_SERVER_URL;
}
