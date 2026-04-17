import React, { useState, useRef, useEffect } from "react";
import { Search, X, ArrowRight, Clock, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export default function SearchBar({ initialQuery = "", size = "large", onSearch }) {
  const [query, setQuery] = useState(initialQuery);
  const [isFocused, setIsFocused] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const inputRef = useRef(null);
  const containerRef = useRef(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: searchHistory = [] } = useQuery({
    queryKey: ["recentSearches"],
    queryFn: () => base44.entities.SearchHistory.list("-created_date", 20),
  });

  // Deduplicated, max 8 recent entries
  const uniqueHistory = [...new Map(searchHistory.map(s => [s.query, s])).values()].slice(0, 8);

  // Filter by current input if user has typed something
  const filteredHistory = query.trim()
    ? uniqueHistory.filter(s => s.query.toLowerCase().includes(query.toLowerCase()) && s.query.toLowerCase() !== query.toLowerCase())
    : uniqueHistory;

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowHistory(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    setShowHistory(false);
    if (onSearch) {
      onSearch(query.trim());
    } else {
      navigate(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  const handleSelectHistory = (q) => {
    setQuery(q);
    setShowHistory(false);
    if (onSearch) onSearch(q);
    else navigate(`/search?q=${encodeURIComponent(q)}`);
  };

  const handleDeleteHistory = async (e, id) => {
    e.stopPropagation();
    await base44.entities.SearchHistory.delete(id);
    queryClient.invalidateQueries({ queryKey: ["recentSearches"] });
  };

  const clearQuery = () => {
    setQuery("");
    inputRef.current?.focus();
  };

  const isLarge = size === "large";

  return (
    <div ref={containerRef} className="w-full relative">
      <form onSubmit={handleSubmit} className="w-full">
        <motion.div
          className={`
            relative flex items-center w-full rounded-full
            bg-card border transition-all duration-300
            ${isFocused || showHistory
              ? "border-primary/40 shadow-lg shadow-primary/5 ring-4 ring-primary/5"
              : "border-border shadow-sm hover:shadow-md hover:border-border/80"
            }
            ${isLarge ? "h-14 md:h-16 px-5 md:px-6" : "h-11 md:h-12 px-4"}
            ${showHistory && filteredHistory.length > 0 ? "rounded-b-none border-b-0" : ""}
          `}
          layout
        >
          <Search className={`${isLarge ? "w-5 h-5" : "w-4 h-4"} text-muted-foreground flex-shrink-0`} />

          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setShowHistory(true); }}
            onFocus={() => { setIsFocused(true); setShowHistory(true); }}
            placeholder="Search the web..."
            className={`
              flex-1 bg-transparent border-none outline-none
              font-body text-foreground placeholder:text-muted-foreground/60
              ${isLarge ? "text-base md:text-lg mx-4" : "text-sm mx-3"}
            `}
            autoComplete="off"
          />

          <AnimatePresence>
            {query && (
              <motion.button
                type="button"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                onClick={clearQuery}
                className="p-1 rounded-full hover:bg-muted transition-colors mr-2"
              >
                <X className={`${isLarge ? "w-4 h-4" : "w-3.5 h-3.5"} text-muted-foreground`} />
              </motion.button>
            )}
          </AnimatePresence>

          <motion.button
            type="submit"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={`
              flex-shrink-0 rounded-full bg-primary text-primary-foreground
              flex items-center justify-center transition-all
              ${isLarge ? "w-10 h-10 md:w-11 md:h-11" : "w-8 h-8"}
              ${query.trim() ? "opacity-100" : "opacity-40"}
            `}
            disabled={!query.trim()}
          >
            <ArrowRight className={`${isLarge ? "w-5 h-5" : "w-4 h-4"}`} />
          </motion.button>
        </motion.div>
      </form>

      {/* History Dropdown */}
      <AnimatePresence>
        {showHistory && filteredHistory.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 right-0 z-50 bg-card border border-primary/40 border-t-0 rounded-b-2xl shadow-xl shadow-primary/5 overflow-hidden"
          >
            <div className="px-3 py-1.5 border-b border-border/50">
              <span className="text-xs font-body text-muted-foreground uppercase tracking-wider">Recent searches</span>
            </div>
            {filteredHistory.map((item, i) => (
              <button
                key={item.id || i}
                type="button"
                onMouseDown={() => handleSelectHistory(item.query)}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted/60 transition-colors group text-left"
              >
                <Clock className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                <span className="flex-1 text-sm font-body truncate">{item.query}</span>
                {item.results_count != null && (
                  <span className="text-xs text-muted-foreground font-body hidden group-hover:hidden">
                    {item.results_count} results
                  </span>
                )}
                <button
                  onMouseDown={(e) => handleDeleteHistory(e, item.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 hover:text-destructive transition-all"
                  title="Remove"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}