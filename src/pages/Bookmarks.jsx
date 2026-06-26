import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import { Bookmark, Trash2, ExternalLink, Globe, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useBeforeUnloadWarning, usePersistedDraft } from "@/hooks/use-persisted-draft";
import NavBar from "../components/layout/NavBar";

const INITIAL_FORM = { title: "", url: "", description: "" };

export default function Bookmarks() {
  const { user, isAuthenticated, navigateToLogin } = useAuth();
  const queryClient = useQueryClient();
  const { value: form, setValue: setForm, clearDraft, hasDraft } = usePersistedDraft(
    "bookmarks-form-draft",
    INITIAL_FORM
  );
  const [showAdd, setShowAdd] = useState(hasDraft);

  const { data: bookmarks = [], isLoading } = useQuery({
    queryKey: ["bookmarks"],
    queryFn: () => base44.entities.Bookmark.filter({ created_by: user?.email }, "-created_date"),
    enabled: !!user,
  });

  const addMutation = useMutation({
    mutationFn: (data) => base44.entities.Bookmark.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
      setShowAdd(false);
      clearDraft();
    },
  });

  useBeforeUnloadWarning(showAdd && hasDraft && !addMutation.isPending);

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Bookmark.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["bookmarks"] }),
  });

  const getDomain = (url) => {
    try { return new URL(url).hostname.replace("www.", ""); } catch { return url; }
  };

  const getFavicon = (url) => {
    try { return `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=32`; } catch { return null; }
  };

  const handleAdd = (e) => {
    e.preventDefault();
    if (!form.url || !form.title) return;
    const favicon = getFavicon(form.url);
    addMutation.mutate({ ...form, favicon });
  };

  const handleDelete = (id) => {
    if (window.confirm("Delete this bookmark permanently?")) {
      deleteMutation.mutate(id);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Bookmark className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
          <h2 className="text-lg font-heading font-semibold mb-2">Sign in to see your bookmarks</h2>
          <p className="text-sm text-muted-foreground font-body mb-4">Save and access your favorite pages from anywhere.</p>
          <Button onClick={navigateToLogin} className="rounded-full">Sign in</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <NavBar />

      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-heading font-bold">Bookmarks</h1>
          <Button onClick={() => setShowAdd(!showAdd)} size="sm" className="rounded-full gap-1.5">
            <Plus className="w-4 h-4" />
            Add bookmark
          </Button>
        </div>

        <AnimatePresence>
          {showAdd && (
            <motion.form
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              onSubmit={handleAdd}
              className="bg-card border border-border rounded-xl p-4 mb-6 space-y-3"
            >
              <Input
                placeholder="Title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
              <Input
                placeholder="URL (https://...)"
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
              />
              <Input
                placeholder="Note (optional)"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowAdd(false)}>Cancel</Button>
                <Button type="submit" size="sm" disabled={addMutation.isPending}>Save</Button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>

        {isLoading && (
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-16 bg-muted/50 rounded-xl animate-pulse" />)}
          </div>
        )}

        {!isLoading && bookmarks.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <Bookmark className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-body text-sm">No bookmarks yet. Add your first one!</p>
          </div>
        )}

        <div className="space-y-2">
          <AnimatePresence>
            {bookmarks.map((b, i) => (
              <motion.div
                key={b.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ delay: i * 0.03 }}
                className="flex items-center gap-3 p-4 bg-card border border-border rounded-xl group hover:border-primary/30 transition-all"
              >
                {b.favicon ? (
                  <img src={b.favicon} alt="" className="w-5 h-5 rounded-sm flex-shrink-0"
                    onError={(e) => { e.target.style.display = "none"; }} />
                ) : (
                  <Globe className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <a href={b.url} target="_blank" rel="noopener noreferrer"
                    className="font-medium font-heading text-sm text-primary hover:underline truncate block">
                    {b.title}
                  </a>
                  <p className="text-xs text-muted-foreground font-body truncate">{getDomain(b.url)}</p>
                  {b.description && <p className="text-xs text-muted-foreground/70 font-body mt-0.5 truncate">{b.description}</p>}
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <a href={b.url} target="_blank" rel="noopener noreferrer"
                    className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <button onClick={() => handleDelete(b.id)}
                    className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}