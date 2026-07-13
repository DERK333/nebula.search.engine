import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SlidersHorizontal, ArrowUpDown, X, ChevronDown, Filter, ShieldX } from "lucide-react";

export const SORT_OPTIONS = [
  { id: "relevance", label: "Relevance" },
  { id: "score_desc", label: "Best match" },
  { id: "quality_desc", label: "Quality" },
  { id: "title_asc", label: "Title A→Z" },
  { id: "domain_asc", label: "Domain A→Z" },
];

export const CONTENT_TYPE_OPTIONS = [
  { id: "all", label: "All types" },
  { id: "documentation", label: "Docs" },
  { id: "technical_guide", label: "Guides" },
  { id: "research", label: "Research" },
  { id: "news", label: "News" },
  { id: "commercial", label: "Shopping" },
  { id: "blog", label: "Blog" },
  { id: "wiki", label: "Wiki" },
  { id: "legal_boilerplate", label: "Policies" },
  { id: "general", label: "General" },
];

export const QUALITY_OPTIONS = [
  { id: "any", label: "Any quality", min: 0 },
  { id: "good", label: "Good+", min: 0.5 },
  { id: "strong", label: "Strong+", min: 0.7 },
];

function getDomain(url) {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return url || "";
  }
}

function matchesDomain(domain, term) {
  const normalizedDomain = (domain || "").toLowerCase();
  const normalizedTerm = (term || "").toLowerCase();
  return normalizedDomain === normalizedTerm || normalizedDomain.endsWith(`.${normalizedTerm}`);
}

export function applyFiltersAndSort(results, { sortBy, contentTypeFilter, excludedDomains = [], minQuality = 0 }) {
  let out = [...results];

  if (contentTypeFilter && contentTypeFilter !== "all") {
    out = out.filter((result) => (result.content_type || "general") === contentTypeFilter);
  }

  if (excludedDomains.length > 0) {
    out = out.filter((result) => {
      const domain = getDomain(result.url).toLowerCase();
      return !excludedDomains.some((term) => matchesDomain(domain, term));
    });
  }

  if (minQuality > 0) {
    out = out.filter((result) => (result.quality_score ?? 0) >= minQuality);
  }

  if (sortBy === "score_desc") {
    out.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  } else if (sortBy === "quality_desc") {
    out.sort((a, b) => (b.quality_score ?? 0) - (a.quality_score ?? 0));
  } else if (sortBy === "title_asc") {
    out.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
  } else if (sortBy === "domain_asc") {
    out.sort((a, b) => getDomain(a.url).localeCompare(getDomain(b.url)));
  }

  return out;
}

export default function SearchFilters({
  sortBy,
  onSortChange,
  contentTypeFilter,
  onContentTypeChange,
  qualityFilter,
  onQualityFilterChange,
  excludedDomains,
  onAddExcludedDomain,
  onRemoveExcludedDomain,
  onClearExcludedDomains,
  contentTypeCounts,
  totalResults,
  visibleResults,
}) {
  const [open, setOpen] = useState(false);
  const [domainInput, setDomainInput] = useState("");

  const activeCount = useMemo(() => {
    return [
      sortBy !== "relevance",
      contentTypeFilter !== "all",
      qualityFilter !== "any",
      excludedDomains.length > 0,
    ].filter(Boolean).length;
  }, [contentTypeFilter, excludedDomains.length, qualityFilter, sortBy]);

  const handleAddDomain = () => {
    const value = domainInput.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "");
    if (!value) return;

    value
      .split(",")
      .map((domain) => domain.trim())
      .filter(Boolean)
      .forEach(onAddExcludedDomain);

    setDomainInput("");
  };

  return (
    <div className="mb-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setOpen((value) => !value)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-body border transition-all ${
            activeCount > 0
              ? "bg-primary/10 text-primary border-primary/30 font-medium"
              : "bg-background text-muted-foreground border-border hover:border-primary/30 hover:text-foreground"
          }`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          Filters
          {activeCount > 0 && (
            <span className="w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-medium">
              {activeCount}
            </span>
          )}
          <ChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>

        <div className="flex gap-1.5 overflow-x-auto scrollbar-none" style={{ scrollbarWidth: "none" }}>
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => onSortChange(opt.id)}
              className={`flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-body border transition-all ${
                sortBy === opt.id
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-border hover:border-primary/30 hover:text-foreground"
              }`}
            >
              {opt.id === "relevance" && <ArrowUpDown className="w-3 h-3" />}
              {opt.label}
            </button>
          ))}
        </div>

        {activeCount > 0 && (
          <button
            onClick={() => {
              onSortChange("relevance");
              onContentTypeChange("all");
              onQualityFilterChange("any");
              onClearExcludedDomains();
            }}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors ml-auto flex-shrink-0"
          >
            <X className="w-3 h-3" />
            Clear
          </button>
        )}
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-4 bg-card border border-border rounded-xl space-y-4">
              <div className="flex flex-wrap gap-4">
                <div>
                  <p className="text-xs font-body font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Filter className="w-3 h-3" />
                    Result type
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {CONTENT_TYPE_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => onContentTypeChange(opt.id)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-body border transition-all ${
                          contentTypeFilter === opt.id
                            ? "bg-primary/10 text-primary border-primary/30 font-medium"
                            : "bg-background text-muted-foreground border-border hover:border-primary/30"
                        }`}
                      >
                        {opt.label}
                        {contentTypeCounts?.[opt.id] > 0 && (
                          <span className="ml-1 opacity-60">{contentTypeCounts[opt.id]}</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-body font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <ArrowUpDown className="w-3 h-3" />
                    Quality
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {QUALITY_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => onQualityFilterChange(opt.id)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-body border transition-all ${
                          qualityFilter === opt.id
                            ? "bg-primary/10 text-primary border-primary/30 font-medium"
                            : "bg-background text-muted-foreground border-border hover:border-primary/30"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-body font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldX className="w-3 h-3" />
                  Hide domains
                </p>
                <div className="flex flex-col gap-2 md:flex-row">
                  <input
                    value={domainInput}
                    onChange={(e) => setDomainInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddDomain();
                      }
                    }}
                    placeholder="reddit.com, pinterest.com, example.com"
                    className="md:flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm font-body outline-none focus:border-primary/40"
                  />
                  <button
                    onClick={handleAddDomain}
                    className="px-3 py-2 rounded-lg text-sm border border-border bg-background hover:border-primary/30 hover:text-foreground transition-colors"
                  >
                    Add
                  </button>
                </div>

                {excludedDomains.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {excludedDomains.map((domain) => (
                      <button
                        key={domain}
                        onClick={() => onRemoveExcludedDomain(domain)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-destructive/10 text-destructive border border-destructive/20"
                      >
                        {domain}
                        <X className="w-3 h-3" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="text-xs text-muted-foreground font-body flex flex-wrap gap-3">
                <span>{visibleResults} visible</span>
                <span>{totalResults} total matches</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
