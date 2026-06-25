import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { base44 } from "@/api/base44Client";
import { AlertCircle, SearchX, Sparkles } from "lucide-react";
import MobileNavMenu from "../components/layout/MobileNavMenu";
import SearchBar from "../components/search/SearchBar";
import SearchResultItem from "../components/search/SearchResultItem.jsx";
import SearchSkeleton from "../components/search/SearchSkeleton";
import SearchFilters, { applyFiltersAndSort, QUALITY_OPTIONS } from "../components/search/SearchFilters";

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
  const [error, setError] = useState(null);
  const [searchTime, setSearchTime] = useState(null);
  const [searchMeta, setSearchMeta] = useState({ total: 0, returned: 0, intent: "general" });
  const [source, setSource] = useState("web");
  const [sortBy, setSortBy] = useState("relevance");
  const [contentTypeFilter, setContentTypeFilter] = useState("all");
  const [qualityFilter, setQualityFilter] = useState("any");
  const [excludedDomains, setExcludedDomains] = useState([]);

  const addExcludedDomain = useCallback((domain) => {
    const normalized = normalizeDomain(domain);
    if (!normalized) return;
    setExcludedDomains((current) => (current.includes(normalized) ? current : [...current, normalized]));
  }, []);

  const removeExcludedDomain = useCallback((domain) => {
    setExcludedDomains((current) => current.filter((item) => item !== domain));
  }, []);

  const fetchWebResults = useCallback(async (searchQuery) => {
    const response = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}&limit=30`);
    if (!response.ok) {
      throw new Error(`Web search failed with HTTP ${response.status}`);
    }
    const data = await response.json();
    return data.results || [];
  }, []);

  const mergeResults = useCallback((primary, secondary) => {
    const seen = new Set();
    const merged = [];
    [...primary, ...secondary].forEach((result) => {
      if (!result?.url || seen.has(result.url)) return;
      seen.add(result.url);
      merged.push(result);
    });
    return merged;
  }, []);

  const performSearch = useCallback(async (searchQuery) => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setResults([]);
      setSearchMeta({ total: 0, returned: 0, intent: "general" });
      setSearchTime(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    setSortBy("relevance");
    setContentTypeFilter("all");
    setQualityFilter("any");
    setExcludedDomains([]);

    const startTime = Date.now();

    try {
      const webResults = await fetchWebResults(trimmed);
      let finalResults = webResults;
      let sourceLabel = "web";
      let totalMatches = webResults.length;
      let intent = "general";

      try {
        const res = await base44.functions.invoke("searchIndex", {
          query: trimmed,
          limit: 250,
          maxPerDomain: 0,
          minScore: 0,
        });

        const data = res.data || {};
        const indexedResults = data.results || [];
        finalResults = mergeResults(webResults, indexedResults);
        sourceLabel = indexedResults.length > 0 ? "web+index" : "web";
        totalMatches = Math.max(webResults.length, data.total ?? indexedResults.length, finalResults.length);
        intent = data.intent || intent;
      } catch (indexErr) {
        const isMissingSearchFunction =
          indexErr?.status === 404 ||
          indexErr?.response?.status === 404 ||
          /404|not found/i.test(indexErr?.message || "");

        if (!isMissingSearchFunction) throw indexErr;
      }

      setResults(finalResults);
      setSearchMeta({
        total: totalMatches,
        returned: finalResults.length,
        intent,
      });
      setSource(sourceLabel);
      setSearchTime(((Date.now() - startTime) / 1000).toFixed(2));

      base44.entities.SearchHistory.create({
        query: trimmed,
        results_count: finalResults.length,
      }).catch(() => {});
    } catch (err) {
      setResults([]);
      setSearchMeta({ total: 0, returned: 0, intent: "general" });
      setError(err?.message || "Search failed");
    } finally {
      setIsLoading(false);
    }
  }, [fetchWebResults, mergeResults]);

  useEffect(() => {
    if (query) performSearch(query);
    else {
      setResults([]);
      setSearchMeta({ total: 0, returned: 0, intent: "general" });
      setSearchTime(null);
    }
  }, [query, performSearch]);

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

  const contentTypeCounts = useMemo(() => {
    return results.reduce((acc, result) => {
      const type = result.content_type || "general";
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});
  }, [results]);

  const qualitySummary = QUALITY_OPTIONS.find((option) => option.id === qualityFilter)?.label || "Any quality";
  const sourceLabel = source === "web+index" ? "Live web + index" : "Live web search";

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
              Showing {filteredResults.length} of {searchMeta.total} matches ({searchTime}s)
            </p>
            <span className="inline-flex items-center gap-1 text-xs bg-accent/10 text-accent px-2 py-0.5 rounded-full font-body">
              <Sparkles className="w-3 h-3" />
              {sourceLabel}
            </span>
            {excludedDomains.length > 0 && (
              <span className="text-xs text-muted-foreground font-body">
                {excludedDomains.length} hidden domain{excludedDomains.length === 1 ? "" : "s"}
              </span>
            )}
            <span className="text-xs text-muted-foreground font-body">{qualitySummary}</span>
          </motion.div>
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
            visibleResults={filteredResults.length}
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
              Try broader keywords or crawl more pages into the index.
            </p>
          </motion.div>
        )}

        {!isLoading && !error && results.length > 0 && (
          <div className="space-y-1">
            <AnimatePresence mode="wait">
              {filteredResults.length > 0 ? (
                filteredResults.map((result, index) => (
                  <SearchResultItem
                    key={result.url + index}
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
          </div>
        )}

        <div className="h-16" />
      </main>
    </div>
  );
}
