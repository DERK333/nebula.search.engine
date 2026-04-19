import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import NavBar from "../components/layout/NavBar";
import { motion } from "framer-motion";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import {
  TrendingUp, Search, AlertCircle, BarChart2, ArrowLeft,
  Hash, Download, Calendar, MousePointerClick, Users, Clock
} from "lucide-react";

// ── helpers ────────────────────────────────────────────────────────────────────

const CATEGORY_KEYWORDS = {
  Tech:          ["tech", "software", "ai", "code", "programming", "javascript", "python", "app", "computer", "api", "developer", "web", "cloud", "data", "ml"],
  News:          ["news", "today", "breaking", "latest", "world", "politics", "election", "government", "report"],
  Science:       ["science", "research", "study", "physics", "biology", "space", "nasa", "climate", "discovery", "quantum"],
  Entertainment: ["movie", "film", "tv", "show", "actor", "celebrity", "entertainment", "stream", "netflix", "youtube"],
  Business:      ["business", "finance", "stock", "market", "startup", "economy", "invest", "company", "revenue"],
  Sports:        ["sport", "football", "basketball", "soccer", "nfl", "nba", "game", "player", "team", "score"],
  Health:        ["health", "fitness", "diet", "nutrition", "exercise", "mental", "doctor", "medicine", "workout"],
  Gaming:        ["game", "gaming", "xbox", "playstation", "steam", "fortnite", "minecraft", "esport"],
  Music:         ["music", "song", "album", "artist", "band", "concert", "spotify", "playlist"],
  Education:     ["learn", "course", "tutorial", "education", "university", "college", "study", "school"],
};

function categorizeQuery(query) {
  const q = query.toLowerCase();
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(k => q.includes(k))) return cat;
  }
  return "Other";
}

function groupByDay(history) {
  const map = {};
  history.forEach(h => {
    const day = h.created_date?.slice(0, 10);
    if (!day) return;
    if (!map[day]) map[day] = { date: day, searches: 0, withResults: 0, noResults: 0, users: new Set() };
    map[day].searches += 1;
    if (h.results_count > 0) map[day].withResults += 1;
    else map[day].noResults += 1;
    if (h.created_by) map[day].users.add(h.created_by);
  });
  return Object.values(map)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-30)
    .map(d => ({ ...d, dau: d.users.size, users: undefined }));
}

function exportCSV(rows, filename) {
  const keys = Object.keys(rows[0] || {});
  const csv = [keys.join(","), ...rows.map(r => keys.map(k => `"${r[k]}"`).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

// ── small components ───────────────────────────────────────────────────────────

const PALETTE = ["hsl(230,70%,55%)", "hsl(260,60%,58%)", "hsl(197,60%,50%)", "hsl(43,74%,60%)", "hsl(0,65%,55%)", "hsl(140,55%,45%)", "hsl(27,87%,60%)"];

function StatCard({ icon: Icon, label, value, sub, color = "text-primary" }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 flex items-center gap-4">
      <div className={`p-3 rounded-lg bg-muted ${color}`}><Icon className="w-5 h-5" /></div>
      <div>
        <p className="text-xs text-muted-foreground font-body">{label}</p>
        <p className="text-2xl font-heading font-semibold text-foreground">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

const TAB_CLASSES = (active) =>
  `px-4 py-2 text-sm font-body font-medium rounded-lg transition-all ${
    active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-muted"
  }`;

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-lg text-xs font-body">
      <p className="font-medium text-foreground mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>{p.name}: <span className="font-semibold">{p.value}</span></p>
      ))}
    </div>
  );
};

// ── tabs ───────────────────────────────────────────────────────────────────────

function OverviewTab({ trendData, categoryData, pieData }) {
  return (
    <div className="space-y-6">
      {/* Search volume over time */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-sm font-heading font-semibold text-foreground mb-4">Search Volume — Last 30 Days</h3>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={trendData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="gradSearches" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(230,70%,55%)" stopOpacity={0.25} />
                <stop offset="95%" stopColor="hsl(230,70%,55%)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradNoResults" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(0,65%,55%)" stopOpacity={0.2} />
                <stop offset="95%" stopColor="hsl(0,65%,55%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={d => d.slice(5)} />
            <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Area type="monotone" dataKey="searches" name="Total" stroke="hsl(230,70%,55%)" fill="url(#gradSearches)" strokeWidth={2} dot={false} />
            <Area type="monotone" dataKey="noResults" name="No Results" stroke="hsl(0,65%,55%)" fill="url(#gradNoResults)" strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Category breakdown */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-heading font-semibold text-foreground mb-4">Traffic by Category</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={categoryData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                {categoryData.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
              </Pie>
              <Tooltip formatter={(v, n) => [v, n]} contentStyle={{ fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Results vs No Results */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-heading font-semibold text-foreground mb-4">Results Coverage</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                <Cell fill="hsl(230,70%,55%)" />
                <Cell fill="hsl(0,65%,55%)" />
              </Pie>
              <Tooltip formatter={(v, n) => [v, n]} contentStyle={{ fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function TrendsTab({ trendData }) {
  const responseData = trendData.map(d => ({
    ...d,
    avgMs: parseFloat(Math.max(1.2, 2.1 + (d.searches / 10) * 0.15).toFixed(2)),
    rate: d.searches ? Math.round((d.withResults / d.searches) * 100) : 0,
  }));

  return (
    <div className="space-y-6">
      {/* Query Frequency Trend — Line Chart */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-sm font-heading font-semibold text-foreground mb-1">Query Frequency Trend</h3>
        <p className="text-xs text-muted-foreground font-body mb-4">Daily search volume over the last 30 days</p>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={trendData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={d => d.slice(5)} />
            <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="searches" name="Total Searches" stroke="hsl(230,70%,55%)" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
            <Line type="monotone" dataKey="withResults" name="With Results" stroke="hsl(140,55%,45%)" strokeWidth={2} dot={false} strokeDasharray="4 3" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Daily Active Users */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-sm font-heading font-semibold text-foreground mb-1">Daily Active Users (DAU)</h3>
        <p className="text-xs text-muted-foreground font-body mb-4">Unique users performing searches per day</p>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={trendData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="gradDAU" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(260,60%,58%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(260,60%,58%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={d => d.slice(5)} />
            <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="dau" name="Active Users" stroke="hsl(260,60%,58%)" fill="url(#gradDAU)" strokeWidth={2.5} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Average Response Time Trend */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-sm font-heading font-semibold text-foreground mb-1">Avg Response Time Trend</h3>
        <p className="text-xs text-muted-foreground font-body mb-4">Estimated response time based on query load</p>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={responseData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={d => d.slice(5)} />
            <YAxis tick={{ fontSize: 10 }} unit="s" domain={[0, "auto"]} />
            <Tooltip content={<CustomTooltip />} />
            <Line type="monotone" dataKey="avgMs" name="Avg Response (s)" stroke="hsl(43,74%,55%)" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function QueriesTab({ trending, categoryData, onExport }) {
  const maxCount = trending[0]?.count || 1;
  return (
    <div className="space-y-6">
      {/* Top Queries Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="text-sm font-heading font-semibold text-foreground">Top Queries</h3>
          <button onClick={onExport} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-3 py-1.5 hover:bg-muted transition-colors">
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm font-body">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-5 py-3 text-xs text-muted-foreground font-medium w-10">#</th>
                <th className="text-left px-5 py-3 text-xs text-muted-foreground font-medium">Query</th>
                <th className="text-left px-5 py-3 text-xs text-muted-foreground font-medium">Category</th>
                <th className="text-right px-5 py-3 text-xs text-muted-foreground font-medium">Searches</th>
                <th className="px-5 py-3 w-40 hidden md:table-cell"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {trending.slice(0, 20).map((item, i) => (
                <tr key={item.query} className="hover:bg-muted/20 transition-colors">
                  <td className="px-5 py-3 text-xs text-muted-foreground">{i + 1}</td>
                  <td className="px-5 py-3 font-medium text-foreground max-w-xs truncate">{item.query}</td>
                  <td className="px-5 py-3">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary/8 text-primary/80 border border-primary/15">
                      {categorizeQuery(item.query)}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right font-semibold text-foreground">{item.count}</td>
                  <td className="px-5 py-3 hidden md:table-cell">
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${(item.count / maxCount) * 100}%` }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Category breakdown bar chart */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-sm font-heading font-semibold text-foreground mb-4">Searches by Category</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={categoryData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="value" name="Searches" radius={[4, 4, 0, 0]}>
              {categoryData.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function GapsTab({ zeroResults, onExport }) {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
        <AlertCircle className="w-4 h-4 text-destructive" />
        <h2 className="font-heading font-semibold text-foreground text-sm flex-1">Content Gaps — Queries Returning 0 Results</h2>
        <button onClick={onExport} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-3 py-1.5 hover:bg-muted transition-colors">
          <Download className="w-3.5 h-3.5" /> Export CSV
        </button>
      </div>
      <div className="divide-y divide-border/50 max-h-[520px] overflow-y-auto">
        {zeroResults.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-16">No content gaps detected 🎉</p>
        ) : (
          zeroResults.map((item, i) => (
            <motion.div
              key={item.query}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.025 }}
              className="flex items-center gap-3 px-5 py-3"
            >
              <span className="text-xs font-mono text-muted-foreground w-6 text-right flex-shrink-0">{i + 1}</span>
              <Search className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
              <span className="flex-1 text-sm font-body text-foreground truncate">{item.query}</span>
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 flex-shrink-0">{item.category}</span>
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-destructive/10 text-destructive flex-shrink-0">
                {item.count} {item.count === 1 ? "search" : "searches"}
              </span>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}

// ── main page ──────────────────────────────────────────────────────────────────

const TABS = ["Overview", "Trends", "Queries", "Content Gaps"];

export default function Analytics() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("Overview");

  const { data: user } = useQuery({ queryKey: ["me"], queryFn: () => base44.auth.me() });
  const { data: history = [], isLoading } = useQuery({
    queryKey: ["searchHistory"],
    queryFn: () => base44.entities.SearchHistory.list("-created_date", 2000),
    enabled: user?.role === "admin",
  });

  const stats = useMemo(() => {
    if (!history.length) return { trending: [], zeroResults: [], total: 0, uniqueQueries: 0, trendData: [], categoryData: [], pieData: [], avgResultRate: 0 };

    const counts = {}, zeroCounts = {}, catCounts = {};
    let withResultsTotal = 0;

    history.forEach(h => {
      const q = h.query?.trim().toLowerCase();
      if (!q) return;
      const cat = categorizeQuery(q);
      catCounts[cat] = (catCounts[cat] || 0) + 1;
      if (h.results_count > 0) {
        counts[q] = (counts[q] || 0) + 1;
        withResultsTotal++;
      } else {
        zeroCounts[q] = (zeroCounts[q] || 0) + 1;
      }
    });

    const trending = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 20).map(([query, count]) => ({ query, count }));
    const zeroResults = Object.entries(zeroCounts).sort((a, b) => b[1] - a[1]).slice(0, 30).map(([query, count]) => ({ query, count, category: categorizeQuery(query) }));
    const categoryData = Object.entries(catCounts).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));
    const trendData = groupByDay(history);
    const pieData = [
      { name: "Had Results", value: withResultsTotal },
      { name: "No Results", value: history.length - withResultsTotal },
    ];
    const avgResultRate = history.length ? Math.round((withResultsTotal / history.length) * 100) : 0;
    const uniqueQueries = Object.keys({ ...counts, ...zeroCounts }).length;
    // Simulated avg response time: base 2.1s, varies by day volume (busier = slightly slower)
    const avgResponseTime = trendData.length
      ? (trendData.reduce((acc, d) => acc + Math.max(1.2, 2.1 + (d.searches / 10) * 0.15), 0) / trendData.length).toFixed(1)
      : "2.1";
    const peakDau = trendData.length ? Math.max(...trendData.map(d => d.dau)) : 0;

    return { trending, zeroResults, total: history.length, uniqueQueries, trendData, categoryData, pieData, avgResultRate, avgResponseTime, peakDau };
  }, [history]);

  const handleExportAll = () => exportCSV(
    history.map(h => ({ query: h.query, results_count: h.results_count, date: h.created_date?.slice(0, 10), category: categorizeQuery(h.query || "") })),
    "search-analytics.csv"
  );
  const handleExportGaps = () => exportCSV(stats.zeroResults, "content-gaps.csv");
  const handleExportQueries = () => exportCSV(stats.trending, "trending-queries.csv");

  if (!user) return null;

  if (user.role !== "admin") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-10 h-10 text-destructive mx-auto mb-3" />
          <h2 className="text-lg font-heading font-semibold">Access Denied</h2>
          <p className="text-sm text-muted-foreground mt-1">This page is for admins only.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <div className="max-w-5xl mx-auto px-4 py-8 md:py-12">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 mb-8">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/")} className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h1 className="text-2xl md:text-3xl font-heading font-semibold text-foreground">Search Analytics</h1>
              <p className="text-sm text-muted-foreground font-body mt-0.5">Deep insights from user search behavior</p>
            </div>
          </div>
          <button
            onClick={handleExportAll}
            className="flex items-center gap-2 text-sm font-body font-medium px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Download className="w-4 h-4" /> Export All
          </button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-24">
            <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Stat cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
              <StatCard icon={BarChart2} label="Total Searches" value={stats.total.toLocaleString()} />
              <StatCard icon={Hash} label="Unique Queries" value={stats.uniqueQueries.toLocaleString()} color="text-accent" />
              <StatCard icon={Users} label="Peak DAU" value={stats.peakDau} color="text-violet-600" sub="daily active users" />
              <StatCard icon={Clock} label="Avg Response" value={`${stats.avgResponseTime}s`} color="text-amber-600" sub="estimated" />
              <StatCard icon={MousePointerClick} label="Result Rate" value={`${stats.avgResultRate}%`} color="text-emerald-600" sub="searches with results" />
              <StatCard icon={AlertCircle} label="Content Gaps" value={stats.zeroResults.length} color="text-destructive" sub="zero-result queries" />
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mb-6 bg-muted/40 p-1 rounded-xl w-fit">
              {TABS.map(t => (
                <button key={t} onClick={() => setTab(t)} className={TAB_CLASSES(tab === t)}>{t}</button>
              ))}
            </div>

            {/* Tab content */}
            <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
              {tab === "Overview"     && <OverviewTab trendData={stats.trendData} categoryData={stats.categoryData} pieData={stats.pieData} />}
              {tab === "Trends"       && <TrendsTab trendData={stats.trendData} />}
              {tab === "Queries"      && <QueriesTab trending={stats.trending} categoryData={stats.categoryData} onExport={handleExportQueries} />}
              {tab === "Content Gaps" && <GapsTab zeroResults={stats.zeroResults} onExport={handleExportGaps} />}
            </motion.div>
          </>
        )}
      </div>
    </div>
  );
}