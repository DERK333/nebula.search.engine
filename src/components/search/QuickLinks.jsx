import React from "react";
import { motion } from "framer-motion";
import { TrendingUp, Newspaper, Code, Palette, Music, BookOpen, Gamepad2, Utensils } from "lucide-react";

const quickLinks = [
  { label: "Trending", query: "trending news today", icon: TrendingUp },
  { label: "Tech", query: "latest technology news", icon: Code },
  { label: "Science", query: "scientific discoveries 2026", icon: BookOpen },
  { label: "Design", query: "best web design trends", icon: Palette },
  { label: "News", query: "world news today", icon: Newspaper },
  { label: "Music", query: "new music releases", icon: Music },
  { label: "Gaming", query: "top video games 2026", icon: Gamepad2 },
  { label: "Food", query: "best recipes easy dinner", icon: Utensils },
];

export default function QuickLinks({ onSelect }) {
  return (
    <div className="flex flex-wrap justify-center gap-2 md:gap-3 mt-6 md:mt-8">
      {quickLinks.map((link, i) => {
        const Icon = link.icon;
        return (
          <motion.button
            key={link.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 + i * 0.05 }}
            onClick={() => onSelect(link.query)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-secondary/80 hover:bg-secondary text-secondary-foreground text-xs md:text-sm font-body font-medium transition-all hover:shadow-sm"
          >
            <Icon className="w-3.5 h-3.5" />
            {link.label}
          </motion.button>
        );
      })}
    </div>
  );
}