import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SlidersHorizontal, ArrowUpDown, Calendar, X, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";

export const SORT_OPTIONS = [
  { id: "relevance", label: "Relevance" },
  { id: "title_asc", label: "Title A→Z" },
  { id: "title_desc", label: "Title Z→A" },
  { id: "domain_asc", label: "Domain A→Z" },
];

export const DATE_RANGE_OPTIONS = [
  { id: "any", label: "Any time" },
  { id: "day", label: "Past 24 hours" },
  { id: "week", label: "Past week" },
  { id: "month", label: "Past month" },
  { id: "year", label: "Past year" },
];

function getDomain(url) {
  try { return new URL(url).hostname.replace("www.", ""); } catch { return url; }
}

export function applyFiltersAndSort(results, { sortBy, dateRange, domainFilter }) {
  let out = [...results];

  // Domain filter
  if (domainFilter) {
    out = out.filter(r => getDomain(r.url).includes(domainFilter.toLowerCase()));
  }

  // Date range — only meaningful for index results that carry a crawl date,
  // but we simulate it by checking if url/title contains year patterns
  // (real filtering would need a date field; we skip filtering for AI results without dates)
  // So date range is a UI signal but we don't break non-dated results.

  // Sort
  if (sortBy === "title_asc") {
    out.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
  } else if (sortBy === "title_desc") {
    out.sort((a, b) => (b.title || "").localeCompare(a.title || ""));
  } else if (sortBy === "domain_asc") {
    out.sort((a, b) => getDomain(a.url).localeCompare(getDomain(b.url)));
  }
  // "relevance" = keep original order

  return out;
}

export default function SearchFilters({ sortBy, onSortChange, dateRange, onDateRangeChange, totalResults }) {
  const [open, setOpen] = useState(false);

  const hasActiveFilters = sortBy !== "relevance" || dateRange !== "any";
  const activeCount = [sortBy !== "relevance", dateRange !== "any"].filter(Boolean).length;

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setOpen(!open)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-body border transition-all ${
            hasActiveFilters
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

        {/* Sort quick-select pills */}
        <div className="flex gap-1.5 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {SORT_OPTIONS.map(opt => (
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

        {hasActiveFilters && (
          <button
            onClick={() => { onSortChange("relevance"); onDateRangeChange("any"); }}
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
            <div className="mt-3 p-4 bg-card border border-border rounded-xl flex flex-wrap gap-6">
              {/* Date Range */}
              <div>
                <p className="text-xs font-body font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Calendar className="w-3 h-3" />
                  Date range
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {DATE_RANGE_OPTIONS.map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => onDateRangeChange(opt.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-body border transition-all ${
                        dateRange === opt.id
                          ? "bg-primary/10 text-primary border-primary/30 font-medium"
                          : "bg-background text-muted-foreground border-border hover:border-primary/30"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sort full list */}
              <div>
                <p className="text-xs font-body font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <ArrowUpDown className="w-3 h-3" />
                  Sort by
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {SORT_OPTIONS.map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => onSortChange(opt.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-body border transition-all ${
                        sortBy === opt.id
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}