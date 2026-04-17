import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { base44 } from "@/api/base44Client";
import { Sparkles, AlertCircle, SearchX, Settings, Database, Shield, Bookmark } from "lucide-react";
import AccountMenu from "@/components/account/AccountMenu";
import SearchBar from "../components/search/SearchBar";
import SearchResultItem from "../components/search/SearchResultItem";
import SearchSkeleton from "../components/search/SearchSkeleton";
import CategoryFilter from "../components/search/CategoryFilter";

export default function SearchResults() {
  const urlParams = new URLSearchParams(window.location.search);
  const query = urlParams.get("q") || "";

  const navigate = useNavigate();
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTime, setSearchTime] = useState(null);
  const [source, setSource] = useState(null); // "index" | "ai"
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [isTagging, setIsTagging] = useState(false);

  // AI-tag results with categories after they load
  const tagResultsWithCategories = useCallback(async (rawResults) => {
    if (!rawResults.length) return rawResults;
    setIsTagging(true);
    const tagged = await base44.integrations.Core.InvokeLLM({
      prompt: `Analyze these search results and assign a category to each one.

Results:
${rawResults.map((r, i) => `${i}. Title: "${r.title}" | URL: ${r.url} | Description: ${r.description || ""}`).join("\n")}

For each result index, assign exactly ONE category from this list:
News, Tech, Science, Entertainment, Business, Education, Health, Sports, Music, Gaming, Shopping, Other

Return an array of objects with "index" and "category".`,
      response_json_schema: {
        type: "object",
        properties: {
          tags: {
            type: "array",
            items: {
              type: "object",
              properties: {
                index: { type: "number" },
                category: { type: "string" }
              }
            }
          }
        }
      }
    });

    const tagMap = {};
    (tagged.tags || []).forEach(({ index, category }) => { tagMap[index] = category; });
    setIsTagging(false);
    return rawResults.map((r, i) => ({ ...r, category: tagMap[i] || "Other" }));
  }, []);

  const performSearch = useCallback(async (searchQuery) => {
    if (!searchQuery.trim()) return;
    setIsLoading(true);
    setError(null);
    setSelectedCategory("all");
    const startTime = Date.now();

    // 1. Try local index first
    const indexRes = await base44.functions.invoke("searchIndex", { query: searchQuery, limit: 15 });
    const indexResults = indexRes.data?.results || [];

    let rawResults;
    let searchSource;

    if (indexResults.length >= 3) {
      rawResults = indexResults;
      searchSource = "index";
    } else {
      // 2. Fallback to AI-powered web search
      searchSource = "ai";
      const aiRes = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a search engine results generator. Given the search query "${searchQuery}", provide comprehensive and diverse search results from real, well-known websites across the internet.

For each result, provide:
- title: A realistic page title
- url: The actual URL of a real webpage that would contain this information
- description: A realistic meta description snippet (2-3 sentences)

Provide 10-15 diverse, high-quality results from different domains. Include results from major sites like Wikipedia, news outlets, educational sites, forums, official documentation, and specialized websites relevant to the query.`,
        response_json_schema: {
          type: "object",
          properties: {
            results: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  url: { type: "string" },
                  description: { type: "string" }
                }
              }
            }
          }
        },
        add_context_from_internet: true,
        model: "gemini_3_flash"
      });
      rawResults = aiRes.results || [];
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    setSearchTime(elapsed);
    setSource(searchSource);
    setIsLoading(false);

    base44.entities.SearchHistory.create({
      query: searchQuery,
      results_count: rawResults.length
    }).catch(() => {});

    // Tag with categories in the background
    const tagged = await tagResultsWithCategories(rawResults);
    setResults(tagged);
  }, [tagResultsWithCategories]);

  useEffect(() => {
    if (query) performSearch(query);
  }, [query, performSearch]);

  const handleSearch = (newQuery) => {
    navigate(`/search?q=${encodeURIComponent(newQuery)}`);
  };

  const categoryCounts = results.reduce((acc, r) => {
    const cat = r.category || "Other";
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {});

  const filteredResults = selectedCategory === "all"
    ? results
    : results.filter(r => r.category === selectedCategory);

  return (
    <div className="min-h-screen bg-background">
      {/* Top Bar */}
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
          <Link to="/saved" title="Saved" className="flex-shrink-0 p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
            <Bookmark className="w-4 h-4" />
          </Link>
          <Link to="/vpn" title="VPN Comparison" className="flex-shrink-0 p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
            <Shield className="w-4 h-4" />
          </Link>
          <Link to="/crawler" title="Crawler Dashboard" className="flex-shrink-0 p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
            <Settings className="w-4 h-4" />
          </Link>
          <AccountMenu />
        </div>
      </header>

      {/* Results Area */}
      <main className="max-w-3xl mx-auto px-4 py-6 md:py-8">
        {/* Stats + Source Badge */}
        {!isLoading && results.length > 0 && searchTime && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-3 mb-4 md:mb-6"
          >
            <p className="text-xs text-muted-foreground font-body">
              About {results.length} results ({searchTime}s)
            </p>
            {source === "index" && (
              <span className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-body">
                <Database className="w-3 h-3" />
                From index
              </span>
            )}
            {source === "ai" && (
              <span className="inline-flex items-center gap-1 text-xs bg-accent/10 text-accent px-2 py-0.5 rounded-full font-body">
                <Sparkles className="w-3 h-3" />
                AI-powered
              </span>
            )}
          </motion.div>
        )}

        {/* Category Filter */}
        {!isLoading && results.length > 0 && (
          <CategoryFilter
            selected={selectedCategory}
            onChange={setSelectedCategory}
            categoryCounts={categoryCounts}
          />
        )}

        {isLoading && <SearchSkeleton />}

        {error && !isLoading && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center py-16">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <h2 className="text-lg font-heading font-semibold mb-2">Something went wrong</h2>
            <p className="text-sm text-muted-foreground font-body mb-4">{error}</p>
            <button onClick={() => performSearch(query)} className="text-sm text-primary hover:underline font-body">Try again</button>
          </motion.div>
        )}

        {!isLoading && !error && results.length === 0 && query && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center py-16">
            <SearchX className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
            <h2 className="text-lg font-heading font-semibold mb-2">No results found</h2>
            <p className="text-sm text-muted-foreground font-body">Try different keywords or check your spelling.</p>
          </motion.div>
        )}

        {!isLoading && !error && results.length > 0 && (
          <div className="space-y-1">
            {isTagging && (
              <p className="text-xs text-muted-foreground font-body flex items-center gap-1.5 mb-3">
                <Sparkles className="w-3 h-3 animate-pulse text-primary" />
                Categorizing results with AI...
              </p>
            )}
            <AnimatePresence mode="wait">
              {filteredResults.length > 0 ? (
                filteredResults.map((result, index) => (
                  <SearchResultItem key={result.url + index} result={result} index={index} />
                ))
              ) : (
                <motion.p
                  key="empty-cat"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-sm text-muted-foreground font-body text-center py-10"
                >
                  No results in this category.
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