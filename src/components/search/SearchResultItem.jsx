import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ExternalLink, Globe, Bookmark, BookmarkCheck, Folder, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";

const RESULT_TYPE_COLORS = {
  news: "bg-blue-500/10 text-blue-600 border-blue-200",
  technical_guide: "bg-violet-500/10 text-violet-600 border-violet-200",
  documentation: "bg-cyan-500/10 text-cyan-600 border-cyan-200",
  research: "bg-emerald-500/10 text-emerald-600 border-emerald-200",
  commercial: "bg-amber-500/10 text-amber-700 border-amber-200",
  blog: "bg-fuchsia-500/10 text-fuchsia-600 border-fuchsia-200",
  wiki: "bg-indigo-500/10 text-indigo-600 border-indigo-200",
  legal_boilerplate: "bg-muted text-muted-foreground border-border",
  general: "bg-muted text-muted-foreground border-border",
};

const RESULT_TYPE_LABELS = {
  news: "News",
  technical_guide: "Guide",
  documentation: "Docs",
  research: "Research",
  commercial: "Shopping",
  blog: "Blog",
  wiki: "Wiki",
  legal_boilerplate: "Policies",
  general: "General",
};

export default function SearchResultItem({ result, index, onHideDomain }) {
  const { title, url, description, content_type } = result;
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showCollectionPicker, setShowCollectionPicker] = useState(false);
  const pickerRef = useRef(null);
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const domain = (() => {
    try {
      return new URL(url).hostname.replace("www.", "");
    } catch {
      return url;
    }
  })();
  const resultType = content_type || "general";

  const { data: bookmarks = [] } = useQuery({
    queryKey: ["bookmarks"],
    queryFn: () => base44.entities.Bookmark.filter({ created_by: user?.email }, "-created_date"),
    enabled: !!user,
    staleTime: 30000,
  });

  const collections = [...new Set(["General", ...bookmarks.map(b => b.collection || "General")])];

  useEffect(() => {
    const handler = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        setShowCollectionPicker(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSave = async (e, collection = "General") => {
    e.preventDefault();
    e.stopPropagation();
    if (saved || saving) return;
    setSaving(true);
    setShowCollectionPicker(false);
    const favicon = (() => {
      try { return `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=32`; } catch { return null; }
    })();
    await base44.entities.Bookmark.create({ title, url, description, favicon, collection });
    queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
    setSaved(true);
    setSaving(false);
  };

  const handleBookmarkClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (saved || saving) return;
    if (collections.length > 1) {
      setShowCollectionPicker(v => !v);
    } else {
      handleSave(e, "General");
    }
  };

  const handleHideDomain = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (onHideDomain) onHideDomain(domain);
  };

  const getFavicon = (u) => {
    try { return `https://www.google.com/s2/favicons?domain=${new URL(u).hostname}&sz=32`; } catch { return null; }
  };

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3 }}
      className="group relative block p-4 md:p-5 rounded-xl hover:bg-card border border-transparent hover:border-border hover:shadow-sm transition-all duration-200"
    >
      {/* Save button + collection picker */}
      <div ref={pickerRef} className="absolute top-3 right-3">
        {onHideDomain && (
          <button
            onClick={handleHideDomain}
            title={`Hide ${domain}`}
            className="p-1.5 mr-1 rounded-lg transition-all opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          >
            <X className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={handleBookmarkClick}
          title={saved ? "Saved!" : "Save to collection"}
          className={`p-1.5 rounded-lg transition-all opacity-0 group-hover:opacity-100 ${
            saved ? "text-primary !opacity-100" : "text-muted-foreground hover:text-primary hover:bg-primary/10"
          }`}
        >
          {saved ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
        </button>

        <AnimatePresence>
          {showCollectionPicker && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="absolute right-0 top-8 z-50 bg-popover border border-border rounded-xl shadow-xl min-w-40 py-1 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-xs text-muted-foreground px-3 py-1.5 font-body border-b border-border">Save to</p>
              {collections.map(col => (
                <button
                  key={col}
                  onMouseDown={(e) => handleSave(e, col)}
                  className="w-full text-left px-3 py-2 text-sm font-body hover:bg-muted transition-colors flex items-center gap-2"
                >
                  <Folder className="w-3.5 h-3.5 text-muted-foreground" />
                  {col}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <a href={url} target="_blank" rel="noopener noreferrer" className="block">
        {/* URL breadcrumb */}
        <div className="flex items-center gap-2 mb-1.5 pr-8">
          {getFavicon(url) ? (
            <img src={getFavicon(url)} alt="" className="w-4 h-4 rounded-sm"
              onError={(e) => { e.currentTarget.style.display = "none"; }} />
          ) : (
            <Globe className="w-4 h-4 text-muted-foreground" />
          )}
          <span className="text-xs md:text-sm text-muted-foreground font-body truncate max-w-md">
            {domain}
          </span>
          <ExternalLink className="w-3 h-3 text-muted-foreground/0 group-hover:text-muted-foreground/60 transition-all" />
        </div>

        {/* Title */}
        <h3 className="text-base md:text-lg font-medium font-heading text-primary group-hover:text-primary/80 transition-colors leading-snug mb-1.5 pr-8">
          {title}
        </h3>

        {/* Description */}
        {description && (
          <p className="text-sm text-muted-foreground font-body leading-relaxed line-clamp-2">
            {description}
          </p>
        )}

        {/* Category badge */}
        {resultType && (
          <span className={`inline-block mt-2 text-xs font-body font-medium px-2 py-0.5 rounded-full border ${RESULT_TYPE_COLORS[resultType] || RESULT_TYPE_COLORS.general}`}>
            {RESULT_TYPE_LABELS[resultType] || RESULT_TYPE_LABELS.general}
          </span>
        )}
      </a>
    </motion.article>
  );
}