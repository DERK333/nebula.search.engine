import { ResultCollector } from "./collector.js";
import { runFederatedSearch, continueDuckDuckGoSearch, loadSearchKeys } from "./orchestrator.js";
import { searchLocalCorpus, upsertLocalPages, localCorpusStats } from "./local-corpus.js";

function isMissingBackend(error) {
  const status = error?.status || error?.response?.status;
  const message = error?.message || "";
  return status === 404 || /404|not found|failed to fetch|network/i.test(message);
}

async function tryApiSearch(query, { signal } = {}) {
  const response = await fetch(`/api/search?q=${encodeURIComponent(query)}&mode=full`, { signal });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Web search failed with HTTP ${response.status}`);
  return response.json();
}

export async function indexDiscoveredPages({ query, results, invokeIndexOnSearch }) {
  const localCount = await upsertLocalPages(results);
  let remote = { indexed: 0, queued: 0 };
  if (invokeIndexOnSearch) {
    try {
      const payload = results.slice(0, 40).map((item) => ({
        url: item.url,
        title: item.title,
        description: item.description,
        domain: item.domain,
        content_type: item.content_type,
        quality_score: item.quality_score,
      }));
      const res = await invokeIndexOnSearch({ query, results: payload });
      remote = res?.data || res || remote;
    } catch {
      remote = { indexed: 0, queued: 0, skipped: true };
    }
  }
  const stats = await localCorpusStats();
  return { localCount, remote, corpusSize: stats.pages };
}

export async function runSearchSession(query, {
  onUpdate,
  signal,
  invokeWebSearch,
  invokeSearchIndex,
  invokeIndexOnSearch,
  invokeWebAnswer,
  fetchImpl = fetch,
} = {}) {
  const collector = new ResultCollector({ cap: 2500, query });
  const failures = [];
  const enginesUsed = new Set();
  let intent = "general";
  let hasMore = false;
  let cursor = null;

  const emit = (extra = {}) => {
    const snapshot = collector.snapshot();
    onUpdate?.({
      ...snapshot,
      intent,
      hasMore,
      cursor,
      failures: [...failures],
      engines: [...enginesUsed],
      ...extra,
    });
    return snapshot;
  };

  const ingest = (payload, source = "web") => {
    if (!payload) return;
    const results = payload.results || [];
    collector.add(results, payload.source || source);
    collector.addRelated(payload.related || []);
    if (payload.intent) intent = payload.intent;
    if (payload.hasMore) hasMore = true;
    if (payload.cursor) cursor = payload.cursor;
    const engineIds = payload.engines || (payload.sources ? Object.keys(payload.sources) : []);
    engineIds.forEach((id) => {
      if (typeof id === "string") enginesUsed.add(id);
    });
    if (source) enginesUsed.add(source);
    emit({ live: true });
  };

  const tasks = [
    searchLocalCorpus(query).then((results) => ingest({ results }, "local-index")).catch((error) => {
      failures.push({ source: "local-index", error: error.message });
    }),
    runFederatedSearch(query, {
      fetchImpl,
      signal,
      includeServerEngines: false,
      onPartial: (partial) => ingest(partial, partial.source || "federated-client"),
    }).then((payload) => {
      intent = payload.intent || intent;
      if (payload.hasMore) hasMore = true;
      if (payload.cursor) cursor = payload.cursor;
      (payload.engines || []).forEach((id) => enginesUsed.add(id));
      (payload.failures || []).forEach((failure) => failures.push(failure));
      emit({ live: true });
    }).catch((error) => {
      failures.push({ source: "federated-client", error: error.message });
    }),
  ];

  tasks.push(
    tryApiSearch(query, { signal }).then((payload) => {
      if (payload) ingest(payload, payload.source || "web");
    }).catch((error) => {
      failures.push({ source: "api-search", error: error.message });
    }),
  );

  if (invokeWebSearch) {
    tasks.push(
      invokeWebSearch({ query, mode: "full" }).then((res) => {
        ingest(res?.data || res, "webSearch");
      }).catch((error) => {
        if (!isMissingBackend(error)) failures.push({ source: "webSearch", error: error.message });
      }),
    );
  }

  if (invokeSearchIndex) {
    tasks.push(
      invokeSearchIndex({ query, limit: 2000, maxPerDomain: 0 }).then((res) => {
        const data = res?.data || res || {};
        ingest({ ...data, source: "index" }, "index");
      }).catch((error) => {
        if (!isMissingBackend(error)) failures.push({ source: "index", error: error.message });
      }),
    );
  }

  let webAnswer = null;
  if (invokeWebAnswer) {
    tasks.push(
      invokeWebAnswer(query).then((answer) => {
        webAnswer = answer || null;
        if (webAnswer) emit({ webAnswer, live: true });
      }).catch((error) => {
        failures.push({ source: "web-answer", error: error.message });
      }),
    );
  }

  await Promise.allSettled(tasks);
  const snapshot = emit({ live: false });

  const indexing = indexDiscoveredPages({
    query,
    results: snapshot.results,
    invokeIndexOnSearch,
  }).catch(() => ({ localCount: 0, remote: { indexed: 0 }, corpusSize: 0 }));

  return {
    ...snapshot,
    intent,
    hasMore,
    cursor,
    failures,
    engines: [...enginesUsed],
    webAnswer,
    indexing,
  };
}

export async function loadMoreSearch(query, cursor, { fetchImpl = fetch, signal, invokeWebSearch } = {}) {
  const collector = new ResultCollector({ query });
  try {
    const more = await continueDuckDuckGoSearch(query, cursor, { fetchImpl, signal });
    collector.add(more.results, "duckduckgo");
    if (invokeWebSearch) {
      const res = await invokeWebSearch({ query, cursor, mode: "continue" });
      const data = res?.data || res;
      if (data?.results) collector.add(data.results, "webSearch");
    }
    const snapshot = collector.snapshot();
    return {
      ...snapshot,
      hasMore: Boolean(more.hasMore),
      cursor: more.nextCursor || null,
    };
  } catch (error) {
    return { results: [], total: 0, hasMore: false, cursor: null, error: error.message };
  }
}

export { loadSearchKeys };
