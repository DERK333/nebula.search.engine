import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import NavBar from "@/components/layout/NavBar";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { TrendingUp, Search } from "lucide-react";
import { subDays } from "date-fns";

export default function TrendingSearches() {
  const { data: history = [], isLoading } = useQuery({
    queryKey: ["search-history-trending"],
    queryFn: () => base44.entities.SearchHistory.list("-created_date", 1000),
  });

  const chartData = useMemo(() => {
    const cutoff = subDays(new Date(), 30).getTime();
    const counts = {};

    history
      .filter(h => new Date(h.created_date).getTime() >= cutoff)
      .forEach(h => {
        const term = (h.query || "").trim().toLowerCase();
        if (term) counts[term] = (counts[term] || 0) + 1;
      });

    return Object.entries(counts)
      .map(([term, count]) => ({ term, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);
  }, [history]);

  const COLORS = [
    "#6366f1","#8b5cf6","#a78bfa","#c4b5fd","#818cf8",
    "#60a5fa","#34d399","#fbbf24","#f87171","#fb923c",
  ];

  const CustomTooltip = /** @param {any} props */ ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-popover border border-border rounded-lg px-3 py-2 shadow-lg">
        <p className="text-sm font-medium font-heading">{payload[0].payload.term}</p>
        <p className="text-xs text-muted-foreground font-body">{payload[0].value} search{payload[0].value !== 1 ? "es" : ""}</p>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-heading font-semibold">Trending Searches</h1>
            <p className="text-sm text-muted-foreground font-body">Most popular search terms over the last 30 days</p>
          </div>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
          </div>
        )}

        {!isLoading && chartData.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 text-center gap-3">
            <Search className="w-12 h-12 text-muted-foreground/30" />
            <p className="text-muted-foreground font-body">No search history in the last 30 days.</p>
          </div>
        )}

        {!isLoading && chartData.length > 0 && (
          <>
            {/* Bar Chart */}
            <div className="bg-card border border-border rounded-2xl p-6 mb-6">
              <h2 className="text-sm font-medium font-heading text-muted-foreground mb-4 uppercase tracking-wide">Search Volume</h2>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 60 }}>
                  <XAxis
                    dataKey="term"
                    tick={{ fontSize: 12, fontFamily: "var(--font-body)", fill: "hsl(var(--muted-foreground))" }}
                    angle={-40}
                    textAnchor="end"
                    interval={0}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fontFamily: "var(--font-body)", fill: "hsl(var(--muted-foreground))" }}
                    allowDecimals={false}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(var(--muted))", radius: 4 }} />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {chartData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Ranked list */}
            <div className="bg-card border border-border rounded-2xl p-6">
              <h2 className="text-sm font-medium font-heading text-muted-foreground mb-4 uppercase tracking-wide">Full Ranking</h2>
              <div className="space-y-2">
                {chartData.map((item, i) => (
                  <div key={item.term} className="flex items-center gap-3">
                    <span className="w-6 text-xs font-body text-muted-foreground text-right flex-shrink-0">{i + 1}</span>
                    <div className="flex-1 flex items-center gap-2 min-w-0">
                      <div
                        className="h-2 rounded-full flex-shrink-0"
                        style={{
                          width: `${Math.max(8, (item.count / chartData[0].count) * 200)}px`,
                          backgroundColor: COLORS[i % COLORS.length],
                        }}
                      />
                      <span className="text-sm font-body truncate">{item.term}</span>
                    </div>
                    <span className="text-sm font-medium font-body text-muted-foreground flex-shrink-0">
                      {item.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}