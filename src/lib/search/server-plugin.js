import { runFederatedSearch, continueDuckDuckGoSearch, loadSearchKeys } from "./orchestrator.js";

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

export function createSearchMiddleware() {
  return async (req, res, next) => {
    if (!req.url?.startsWith("/api/search")) return next();

    try {
      const requestUrl = new URL(req.url, "http://localhost");
      const query = requestUrl.searchParams.get("q")?.trim();
      const cursor = requestUrl.searchParams.get("cursor");
      const keys = loadSearchKeys();

      if (!query) {
        sendJson(res, 200, { results: [], total: 0, returned: 0, source: "federated-server" });
        return;
      }

      if (cursor) {
        const more = await continueDuckDuckGoSearch(query, cursor);
        sendJson(res, 200, {
          results: more.results,
          total: more.results.length,
          returned: more.results.length,
          hasMore: more.hasMore,
          cursor: more.nextCursor,
          source: "duckduckgo",
        });
        return;
      }

      const data = await runFederatedSearch(query, {
        includeServerEngines: true,
        keys,
        budgetMs: 14000,
      });
      sendJson(res, 200, data);
    } catch (error) {
      next(error);
    }
  };
}

export function realWebSearchPlugin() {
  return {
    name: "real-web-search",
    configureServer(server) {
      server.middlewares.use(createSearchMiddleware());
    },
    configurePreviewServer(server) {
      server.middlewares.use(createSearchMiddleware());
    },
  };
}
