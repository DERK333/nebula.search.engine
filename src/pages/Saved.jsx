import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, Bookmark, Trash2, ExternalLink, Globe,
  Plus, FolderOpen, Folder, Search, MoreHorizontal,
  Edit2, Check, X, FolderPlus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import AccountMenu from "@/components/account/AccountMenu";

const DEFAULT_COLLECTION = "General";

function CollectionIcon({ name, isSelected }) {
  return isSelected
    ? <FolderOpen className="w-4 h-4" />
    : <Folder className="w-4 h-4" />;
}

function BookmarkCard({ bookmark, onDelete, onMove, collections }) {
  const [showMove, setShowMove] = useState(false);
  const getDomain = (url) => {
    try { return new URL(url).hostname.replace("www.", ""); } catch { return url; }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="group flex items-start gap-3 p-4 bg-card border border-border rounded-xl hover:border-primary/30 hover:shadow-sm transition-all relative"
    >
      {bookmark.favicon ? (
        <img src={bookmark.favicon} alt="" className="w-5 h-5 rounded-sm flex-shrink-0 mt-0.5"
          onError={(e) => { e.target.style.display = "none"; }} />
      ) : (
        <Globe className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
      )}

      <div className="flex-1 min-w-0">
        <a href={bookmark.url} target="_blank" rel="noopener noreferrer"
          className="font-medium font-heading text-sm text-primary hover:underline truncate block leading-snug">
          {bookmark.title}
        </a>
        <p className="text-xs text-muted-foreground font-body truncate mt-0.5">{getDomain(bookmark.url)}</p>
        {bookmark.description && (
          <p className="text-xs text-muted-foreground/70 font-body mt-1 line-clamp-2">{bookmark.description}</p>
        )}
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        <div className="relative">
          <button
            onClick={() => setShowMove(!showMove)}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
            title="Move to collection"
          >
            <FolderPlus className="w-3.5 h-3.5" />
          </button>
          <AnimatePresence>
            {showMove && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="absolute right-0 top-8 z-50 bg-popover border border-border rounded-xl shadow-xl min-w-40 py-1 overflow-hidden"
              >
                <p className="text-xs text-muted-foreground px-3 py-1.5 font-body border-b border-border">Move to</p>
                {collections.map(col => (
                  <button
                    key={col}
                    onClick={() => { onMove(bookmark.id, col); setShowMove(false); }}
                    className={`w-full text-left px-3 py-2 text-sm font-body hover:bg-muted transition-colors flex items-center gap-2 ${bookmark.collection === col ? "text-primary font-medium" : ""}`}
                  >
                    <Folder className="w-3.5 h-3.5" />
                    {col}
                    {bookmark.collection === col && <Check className="w-3 h-3 ml-auto" />}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <a href={bookmark.url} target="_blank" rel="noopener noreferrer"
          className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
        <button onClick={() => onDelete(bookmark.id)}
          className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </motion.div>
  );
}

export default function Saved() {
  const { user, isAuthenticated, navigateToLogin } = useAuth();
  const queryClient = useQueryClient();

  const [selectedCollection, setSelectedCollection] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [showNewCollectionInput, setShowNewCollectionInput] = useState(false);
  const [form, setForm] = useState({ title: "", url: "", description: "", collection: DEFAULT_COLLECTION });

  const { data: bookmarks = [], isLoading } = useQuery({
    queryKey: ["bookmarks"],
    queryFn: () => base44.entities.Bookmark.filter({ created_by: user?.email }, "-created_date"),
    enabled: !!user,
  });

  const addMutation = useMutation({
    mutationFn: (data) => base44.entities.Bookmark.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
      setShowAddForm(false);
      setForm({ title: "", url: "", description: "", collection: selectedCollection === "All" ? DEFAULT_COLLECTION : selectedCollection });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Bookmark.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["bookmarks"] }),
  });

  const moveMutation = useMutation({
    mutationFn: ({ id, collection }) => base44.entities.Bookmark.update(id, { collection }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["bookmarks"] }),
  });

  const getFavicon = (url) => {
    try { return `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=32`; } catch { return null; }
  };

  // All unique collections
  const collections = useMemo(() => {
    const cols = [...new Set(bookmarks.map(b => b.collection || DEFAULT_COLLECTION))];
    return cols.sort();
  }, [bookmarks]);

  // Filtered bookmarks
  const filtered = useMemo(() => {
    return bookmarks.filter(b => {
      const inCollection = selectedCollection === "All" || (b.collection || DEFAULT_COLLECTION) === selectedCollection;
      const matchesSearch = !searchQuery || b.title.toLowerCase().includes(searchQuery.toLowerCase())
        || b.url.toLowerCase().includes(searchQuery.toLowerCase())
        || (b.description || "").toLowerCase().includes(searchQuery.toLowerCase());
      return inCollection && matchesSearch;
    });
  }, [bookmarks, selectedCollection, searchQuery]);

  const collectionCounts = useMemo(() => {
    const counts = {};
    bookmarks.forEach(b => {
      const col = b.collection || DEFAULT_COLLECTION;
      counts[col] = (counts[col] || 0) + 1;
    });
    return counts;
  }, [bookmarks]);

  const handleAdd = (e) => {
    e.preventDefault();
    if (!form.url || !form.title) return;
    addMutation.mutate({ ...form, favicon: getFavicon(form.url), collection: form.collection || DEFAULT_COLLECTION });
  };

  const handleAddCollection = () => {
    if (!newCollectionName.trim()) return;
    setSelectedCollection(newCollectionName.trim());
    setForm(f => ({ ...f, collection: newCollectionName.trim() }));
    setNewCollectionName("");
    setShowNewCollectionInput(false);
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Bookmark className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
          <h2 className="text-lg font-heading font-semibold mb-2">Sign in to see your saved items</h2>
          <p className="text-sm text-muted-foreground font-body mb-4">Save search results into collections, accessible from anywhere.</p>
          <Button onClick={navigateToLogin} className="rounded-full">Sign in</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-heading font-semibold text-foreground text-lg">Explore</span>
          </Link>
          <AccountMenu />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 flex gap-6">
        {/* Sidebar — Collections */}
        <aside className="w-56 flex-shrink-0 hidden md:block">
          <div className="sticky top-24">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-body font-semibold text-muted-foreground uppercase tracking-wider">Collections</h2>
              <button
                onClick={() => setShowNewCollectionInput(!showNewCollectionInput)}
                className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                title="New collection"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            <AnimatePresence>
              {showNewCollectionInput && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-2 overflow-hidden"
                >
                  <div className="flex gap-1.5">
                    <Input
                      value={newCollectionName}
                      onChange={(e) => setNewCollectionName(e.target.value)}
                      placeholder="Collection name"
                      className="h-7 text-xs rounded-lg"
                      onKeyDown={(e) => e.key === "Enter" && handleAddCollection()}
                      autoFocus
                    />
                    <button onClick={handleAddCollection} className="p-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
                      <Check className="w-3 h-3" />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <nav className="space-y-0.5">
              {["All", ...collections].map(col => (
                <button
                  key={col}
                  onClick={() => setSelectedCollection(col)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-body transition-colors text-left ${
                    selectedCollection === col
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <CollectionIcon name={col} isSelected={selectedCollection === col} />
                  <span className="flex-1 truncate">{col}</span>
                  <span className="text-xs opacity-60">
                    {col === "All" ? bookmarks.length : (collectionCounts[col] || 0)}
                  </span>
                </button>
              ))}
            </nav>
          </div>
        </aside>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h1 className="text-xl font-heading font-bold">{selectedCollection}</h1>
              <p className="text-xs text-muted-foreground font-body mt-0.5">{filtered.length} saved item{filtered.length !== 1 ? "s" : ""}</p>
            </div>
            <Button onClick={() => setShowAddForm(!showAddForm)} size="sm" className="rounded-full gap-1.5">
              <Plus className="w-4 h-4" />
              Save URL
            </Button>
          </div>

          {/* Search within saved */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search saved items..."
              className="pl-9 rounded-xl"
            />
          </div>

          {/* Mobile collection selector */}
          <div className="flex gap-2 overflow-x-auto pb-2 mb-4 md:hidden">
            {["All", ...collections].map(col => (
              <button
                key={col}
                onClick={() => setSelectedCollection(col)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-body transition-colors ${
                  selectedCollection === col
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/70"
                }`}
              >
                {col} {col === "All" ? bookmarks.length : (collectionCounts[col] || 0)}
              </button>
            ))}
          </div>

          {/* Add form */}
          <AnimatePresence>
            {showAddForm && (
              <motion.form
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                onSubmit={handleAdd}
                className="bg-card border border-border rounded-xl p-4 mb-4 space-y-3"
              >
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-sm font-heading font-semibold">Save a URL</h3>
                  <button type="button" onClick={() => setShowAddForm(false)} className="text-muted-foreground hover:text-foreground">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <Input placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                <Input placeholder="URL (https://...)" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
                <Input placeholder="Note (optional)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                <div className="flex gap-2 items-center">
                  <select
                    value={form.collection}
                    onChange={(e) => setForm({ ...form, collection: e.target.value })}
                    className="flex-1 h-9 rounded-lg border border-input bg-background text-sm font-body px-3 focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {[DEFAULT_COLLECTION, ...collections.filter(c => c !== DEFAULT_COLLECTION)].map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <Button type="submit" size="sm" disabled={addMutation.isPending || !form.url || !form.title}>Save</Button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>

          {isLoading && (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="h-16 bg-muted/50 rounded-xl animate-pulse" />)}
            </div>
          )}

          {!isLoading && filtered.length === 0 && (
            <div className="text-center py-20 text-muted-foreground">
              <Bookmark className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-body text-sm">
                {searchQuery ? "No results match your search." : "Nothing saved here yet."}
              </p>
              {!searchQuery && (
                <p className="text-xs mt-1 opacity-70">Save search results by clicking the bookmark icon.</p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <AnimatePresence>
              {filtered.map(b => (
                <BookmarkCard
                  key={b.id}
                  bookmark={b}
                  onDelete={(id) => deleteMutation.mutate(id)}
                  onMove={(id, collection) => moveMutation.mutate({ id, collection })}
                  collections={[DEFAULT_COLLECTION, ...collections.filter(c => c !== DEFAULT_COLLECTION)]}
                />
              ))}
            </AnimatePresence>
          </div>
        </div>
      </main>
    </div>
  );
}