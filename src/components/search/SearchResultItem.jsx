import React from "react";
import { motion } from "framer-motion";
import { ExternalLink, Globe } from "lucide-react";
import { CATEGORY_COLORS } from "./CategoryFilter";

export default function SearchResultItem({ result, index }) {
  const { title, url, description, category } = result;

  const getDomain = (url) => {
    try {
      const u = new URL(url);
      return u.hostname.replace("www.", "");
    } catch {
      return url;
    }
  };

  const getFavicon = (url) => {
    try {
      const u = new URL(url);
      return `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=32`;
    } catch {
      return null;
    }
  };

  return (
    <motion.a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3 }}
      className="group block p-4 md:p-5 rounded-xl hover:bg-card border border-transparent hover:border-border hover:shadow-sm transition-all duration-200"
    >
      {/* URL breadcrumb */}
      <div className="flex items-center gap-2 mb-1.5">
        {getFavicon(url) ? (
          <img
            src={getFavicon(url)}
            alt=""
            className="w-4 h-4 rounded-sm"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        ) : (
          <Globe className="w-4 h-4 text-muted-foreground" />
        )}
        <span className="text-xs md:text-sm text-muted-foreground font-body truncate max-w-md">
          {getDomain(url)}
        </span>
        <ExternalLink className="w-3 h-3 text-muted-foreground/0 group-hover:text-muted-foreground/60 transition-all" />
      </div>

      {/* Title */}
      <h3 className="text-base md:text-lg font-medium font-heading text-primary group-hover:text-primary/80 transition-colors leading-snug mb-1.5">
        {title}
      </h3>

      {/* Description */}
      {description && (
        <p className="text-sm text-muted-foreground font-body leading-relaxed line-clamp-2">
          {description}
        </p>
      )}

      {/* Category badge */}
      {category && category !== "Other" && (
        <span className={`inline-block mt-2 text-xs font-body font-medium px-2 py-0.5 rounded-full border ${CATEGORY_COLORS[category] || CATEGORY_COLORS["Other"]}`}>
          {category}
        </span>
      )}
    </motion.a>
  );
}