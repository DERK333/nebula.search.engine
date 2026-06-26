import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import { KeyRound, Trash2, Eye, EyeOff, Plus, Globe, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useBeforeUnloadWarning, usePersistedDraft } from "@/hooks/use-persisted-draft";
import NavBar from "../components/layout/NavBar";

const INITIAL_FORM = { site_name: "", url: "", username: "", password_encrypted: "", notes: "" };

function PasswordEntry({ entry, onDelete }) {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyPassword = () => {
    navigator.clipboard.writeText(entry.password_encrypted);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex items-center gap-3 p-4 bg-card border border-border rounded-xl group hover:border-primary/30 transition-all"
    >
      <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
        <Globe className="w-4 h-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium font-heading text-sm truncate">{entry.site_name}</p>
        <p className="text-xs text-muted-foreground font-body truncate">{entry.username}</p>
        <p className="text-xs text-muted-foreground/60 font-body font-mono mt-0.5">
          {visible ? entry.password_encrypted : "••••••••••••"}
        </p>
      </div>
      <div className="flex items-center gap-1">
        <button onClick={() => setVisible(!visible)}
          className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
          {visible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        </button>
        <button onClick={copyPassword}
          className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
          <Copy className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => onDelete(entry.id)}
          className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      {copied && (
        <span className="absolute text-xs bg-foreground text-background px-2 py-1 rounded-md ml-2 font-body">Copied!</span>
      )}
    </motion.div>
  );
}

export default function Passwords() {
  const { user, isAuthenticated, navigateToLogin } = useAuth();
  const queryClient = useQueryClient();
  const { value: form, setValue: setForm, clearDraft, hasDraft } = usePersistedDraft(
    "passwords-form-draft",
    INITIAL_FORM
  );
  const [showAdd, setShowAdd] = useState(hasDraft);
  const [showPw, setShowPw] = useState(false);

  const { data: passwords = [], isLoading } = useQuery({
    queryKey: ["passwords"],
    queryFn: () => base44.entities.SavedPassword.filter({ created_by: user?.email }, "-created_date"),
    enabled: !!user,
  });

  const addMutation = useMutation({
    mutationFn: (data) => base44.entities.SavedPassword.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["passwords"] });
      setShowAdd(false);
      clearDraft();
      setShowPw(false);
    },
  });

  useBeforeUnloadWarning(showAdd && hasDraft && !addMutation.isPending);

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.SavedPassword.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["passwords"] }),
  });

  const handleAdd = (e) => {
    e.preventDefault();
    if (!form.site_name || !form.username || !form.password_encrypted) return;
    addMutation.mutate(form);
  };

  const handleDelete = (id) => {
    if (window.confirm("Delete this saved password permanently?")) {
      deleteMutation.mutate(id);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <KeyRound className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
          <h2 className="text-lg font-heading font-semibold mb-2">Sign in to manage passwords</h2>
          <p className="text-sm text-muted-foreground font-body mb-4">Securely save and access your passwords.</p>
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
          <h1 className="text-2xl font-heading font-bold">Saved Passwords</h1>
          <Button onClick={() => setShowAdd(!showAdd)} size="sm" className="rounded-full gap-1.5">
            <Plus className="w-4 h-4" />
            Add password
          </Button>
        </div>

        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs font-body rounded-xl px-4 py-3 mb-6 flex items-start gap-2">
          <KeyRound className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>Passwords are stored as entered. For sensitive accounts, consider using a dedicated password manager.</span>
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
              <Input placeholder="Site name (e.g. GitHub)" value={form.site_name}
                onChange={(e) => setForm({ ...form, site_name: e.target.value })} />
              <Input placeholder="URL (optional)" value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })} />
              <Input placeholder="Username / Email" value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })} />
              <div className="relative">
                <Input placeholder="Password" type={showPw ? "text" : "password"} value={form.password_encrypted}
                  onChange={(e) => setForm({ ...form, password_encrypted: e.target.value })} className="pr-10" />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <Input placeholder="Notes (optional)" value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })} />
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

        {!isLoading && passwords.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <KeyRound className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-body text-sm">No saved passwords yet.</p>
          </div>
        )}

        <div className="space-y-2 relative">
          <AnimatePresence>
            {passwords.map((p) => (
              <PasswordEntry key={p.id} entry={p} onDelete={handleDelete} />
            ))}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}