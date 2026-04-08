import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, ArrowUpRight } from "lucide-react";

export default function RecentSearches({ searches, onSelect }) {
  if (!searches || searches.length === 0) return null;

  const unique = [...new Map(searches.map(s => [s.query, s])).values()].slice(0, 5);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.5 }}
      className="mt-8 md:mt-10"
    >
      <h3 className="text-xs font-body font-medium text-muted-foreground uppercase tracking-wider mb-3 text-center">
        Recent Searches
      </h3>
      <div className="flex flex-wrap justify-center gap-2">
        <AnimatePresence>
          {unique.map((search, i) => (
            <motion.button
              key={search.id || i}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => onSelect(search.query)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border hover:border-primary/30 hover:bg-primary/5 text-sm font-body text-muted-foreground hover:text-foreground transition-all"
            >
              <Clock className="w-3 h-3" />
              <span className="truncate max-w-32">{search.query}</span>
              <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100" />
            </motion.button>
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}