import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { TrendingUp, Search, AlertCircle, BarChart2, ArrowLeft, Hash } from "lucide-react";

function StatCard({ icon: Icon, label, value, color = "text-primary" }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 flex items-center gap-4">
      <div className={`p-3 rounded-lg bg-muted ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-sm text-muted-foreground font-body">{label}</p>
        <p className="text-2xl font-heading font-semibold text-foreground">{value}</p>
      </div>
    </div>
  );
}

function QueryRow({ rank, query, count, isZero }) {
  const navigate = useNavigate();
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: rank * 0.03 }}
      className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-muted/50 cursor-pointer group transition-colors"
      onClick={() => !isZero && navigate(`/search?q=${encodeURIComponent(query)}`)}
    >
      <span className="text-xs font-mono text-muted-foreground w-6 text-right flex-shrink-0">{rank}</span>
      <Search className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
      <span className="flex-1 text-sm font-body text-foreground group-hover:text-primary transition-colors truncate">{query}</span>
      <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${
        isZero
          ? "bg-destructive/10 text-destructive"
          : "bg-primary/10 text-primary"
      }`}>
        {count} {count === 1 ? "search" : "searches"}
      </span>
    </motion.div>
  );
}

export default function Analytics() {
  const navigate = useNavigate();
  const { data: user } = useQuery({
    queryKey: ["me"],
    queryFn: () => base44.auth.me(),
  });

  const { data: history = [], isLoading } = useQuery({
    queryKey: ["searchHistory"],
    queryFn: () => base44.entities.SearchHistory.list("-created_date", 1000),
    enabled: user?.role === "admin",
  });

  const stats = useMemo(() => {
    const counts = {};
    const zeroCounts = {};

    history.forEach((h) => {
      const q = h.query?.trim().toLowerCase();
      if (!q) return;
      if (h.results_count === 0) {
        zeroCounts[q] = (zeroCounts[q] || 0) + 1;
      } else {
        counts[q] = (counts[q] || 0) + 1;
      }
    });

    const trending = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([query, count]) => ({ query, count }));

    const zeroResults = Object.entries(zeroCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([query, count]) => ({ query, count }));

    return { trending, zeroResults, total: history.length, uniqueQueries: Object.keys({ ...counts, ...zeroCounts }).length };
  }, [history]);

  if (!user) return null;

  if (user.role !== "admin") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-10 h-10 text-destructive mx-auto mb-3" />
          <h2 className="text-lg font-heading font-semibold text-foreground">Access Denied</h2>
          <p className="text-sm text-muted-foreground mt-1">This page is for admins only.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-8 md:py-12">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <button
            onClick={() => navigate("/")}
            className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-2xl md:text-3xl font-heading font-semibold text-foreground">Search Analytics</h1>
            <p className="text-sm text-muted-foreground font-body mt-0.5">Insights from user search behavior</p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-24">
            <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Stat cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
              <StatCard icon={BarChart2} label="Total Searches" value={stats.total.toLocaleString()} color="text-primary" />
              <StatCard icon={Hash} label="Unique Queries" value={stats.uniqueQueries.toLocaleString()} color="text-accent" />
              <StatCard icon={TrendingUp} label="Top Query Count" value={stats.trending[0]?.count ?? 0} color="text-emerald-600" />
              <StatCard icon={AlertCircle} label="Zero-Result Queries" value={stats.zeroResults.length} color="text-destructive" />
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Trending queries */}
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  <h2 className="font-heading font-semibold text-foreground text-sm">Trending Searches</h2>
                </div>
                <div className="divide-y divide-border/50 py-1 max-h-[480px] overflow-y-auto">
                  {stats.trending.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-10">No data yet.</p>
                  ) : (
                    stats.trending.map((item, i) => (
                      <QueryRow key={item.query} rank={i + 1} query={item.query} count={item.count} />
                    ))
                  )}
                </div>
              </div>

              {/* Zero-result queries */}
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
                  <AlertCircle className="w-4 h-4 text-destructive" />
                  <h2 className="font-heading font-semibold text-foreground text-sm">Content Gaps</h2>
                  <span className="ml-auto text-xs text-muted-foreground">Searches with 0 results</span>
                </div>
                <div className="divide-y divide-border/50 py-1 max-h-[480px] overflow-y-auto">
                  {stats.zeroResults.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-10">No content gaps detected 🎉</p>
                  ) : (
                    stats.zeroResults.map((item, i) => (
                      <QueryRow key={item.query} rank={i + 1} query={item.query} count={item.count} isZero />
                    ))
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}