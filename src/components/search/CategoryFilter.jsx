import React from "react";
import { motion } from "framer-motion";
import {
  Globe, Newspaper, Cpu, FlaskConical, Tv, ShoppingBag,
  BookOpen, Briefcase, Heart, Trophy, Music2, Gamepad2
} from "lucide-react";

export const CATEGORIES = [
  { id: "all", label: "All", icon: Globe },
  { id: "News", label: "News", icon: Newspaper },
  { id: "Tech", label: "Tech", icon: Cpu },
  { id: "Science", label: "Science", icon: FlaskConical },
  { id: "Entertainment", label: "Entertainment", icon: Tv },
  { id: "Business", label: "Business", icon: Briefcase },
  { id: "Education", label: "Education", icon: BookOpen },
  { id: "Health", label: "Health", icon: Heart },
  { id: "Sports", label: "Sports", icon: Trophy },
  { id: "Music", label: "Music", icon: Music2 },
  { id: "Gaming", label: "Gaming", icon: Gamepad2 },
  { id: "Shopping", label: "Shopping", icon: ShoppingBag },
];

export const CATEGORY_COLORS = {
  News:          "bg-blue-500/10 text-blue-600 border-blue-200",
  Tech:          "bg-violet-500/10 text-violet-600 border-violet-200",
  Science:       "bg-cyan-500/10 text-cyan-600 border-cyan-200",
  Entertainment: "bg-pink-500/10 text-pink-600 border-pink-200",
  Business:      "bg-amber-500/10 text-amber-700 border-amber-200",
  Education:     "bg-emerald-500/10 text-emerald-600 border-emerald-200",
  Health:        "bg-rose-500/10 text-rose-600 border-rose-200",
  Sports:        "bg-orange-500/10 text-orange-600 border-orange-200",
  Music:         "bg-fuchsia-500/10 text-fuchsia-600 border-fuchsia-200",
  Gaming:        "bg-indigo-500/10 text-indigo-600 border-indigo-200",
  Shopping:      "bg-teal-500/10 text-teal-600 border-teal-200",
  Other:         "bg-muted text-muted-foreground border-border",
};

export default function CategoryFilter({ selected, onChange, categoryCounts }) {
  const available = CATEGORIES.filter(c => c.id === "all" || (categoryCounts?.[c.id] > 0));

  if (available.length <= 1) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex gap-2 overflow-x-auto pb-1 mb-5 scrollbar-none"
      style={{ scrollbarWidth: "none" }}
    >
      {available.map((cat) => {
        const Icon = cat.icon;
        const isActive = selected === cat.id;
        const count = cat.id === "all" ? Object.values(categoryCounts || {}).reduce((a, b) => a + b, 0) : categoryCounts?.[cat.id];

        return (
          <motion.button
            key={cat.id}
            whileTap={{ scale: 0.95 }}
            onClick={() => onChange(cat.id)}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-body font-medium
              whitespace-nowrap transition-all border flex-shrink-0
              ${isActive
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "bg-background text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
              }
            `}
          >
            <Icon className="w-3.5 h-3.5" />
            {cat.label}
            {count > 0 && (
              <span className={`text-xs ml-0.5 ${isActive ? "opacity-70" : "opacity-50"}`}>
                {count}
              </span>
            )}
          </motion.button>
        );
      })}
    </motion.div>
  );
}