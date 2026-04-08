import React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import SearchBar from "../components/search/SearchBar";
import QuickLinks from "../components/search/QuickLinks";
import RecentSearches from "../components/search/RecentSearches";
import { Sparkles } from "lucide-react";

export default function Home() {
  const navigate = useNavigate();

  const { data: recentSearches } = useQuery({
    queryKey: ["recentSearches"],
    queryFn: () => base44.entities.SearchHistory.list("-created_date", 10),
    initialData: [],
  });

  const handleSearch = (query) => {
    navigate(`/search?q=${encodeURIComponent(query)}`);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/3 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-accent/3 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-2xl mx-auto relative z-10 -mt-16 md:-mt-20">
        {/* Logo / Brand */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-8 md:mb-10"
        >
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-primary flex items-center justify-center">
              <Sparkles className="w-5 h-5 md:w-6 md:h-6 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-heading font-bold text-foreground tracking-tight">
            Explore
          </h1>
          <p className="text-muted-foreground font-body text-sm md:text-base mt-2">
            Search across the entire web, instantly.
          </p>
        </motion.div>

        {/* Search Bar */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.5 }}
        >
          <SearchBar size="large" onSearch={handleSearch} />
        </motion.div>

        {/* Quick Links */}
        <QuickLinks onSelect={handleSearch} />

        {/* Recent Searches */}
        <RecentSearches searches={recentSearches} onSelect={handleSearch} />
      </div>

      {/* Footer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="absolute bottom-6 text-center"
      >
        <p className="text-xs text-muted-foreground/50 font-body">
          Powered by web search · Results from across the internet
        </p>
      </motion.div>
    </div>
  );
}