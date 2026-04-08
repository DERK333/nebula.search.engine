import React, { useState, useRef, useEffect } from "react";
import { Search, X, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";

export default function SearchBar({ initialQuery = "", size = "large", onSearch }) {
  const [query, setQuery] = useState(initialQuery);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    if (onSearch) {
      onSearch(query.trim());
    } else {
      navigate(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  const clearQuery = () => {
    setQuery("");
    inputRef.current?.focus();
  };

  const isLarge = size === "large";

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <motion.div
        className={`
          relative flex items-center w-full rounded-full
          bg-card border transition-all duration-300
          ${isFocused
            ? "border-primary/40 shadow-lg shadow-primary/5 ring-4 ring-primary/5"
            : "border-border shadow-sm hover:shadow-md hover:border-border/80"
          }
          ${isLarge ? "h-14 md:h-16 px-5 md:px-6" : "h-11 md:h-12 px-4"}
        `}
        layout
      >
        <Search className={`${isLarge ? "w-5 h-5" : "w-4 h-4"} text-muted-foreground flex-shrink-0`} />
        
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
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
  );
}