/** Strip trailing slashes from Vite's BASE_URL for React Router. */
export function resolveRouterBasename(baseUrl = import.meta.env.BASE_URL) {
  if (!baseUrl || baseUrl === "/") return "/";
  const trimmed = String(baseUrl).replace(/\/+$/, "");
  return trimmed || "/";
}
