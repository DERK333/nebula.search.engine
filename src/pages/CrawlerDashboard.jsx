import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import NavBar from "../components/layout/NavBar";
import { motion, AnimatePresence } from "framer-motion";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";
import {
  Globe, Play, Square, RefreshCw, Database, Zap,
  TrendingUp, Layers, Settings,
  WifiOff, ListChecks, Star
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

function StatCard({ label, value, icon: IconComponent, color, sub }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 md:p-5">
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-body text-muted-foreground uppercase tracking-wider">{label}</p>
        <div className={`p-2 rounded-lg ${color}`}>
          <IconComponent className="w-4 h-4" />
        </div>
      </div>
      <p className="text-2xl md:text-3xl font-heading font-bold text-foreground">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1 font-body">{sub}</p>}
    </div>
  );
}

export default function CrawlerDashboard() {
  const [isCrawling, setIsCrawling] = useState(false);
  const [crawlInterval, setCrawlInterval] = useState(null);
  const [log, setLog] = useState([]);
  const [isSeeding, setIsSeeding] = useState(false);
  const qc = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const { data: indexedPages } = useQuery({
    queryKey: ["indexedPages"],
    queryFn: () => base44.entities.IndexedPage.list("-final_score", 2000),
    initialData: [],
    refetchInterval: 5000
  });

  const { data: queueItems } = useQuery({
    queryKey: ["crawlQueue"],
    queryFn: () => base44.entities.CrawlQueue.filter({ status: "pending" }, "-priority", 2000),
    initialData: [],
    refetchInterval: 5000
  });

  const { data: totalIndexed } = useQuery({
    queryKey: ["totalIndexed"],
    queryFn: () => base44.entities.IndexedPage.filter({ status: "active" }, "-final_score", 2000),
    initialData: [],
    refetchInterval: 5000
  });

  const { data: failedItems } = useQuery({
    queryKey: ["failedItems"],
    queryFn: () => base44.entities.CrawlQueue.filter({ status: "failed" }, "-updated_date", 2000),
    initialData: [],
    refetchInterval: 10000
  });

  const addLog = (msg, type = "info") => {
    setLog(prev => [{ msg, type, time: new Date().toLocaleTimeString() }, ...prev].slice(0, 50));
  };

  const handleSeed = async () => {
    setIsSeeding(true);
    addLog("Seeding initial URLs from diverse sources...", "info");
    try {
      const res = await base44.functions.invoke("crawlPage", { action: "seed" });
      addLog(`Seeded ${res.data.seeded} URLs into queue`, "success");
      qc.invalidateQueries();
    } catch (error) {
      addLog(`Failed to seed crawl queue: ${error.message || "Unknown error"}`, "error");
    } finally {
      setIsSeeding(false);
    }
  };

  const runCrawlBatch = async () => {
    addLog("Crawling batch of 5 pages...", "info");
    try {
      const res = await base44.functions.invoke("crawlPage", { action: "crawl_batch", batchSize: 5 });
      const { crawled, results } = res.data;
      const indexed = results?.filter(r => r.status === "indexed").length || 0;
      const errors = results?.filter(r => r.status === "error").length || 0;
      addLog(`Batch done: ${indexed} indexed, ${errors} errors, ${crawled - indexed - errors} duplicates`, indexed > 0 ? "success" : "warn");
      qc.invalidateQueries();
    } catch (error) {
      addLog(`Crawl batch failed: ${error.message || "Unknown error"}`, "error");
    }
  };

  const startCrawling = () => {
    setIsCrawling(true);
    addLog("Crawler started — running continuous batches", "success");
    const interval = setInterval(runCrawlBatch, 8000);
    setCrawlInterval(interval);
    runCrawlBatch();
  };

  const stopCrawling = () => {
    setIsCrawling(false);
    if (crawlInterval) clearInterval(crawlInterval);
    setCrawlInterval(null);
    addLog("Crawler stopped", "warn");
  };

  const handleRerank = async () => {
    addLog("Re-ranking all indexed pages...", "info");
    try {
      const res = await base44.functions.invoke("crawlPage", { action: "rerank" });
      addLog(`Re-ranked ${res.data.reranked} pages`, "success");
      qc.invalidateQueries();
    } catch (error) {
      addLog(`Re-rank failed: ${error.message || "Unknown error"}`, "error");
    }
  };

  useEffect(() => {
    return () => { if (crawlInterval) clearInterval(crawlInterval); };
  }, [crawlInterval]);

  // Get counts from queries (length of 1-item queries tells us if records exist)
  const indexedCount = totalIndexed?.length || indexedPages?.length || 0;
  const queueCount = queueItems?.length || 0;

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <NavBar />
        <main className="max-w-2xl mx-auto px-4 py-16 text-center">
          <Settings className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
          <h1 className="text-2xl font-heading font-semibold mb-2">Crawler tools are admin-only</h1>
          <p className="text-sm text-muted-foreground font-body mb-6">
            You can still use the rest of the app, but crawling and re-ranking require admin access.
          </p>
          <Link to="/" className="text-sm text-primary hover:underline font-body">
            Return home
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <NavBar />

      <div className="max-w-6xl mx-auto px-4 py-6 md:py-8 space-y-6 md:space-y-8">

        {/* Controls */}
        <div className="flex flex-wrap gap-3">
          <Button
            onClick={handleSeed}
            disabled={isSeeding || isCrawling}
            variant="outline"
            className="gap-2"
          >
            <Globe className="w-4 h-4" />
            {isSeeding ? "Seeding..." : "Seed URLs"}
          </Button>

          {!isCrawling ? (
            <Button onClick={startCrawling} className="gap-2 bg-green-600 hover:bg-green-700 text-white">
              <Play className="w-4 h-4" />
              Start Crawler
            </Button>
          ) : (
            <Button onClick={stopCrawling} variant="destructive" className="gap-2">
              <Square className="w-4 h-4" />
              Stop Crawler
            </Button>
          )}

          <Button onClick={handleRerank} disabled={isCrawling} variant="outline" className="gap-2">
            <TrendingUp className="w-4 h-4" />
            Re-rank Pages
          </Button>

          <Button onClick={() => qc.invalidateQueries()} variant="ghost" size="icon">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          <StatCard
            label="Indexed Pages"
            value={indexedCount}
            icon={Database}
            color="bg-primary/10 text-primary"
            sub="Active in index"
          />
          <StatCard
            label="Queue Size"
            value={queueCount}
            icon={Layers}
            color="bg-accent/10 text-accent"
            sub="URLs pending"
          />
          <StatCard
            label="Failed Items"
            value={failedItems?.length || 0}
            icon={WifiOff}
            color="bg-rose-100 text-rose-700"
            sub="Queue entries needing attention"
          />
          <StatCard
            label="Top Score"
            value={indexedPages?.[0]?.final_score?.toFixed(2) || "—"}
            icon={Star}
            color="bg-yellow-500/10 text-yellow-600"
            sub="Highest ranked page"
          />
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Activity Log */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
              <ListChecks className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-sm font-heading font-semibold text-foreground">Crawler Log</h2>
            </div>
            <div className="h-72 overflow-y-auto p-4 space-y-2 font-mono text-xs bg-muted/20">
              {log.length === 0 && (
                <p className="text-muted-foreground/50 text-center mt-8">No activity yet. Seed URLs then start the crawler.</p>
              )}
              <AnimatePresence>
                {log.map((entry, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`flex gap-2 ${
                      entry.type === "success" ? "text-green-600" :
                      entry.type === "warn" ? "text-yellow-600" :
                      entry.type === "error" ? "text-red-500" :
                      "text-muted-foreground"
                    }`}
                  >
                    <span className="opacity-50 flex-shrink-0">{entry.time}</span>
                    <span>{entry.msg}</span>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>

          {/* Top Indexed Pages */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-sm font-heading font-semibold text-foreground">Top Ranked Pages</h2>
            </div>
            <div className="h-72 overflow-y-auto divide-y divide-border/50">
              {indexedPages?.length === 0 && (
                <p className="text-muted-foreground/50 text-center mt-8 text-sm font-body">No pages indexed yet.</p>
              )}
              {indexedPages?.map((page, i) => (
                <div key={page.id} className="px-4 py-3 hover:bg-muted/30 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-body font-medium text-foreground truncate">
                        {page.title || page.url}
                      </p>
                      <p className="text-xs text-muted-foreground truncate font-body">{page.domain}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <Badge variant="secondary" className="text-xs font-mono">
                        {page.final_score?.toFixed(2)}
                      </Badge>
                      <span className="text-xs text-muted-foreground/60">#{i + 1}</span>
                    </div>
                  </div>
                  <div className="mt-1.5">
                    <Progress value={(page.quality_score || 0) * 100} className="h-1" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 md:p-5">
          <h3 className="text-sm font-heading font-semibold text-foreground mb-2 flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" /> How it works
          </h3>
          <ol className="text-sm font-body text-muted-foreground space-y-1 list-decimal list-inside">
            <li><strong className="text-foreground">Seed URLs</strong> — loads 20 high-quality seed domains into the crawl queue</li>
            <li><strong className="text-foreground">Start Crawler</strong> — processes batches every 8 seconds, discovering new pages from outbound links</li>
            <li><strong className="text-foreground">Indexing</strong> — extracts title, description, keywords, word count per page</li>
            <li><strong className="text-foreground">Ranking</strong> — scores by PageRank (inbound links), quality (content richness), and domain authority</li>
            <li><strong className="text-foreground">Search</strong> — queries the live index first, falls back to AI-powered search if index is thin</li>
          </ol>
        </div>
      </div>
    </div>
  );
}