import { ResultCollector } from "./collector.js";
import { selectEngines } from "./engines/index.js";
import { searchDuckDuckGoHtml } from "./engines/duckduckgo.js";
import { classifyIntent, expandQueries, siteScopedQueries } from "./query-expand.js";

function remaining(startedAt, budgetMs) {
  return budgetMs - (Date.now() - startedAt);
}

async function runEngine(engine, ctx) {
  const result = await engine.search({
    query: ctx.query,
    fetchImpl: ctx.fetchImpl,
    signal: ctx.signal,
    keys: ctx.keys,
    maxResults: ctx.maxResults,
  });
  return {
    source: engine.id,
    results: result?.results || [],
    related: result?.related || [],
    hasMore: Boolean(result?.hasMore),
    nextCursor: result?.nextCursor,
  };
}

export function loadSearchKeys(env = typeof process !== "undefined" ? process.env : {}) {
  return {
    brave: env.BRAVE_SEARCH_API_KEY || env.VITE_BRAVE_SEARCH_API_KEY || "",
    bing: env.BING_SEARCH_API_KEY || env.VITE_BING_SEARCH_API_KEY || "",
    google: env.GOOGLE_API_KEY || env.VITE_GOOGLE_API_KEY || "",
    googleCx: env.GOOGLE_CSE_ID || env.VITE_GOOGLE_CSE_ID || "",
    mojeek: env.MOJEEK_API_KEY || env.VITE_MOJEEK_API_KEY || "",
    searxUrl: env.SEARXNG_URL || env.VITE_SEARXNG_URL || "",
  };
}

export async function runFederatedSearch(query, {
  fetchImpl = fetch,
  signal,
  includeServerEngines = false,
  keys = loadSearchKeys(),
  budgetMs = 14000,
  cap = 2500,
  onPartial,
  extraQueries = [],
  engines,
} = {}) {
  const trimmed = (query || "").trim();
  const collector = new ResultCollector({ cap, query: trimmed });
  if (!trimmed) {
    return { ...collector.snapshot(), intent: "general", hasMore: false, query: "" };
  }

  const intent = classifyIntent(trimmed);
  const startedAt = Date.now();
  const selected = engines || selectEngines({ includeServerEngines, keys });
  const failures = [];

  const tasks = selected.map(async (engine) => {
    try {
      const outcome = await runEngine(engine, {
        query: trimmed,
        fetchImpl,
        signal,
        keys,
      });
      collector.add(outcome.results, outcome.source);
      collector.addRelated(outcome.related);
      onPartial?.({
        results: outcome.results,
        source: outcome.source,
        related: outcome.related,
        hasMore: outcome.hasMore,
        cursor: outcome.nextCursor,
      });
      return outcome;
    } catch (error) {
      failures.push({ source: engine.id, error: error?.message || String(error) });
      return { source: engine.id, results: [], hasMore: false };
    }
  });

  const outcomes = await Promise.all(tasks);
  const ddgHtml = outcomes.find((item) => item.source === "duckduckgo-html");

  if (includeServerEngines && remaining(startedAt, budgetMs) > 2500) {
    const related = collector.snapshot().related;
    const expansions = [
      ...extraQueries,
      ...expandQueries(trimmed, related).slice(1, 4),
      ...siteScopedQueries(trimmed),
    ].filter((item) => item.toLowerCase() !== trimmed.toLowerCase());

    for (const extra of expansions) {
      if (remaining(startedAt, budgetMs) < 2000) break;
      try {
        const extraHits = await searchDuckDuckGoHtml({
          query: extra,
          fetchImpl,
          signal,
          maxPages: 3,
          maxResults: 90,
        });
        collector.add(extraHits.results, "duckduckgo");
        onPartial?.(collector.snapshot());
      } catch {
        // expansion queries are best-effort
      }
    }
  }

  const snapshot = collector.snapshot();
  return {
    ...snapshot,
    query: trimmed,
    intent,
    hasMore: Boolean(ddgHtml?.hasMore),
    cursor: ddgHtml?.nextCursor || null,
    failures,
    elapsed_ms: Date.now() - startedAt,
    engines: selected.map((engine) => engine.id),
    source: includeServerEngines ? "federated-server" : "federated-client",
  };
}

export async function continueDuckDuckGoSearch(query, cursor, options = {}) {
  const html = await searchDuckDuckGoHtml({
    query,
    startOffset: Number(cursor) || 0,
    maxPages: options.maxPages || 8,
    maxResults: options.maxResults || 240,
    fetchImpl: options.fetchImpl,
    signal: options.signal,
  });
  return html;
}
