import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';

export const DEFAULT_APP_ID = "69d5ed97546d249d76999368";
export const DEFAULT_APP_BASE_URL = "https://nebula--search.com";
export const DEFAULT_SERVER_URL = "https://base44.app";

const { appId, token, functionsVersion, appBaseUrl } = appParams;

export function resolveServerUrl({
  hostname = typeof window !== "undefined" ? window.location.hostname : "",
  hostedAppBaseUrl = appBaseUrl || DEFAULT_APP_BASE_URL,
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

export const base44 = createClient({
  appId: appId || DEFAULT_APP_ID,
  token,
  functionsVersion,
  serverUrl: resolveServerUrl(),
  requiresAuth: false,
  appBaseUrl: appBaseUrl || DEFAULT_APP_BASE_URL,
});
