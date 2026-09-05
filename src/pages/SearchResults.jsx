import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { SearchHistory } from "@/api/entities";
import { indexOnSearch, searchIndex, webSearch } from "@/api/functions";
import { AlertCircle, SearchX, Sparkles, Database, Globe2, Loader2 } from "lucide-react";
import MobileNavMenu from "../components/layout/MobileNavMenu";
import SearchBar from "../components/search/SearchBar";
import SearchResultItem from "../components/search/SearchResultItem.jsx";
import SearchSkeleton from "../components/search/SearchSkeleton";
import SearchFilters, { applyFiltersAndSort, QUALITY_OPTIONS } from "../components/search/SearchFilters";
import { runSearchSession, loadMoreSearch } from "@/lib/search/run-search.js";
import { invokeWebAnswer } from "@/lib/search/web-answer.js";

const PAGE_SIZE = 40;
const SOURCE_LABELS = {
  wikipedia: "Wikipedia",
  wikidata: "Wikidata",
  duckduckgo: "DuckDuckGo",
  "duckduckgo-html": "DuckDuckGo",
  github: "GitHub",
  hackernews: "HN",
  stackoverflow: "Stack Overflow",
  openalex: "OpenAlex",
  semanticscholar: "Semantic Scholar",
  crossref: "Crossref",
  pubmed: "PubMed",
  arxiv: "arXiv",
  archive: "Archive.org",
  openlibrary: "Open Library",
  mdn: "MDN",
  npm: "npm",
  huggingface: "Hugging Face",
  crates: "crates.io",
  rubygems: "RubyGems",
  packagist: "Packagist",
  openverse: "Openverse",
  "bing-rss": "Bing",
  itunes: "iTunes",
  searxng: "SearXNG",
  brave: "Brave",
  bing: "Bing",
  google: "Google",
  mojeek: "Mojeek",
  reddit: "Reddit",
  gutenberg: "Gutenberg",
  index: "Explore index",
  "local-index": "Local index",
  webSearch: "Live web",
  web: "Live web",
  "federated-server": "Live web",
  "web-answer": "AI overview",
  "federated-client": "Live engines",
  "api-search": "Local search API",
};

function normalizeDomain(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");
}

export default function SearchResults() {
  const location = useLocation();
  const query = useMemo(() => new URLSearchParams(location.search).get("q") || "", [location.search]);

  const navigate = useNavigate();
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [searchTime, setSearchTime] = useState(null);
  const [searchMeta, setSearchMeta] = useState({ total: 0, returned: 0, intent: "general", sources: {}, engines: [] });
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [indexStatus, setIndexStatus] = useState(null);
  const [sortBy, setSortBy] = useState("relevance");
  const [contentTypeFilter, setContentTypeFilter] = useState("all");
  const [qualityFilter, setQualityFilter] = useState("any");
  const [excludedDomains, setExcludedDomains] = useState([]);
  const [webAnswer, setWebAnswer] = useState(null);
  const [engineFailures, setEngineFailures] = useState([]);
  const sentinelRef = useRef(null);
  const abortRef = useRef(null);

  const addExcludedDomain = useCallback((domain) => {
    const normalized = normalizeDomain(domain);
    if (!normalized) return;
    setExcludedDomains((current) => (current.includes(normalized) ? current : [...current, normalized]));
  }, []);

  const removeExcludedDomain = useCallback((domain) => {
    setExcludedDomains((current) => current.filter((item) => item !== domain));
  }, []);

  const applySnapshot = useCallback((snapshot, elapsed) => {
    setResults(snapshot.results || []);
    setSearchMeta({
      total: snapshot.total || (snapshot.results || []).length,
      returned: snapshot.returned || (snapshot.results || []).length,
      intent: snapshot.intent || "general",
      sources: snapshot.sources || {},
      engines: snapshot.engines || [],
    });
    setHasMore(Boolean(snapshot.hasMore));
    setCursor(snapshot.cursor || null);
    if (snapshot.webAnswer) setWebAnswer(snapshot.webAnswer);
    if (Array.isArray(snapshot.failures)) setEngineFailures(snapshot.failures);
    if (elapsed != null) setSearchTime(elapsed);
  }, []);

  const performSearch = useCallback(async (searchQuery) => {
    const trimmed = searchQuery.trim();
    abortRef.current?.abort();

    if (!trimmed) {
      setResults([]);
      setSearchMeta({ total: 0, returned: 0, intent: "general", sources: {}, engines: [] });
      setSearchTime(null);
      setIndexStatus(null);
      setWebAnswer(null);
      setEngineFailures([]);
      setHasMore(false);
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    setIsRefreshing(false);
    setError(null);
    setIndexStatus(null);
    setWebAnswer(null);
    setEngineFailures([]);
    setSortBy("relevance");
    setContentTypeFilter("all");
    setQualityFilter("any");
    setExcludedDomains([]);
    setVisibleCount(PAGE_SIZE);
    setHasMore(false);
    setCursor(null);

    const startTime = Date.now();

    try {
      const session = await runSearchSession(trimmed, {
        signal: controller.signal,
        onUpdate: (snapshot) => {
          if (controller.signal.aborted) return;
          setIsLoading(false);
          setIsRefreshing(true);
          applySnapshot(snapshot, ((Date.now() - startTime) / 1000).toFixed(2));
        },
        invokeWebSearch: webSearch,
        invokeSearchIndex: searchIndex,
        invokeIndexOnSearch: indexOnSearch,
        invokeWebAnswer,
      });

      if (controller.signal.aborted) return;

      applySnapshot(session, ((Date.now() - startTime) / 1000).toFixed(2));
      setIsLoading(false);
      setIsRefreshing(false);

      SearchHistory.create({
        query: trimmed,
        results_count: session.results?.length || 0,
      }).catch(() => {});

      if (session.indexing) {
        session.indexing.then((status) => {
          if (!controller.signal.aborted) setIndexStatus(status);
        });
      }
    } catch (err) {
      if (controller.signal.aborted) return;
      setResults([]);
      setSearchMeta({ total: 0, returned: 0, intent: "general", sources: {}, engines: [] });
      setError(err?.message || "Search failed");
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [applySnapshot]);

  const handleLoadMore = useCallback(async () => {
    if (!query || !hasMore || loadingMore) {
      setVisibleCount((count) => count + PAGE_SIZE);
      return;
    }
    setLoadingMore(true);
    try {
      const more = await loadMoreSearch(query, cursor, {
        invokeWebSearch: webSearch,
      });
      setResults((current) => {
        const seen = new Set(current.map((item) => item.url));
        const appended = (more.results || []).filter((item) => item?.url && !seen.has(item.url));
        return [...current, ...appended];
      });
      setSearchMeta((current) => ({
        ...current,
        total: current.total + (more.results?.length || 0),
        returned: current.returned + (more.results?.length || 0),
      }));
      setHasMore(Boolean(more.hasMore));
      setCursor(more.cursor || null);
      setVisibleCount((count) => count + PAGE_SIZE);
    } catch {
      setVisibleCount((count) => count + PAGE_SIZE);
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, hasMore, loadingMore, query]);

  useEffect(() => {
    if (query) performSearch(query);
    else {
      setResults([]);
      setSearchMeta({ total: 0, returned: 0, intent: "general", sources: {}, engines: [] });
      setSearchTime(null);
      setIndexStatus(null);
      setWebAnswer(null);
      setEngineFailures([]);
    }
    return () => abortRef.current?.abort();
  }, [query, performSearch]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return undefined;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        if (visibleCount < results.length) setVisibleCount((count) => count + PAGE_SIZE);
        else if (hasMore) handleLoadMore();
      }
    }, { rootMargin: "800px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [handleLoadMore, hasMore, results.length, visibleCount]);

  const handleSearch = (newQuery) => {
    navigate(`/search?q=${encodeURIComponent(newQuery)}`);
  };

  const filteredResults = useMemo(() => {
    const minQuality = QUALITY_OPTIONS.find((option) => option.id === qualityFilter)?.min ?? 0;
    return applyFiltersAndSort(results, {
      sortBy,
      contentTypeFilter,
      excludedDomains,
      minQuality,
    });
  }, [contentTypeFilter, excludedDomains, qualityFilter, results, sortBy]);

  const visibleResults = filteredResults.slice(0, visibleCount);

  const contentTypeCounts = useMemo(() => {
    return results.reduce((acc, result) => {
      const type = result.content_type || "general";
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});
  }, [results]);

  const qualitySummary = QUALITY_OPTIONS.find((option) => option.id === qualityFilter)?.label || "Any quality";
  const sourceEntries = Object.entries(searchMeta.sources || {}).filter(([, count]) => count > 0);
  const liveLabel = sourceEntries.length
    ? `${sourceEntries.length} engines · growing index`
    : "Federated live search";

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3 md:gap-4">
          <Link to="/" className="flex items-center gap-1.5 flex-shrink-0 group">
            <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center group-hover:shadow-md transition-shadow">
              <Sparkles className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="hidden md:block font-heading font-semibold text-foreground text-lg">Explore</span>
          </Link>
          <div className="flex-1 max-w-xl">
            <SearchBar initialQuery={query} size="small" onSearch={handleSearch} />
          </div>
          <MobileNavMenu />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 md:py-8">
        {!isLoading && (query || results.length > 0) && searchMeta.total > 0 && searchTime && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-wrap items-center gap-3 mb-4 md:mb-6"
          >
            <p className="text-xs text-muted-foreground font-body">
              Showing {visibleResults.length} of {filteredResults.length} visible matches
              {searchMeta.total !== filteredResults.length ? ` (${searchMeta.total} found)` : ""} ({searchTime}s)
            </p>
            <span className="inline-flex items-center gap-1 text-xs bg-accent/10 text-accent px-2 py-0.5 rounded-full font-body">
              {isRefreshing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Globe2 className="w-3 h-3" />}
              {liveLabel}
            </span>
            {excludedDomains.length > 0 && (
              <span className="text-xs text-muted-foreground font-body">
                {excludedDomains.length} hidden domain{excludedDomains.length === 1 ? "" : "s"}
              </span>
            )}
            <span className="text-xs text-muted-foreground font-body">{qualitySummary}</span>
          </motion.div>
        )}

        {sourceEntries.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {sourceEntries.map(([source, count]) => (
              <span
                key={source}
                className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border border-border bg-card text-muted-foreground font-body"
              >
                {SOURCE_LABELS[source] || source}
                <span className="opacity-70">{count}</span>
              </span>
            ))}
          </div>
        )}

        {webAnswer && (
          <div className="mb-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-heading font-semibold text-foreground">AI overview</h2>
            </div>
            <p className="text-sm font-body text-foreground leading-relaxed">{webAnswer.answer}</p>
            {webAnswer.bullets?.length > 0 && (
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground font-body list-disc list-inside">
                {webAnswer.bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
            )}
            {webAnswer.followups?.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {webAnswer.followups.map((followup) => (
                  <button
                    key={followup}
                    type="button"
                    onClick={() => handleSearch(followup)}
                    className="text-xs font-body px-2.5 py-1 rounded-full border border-primary/20 bg-background text-primary hover:border-primary/40 transition-colors"
                  >
                    {followup}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {engineFailures.length > 0 && (
          <div className="mb-4 flex items-start gap-2 text-xs text-muted-foreground font-body bg-card border border-border rounded-xl px-3 py-2">
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 text-amber-600 flex-shrink-0" />
            <p>
              Some engines skipped: {engineFailures.map((failure) => SOURCE_LABELS[failure.source] || failure.source).join(" · ")}
            </p>
          </div>
        )}

        {indexStatus && (
          <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground font-body bg-primary/5 border border-primary/15 rounded-xl px-3 py-2">
            <Database className="w-3.5 h-3.5 text-primary" />
            Indexed {indexStatus.remote?.indexed || indexStatus.localCount || 0} pages from this search
            {indexStatus.remote?.queued ? ` · queued ${indexStatus.remote.queued} links` : ""}
            {indexStatus.corpusSize ? ` · local corpus ${indexStatus.corpusSize}` : ""}
          </div>
        )}

        {!isLoading && results.length > 0 && (
          <SearchFilters
            sortBy={sortBy}
            onSortChange={setSortBy}
            contentTypeFilter={contentTypeFilter}
            onContentTypeChange={setContentTypeFilter}
            qualityFilter={qualityFilter}
            onQualityFilterChange={setQualityFilter}
            excludedDomains={excludedDomains}
            onAddExcludedDomain={addExcludedDomain}
            onRemoveExcludedDomain={removeExcludedDomain}
            onClearExcludedDomains={() => setExcludedDomains([])}
            contentTypeCounts={contentTypeCounts}
            totalResults={searchMeta.total}
            visibleResults={visibleResults.length}
          />
        )}

        {isLoading && <SearchSkeleton />}

        {error && !isLoading && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center py-16">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <h2 className="text-lg font-heading font-semibold mb-2">Something went wrong</h2>
            <p className="text-sm text-muted-foreground font-body mb-4">{error}</p>
            <button onClick={() => performSearch(query)} className="text-sm text-primary hover:underline font-body">
              Try again
            </button>
          </motion.div>
        )}

        {!isLoading && !error && query && results.length === 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center py-16">
            <SearchX className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
            <h2 className="text-lg font-heading font-semibold mb-2">No results found</h2>
            <p className="text-sm text-muted-foreground font-body">
              Try broader keywords. The index grows automatically as people search.
            </p>
          </motion.div>
        )}

        {!isLoading && !error && results.length > 0 && (
          <div className="space-y-1">
            <AnimatePresence mode="popLayout">
              {visibleResults.length > 0 ? (
                visibleResults.map((result, index) => (
                  <SearchResultItem
                    key={result.url}
                    result={result}
                    index={index}
                    onHideDomain={addExcludedDomain}
                  />
                ))
              ) : (
                <motion.p
                  key="empty-filter"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-sm text-muted-foreground font-body text-center py-10"
                >
                  No results match the current filters.
                </motion.p>
              )}
            </AnimatePresence>

            <div ref={sentinelRef} className="h-8" />

            {(visibleCount < filteredResults.length || hasMore) && (
              <div className="flex justify-center pt-2 pb-6">
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="text-sm font-body px-4 py-2 rounded-full border border-border hover:border-primary/40 hover:text-primary transition-colors"
                >
                  {loadingMore ? "Loading more of the web…" : "Load every remaining result"}
                </button>
              </div>
            )}
          </div>
        )}

        <div className="h-16" />
      </main>
    </div>
  );
}
