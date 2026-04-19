import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Sparkles, Bookmark, Shield, Settings, BarChart2, Menu, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import AccountMenu from "@/components/account/AccountMenu";

const NAV_LINKS = [
  { to: "/saved", label: "Saved", icon: Bookmark },
  { to: "/vpn", label: "VPN", icon: Shield },
  { to: "/analytics", label: "Analytics", icon: BarChart2 },
  { to: "/crawler", label: "Crawler", icon: Settings },
];

export default function NavBar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  return (
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border">
      <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-1.5 flex-shrink-0 group">
          <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center group-hover:shadow-md transition-shadow">
            <Sparkles className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-heading font-semibold text-foreground text-lg hidden sm:block">Explore</span>
        </Link>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Desktop nav links */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map(({ to, label, icon: Icon }) => {
            const active = location.pathname === to;
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-body transition-colors ${
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            );
          })}
        </nav>

        <AccountMenu />

        {/* Hamburger — mobile only */}
        <button
          className="md:hidden p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
          onClick={() => setMenuOpen(v => !v)}
          aria-label="Toggle menu"
        >
          {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile dropdown */}
      <AnimatePresence>
        {menuOpen && (
          <motion.nav
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-t border-border overflow-hidden bg-background"
          >
            <div className="max-w-4xl mx-auto px-4 py-2 flex flex-col gap-1">
              {NAV_LINKS.map(({ to, label, icon: Icon }) => {
                const active = location.pathname === to;
                return (
                  <Link
                    key={to}
                    to={to}
                    onClick={() => setMenuOpen(false)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-body transition-colors ${
                      active
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </Link>
                );
              })}
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}