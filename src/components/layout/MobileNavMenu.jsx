import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Bookmark, Shield, Settings, BarChart2, Menu, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import AccountMenu from "@/components/account/AccountMenu";

const NAV_LINKS = [
  { to: "/saved", label: "Saved", icon: Bookmark },
  { to: "/vpn", label: "VPN", icon: Shield },
  { to: "/analytics", label: "Analytics", icon: BarChart2 },
  { to: "/crawler", label: "Crawler", icon: Settings },
];

/** Compact nav controls for pages that have a custom header (e.g. SearchResults) */
export default function MobileNavMenu() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="relative flex-shrink-0 flex items-center gap-1">
      {/* Desktop: icon links */}
      <div className="hidden md:flex items-center gap-1">
        {NAV_LINKS.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            title={label}
            className={`p-2 rounded-lg transition-colors ${
              location.pathname === to
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <Icon className="w-4 h-4" />
          </Link>
        ))}
      </div>

      <AccountMenu />

      {/* Mobile: hamburger */}
      <button
        className="md:hidden p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
        onClick={() => setMenuOpen(v => !v)}
        aria-label="Toggle menu"
      >
        {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Mobile dropdown */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="absolute right-0 top-10 z-50 bg-popover border border-border rounded-xl shadow-xl min-w-44 py-1 overflow-hidden"
          >
            {NAV_LINKS.map(({ to, label, icon: Icon }) => {
              const active = location.pathname === to;
              return (
                <Link
                  key={to}
                  to={to}
                  onClick={() => setMenuOpen(false)}
                  className={`flex items-center gap-2 px-4 py-2.5 text-sm font-body transition-colors ${
                    active ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </Link>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}