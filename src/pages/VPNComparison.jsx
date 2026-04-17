import React, { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Sparkles, Shield, Check, X, ExternalLink, Star, ChevronDown, ChevronUp, AlertCircle } from "lucide-react";
import AccountMenu from "@/components/account/AccountMenu";

const VPNs = [
  {
    name: "NordVPN",
    tagline: "Most feature-rich with Cyber Insurance",
    logo: "🛡️",
    rating: 4.8,
    price: { monthly: 12.99, annual: 3.99 },
    highlight: true,
    badge: "Best Overall",
    badgeColor: "bg-blue-600",
    affiliateUrl: "https://nordvpn.com",
    color: "from-blue-600 to-blue-800",
    borderColor: "border-blue-500",
    features: {
      "No-log policy": true,
      "Kill switch": true,
      "Split tunneling": true,
      "Double VPN": true,
      "Tor over VPN": true,
      "Ad & malware blocker": true,
      "Dedicated IP": true,
      "Mesh network (Meshnet)": true,
      "Cyber Insurance": true,
      "Servers": "6,400+ in 111 countries",
      "Simultaneous devices": "10",
      "Protocols": "NordLynx, OpenVPN, IKEv2",
    },
    pros: [
      "Fastest speeds via NordLynx (WireGuard)",
      "Unique Cyber Insurance add-on (~$20/mo)",
      "Obfuscated servers bypass censorship",
      "Audited no-logs policy",
      "Meshnet for private device networking",
    ],
    cons: [
      "Slightly pricier than competitors",
      "Desktop UI can feel cluttered",
    ],
    cyberInsurance: {
      price: 19.99,
      covered: [
        "Up to $5,000 reimbursement for cyber extortion / ransomware payments",
        "Identity theft financial recovery support",
        "Online fraud & phishing loss coverage",
        "24/7 cyber incident response team",
        "Credit monitoring & dark web alerts",
        "Legal consultation for cyber incidents",
      ],
      note: "Add-on to any NordVPN plan. Underwritten by a licensed insurer. Coverage limits and terms apply — review policy details on NordVPN's site.",
    },
  },
  {
    name: "Mullvad",
    tagline: "Maximum anonymity, no account needed",
    logo: "🦊",
    rating: 4.6,
    price: { monthly: 5.00, annual: 5.00 },
    highlight: false,
    badge: "Best Privacy",
    badgeColor: "bg-amber-600",
    affiliateUrl: "https://mullvad.net",
    color: "from-amber-500 to-amber-700",
    borderColor: "border-amber-500",
    features: {
      "No-log policy": true,
      "Kill switch": true,
      "Split tunneling": true,
      "Double VPN": false,
      "Tor over VPN": false,
      "Ad & malware blocker": true,
      "Dedicated IP": false,
      "Mesh network (Meshnet)": false,
      "Cyber Insurance": false,
      "Servers": "700+ in 49 countries",
      "Simultaneous devices": "5",
      "Protocols": "WireGuard, OpenVPN",
    },
    pros: [
      "Flat €5/mo — no tricks or upsells",
      "No email required to sign up",
      "Accepts cash and crypto payments",
      "Consistently audited & transparent",
      "Owned no-log RAM-only servers",
    ],
    cons: [
      "Smaller server network",
      "No browser extension",
      "No streaming optimization",
    ],
  },
  {
    name: "ProtonVPN",
    tagline: "Swiss privacy with a free tier",
    logo: "⚛️",
    rating: 4.5,
    price: { monthly: 9.99, annual: 4.99 },
    highlight: false,
    badge: "Best Free Tier",
    badgeColor: "bg-purple-600",
    affiliateUrl: "https://protonvpn.com",
    color: "from-purple-600 to-purple-800",
    borderColor: "border-purple-500",
    features: {
      "No-log policy": true,
      "Kill switch": true,
      "Split tunneling": true,
      "Double VPN": true,
      "Tor over VPN": true,
      "Ad & malware blocker": true,
      "Dedicated IP": false,
      "Mesh network (Meshnet)": false,
      "Cyber Insurance": false,
      "Servers": "9,300+ in 112 countries",
      "Simultaneous devices": "10",
      "Protocols": "WireGuard, OpenVPN, IKEv2",
    },
    pros: [
      "Generous free tier (limited speeds)",
      "Swiss jurisdiction — strict privacy laws",
      "Open source and independently audited",
      "Stealth protocol bypasses deep packet inspection",
      "Integrates with Proton Mail & Drive",
    ],
    cons: [
      "Free tier is slower",
      "Pricing higher than Mullvad",
    ],
  },
  {
    name: "IVPN",
    tagline: "Minimal, ethical, transparent",
    logo: "🔒",
    rating: 4.4,
    price: { monthly: 6.00, annual: 5.00 },
    highlight: false,
    badge: "Most Ethical",
    badgeColor: "bg-green-600",
    affiliateUrl: "https://www.ivpn.net",
    color: "from-green-600 to-green-800",
    borderColor: "border-green-500",
    features: {
      "No-log policy": true,
      "Kill switch": true,
      "Split tunneling": true,
      "Double VPN": true,
      "Tor over VPN": false,
      "Ad & malware blocker": true,
      "Dedicated IP": false,
      "Mesh network (Meshnet)": false,
      "Cyber Insurance": false,
      "Servers": "90+ in 36 countries",
      "Simultaneous devices": "2 (Standard) / 7 (Pro)",
      "Protocols": "WireGuard, OpenVPN",
    },
    pros: [
      "No account required — just an ID",
      "AntiTracker blocks ads & trackers",
      "Multi-hop (double VPN) on all plans",
      "Accepts cash & crypto",
      "Openly critical of VPN marketing hype",
    ],
    cons: [
      "Small server network",
      "No streaming-optimised servers",
    ],
  },
];

const ALL_FEATURE_KEYS = [
  "No-log policy","Kill switch","Split tunneling","Double VPN",
  "Tor over VPN","Ad & malware blocker","Dedicated IP","Mesh network (Meshnet)",
  "Cyber Insurance","Servers","Simultaneous devices","Protocols",
];

function StarRating({ rating }) {
  return (
    <div className="flex items-center gap-1">
      {[1,2,3,4,5].map(i => (
        <Star key={i} className={`w-3.5 h-3.5 ${i <= Math.round(rating) ? "text-amber-400 fill-amber-400" : "text-muted-foreground"}`} />
      ))}
      <span className="text-xs text-muted-foreground ml-1">{rating}</span>
    </div>
  );
}

function FeatureVal({ val }) {
  if (val === true)  return <Check className="w-4 h-4 text-green-500 mx-auto" />;
  if (val === false) return <X className="w-4 h-4 text-muted-foreground/40 mx-auto" />;
  return <span className="text-xs text-muted-foreground text-center block">{val}</span>;
}

export default function VPNComparison() {
  const [expanded, setExpanded] = useState(null);
  const [billingCycle, setBillingCycle] = useState("annual");

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-1.5 group">
            <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center group-hover:shadow-md transition-shadow">
              <Sparkles className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-heading font-semibold text-foreground text-lg">Explore</span>
          </Link>
          <AccountMenu />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-10 md:py-14">
        {/* Hero */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-body font-medium mb-4">
            <Shield className="w-4 h-4" />
            Privacy Tools
          </div>
          <h1 className="text-3xl md:text-5xl font-heading font-bold mb-3">VPN Comparison</h1>
          <p className="text-muted-foreground font-body text-base md:text-lg max-w-xl mx-auto">
            Independent comparison of the best privacy-first VPNs. No paid placements — ranked on features, transparency, and value.
          </p>

          {/* Billing toggle */}
          <div className="inline-flex items-center bg-muted rounded-full p-1 mt-6">
            <button
              onClick={() => setBillingCycle("monthly")}
              className={`px-4 py-1.5 rounded-full text-sm font-body transition-all ${billingCycle === "monthly" ? "bg-card shadow text-foreground font-medium" : "text-muted-foreground"}`}
            >Monthly</button>
            <button
              onClick={() => setBillingCycle("annual")}
              className={`px-4 py-1.5 rounded-full text-sm font-body transition-all ${billingCycle === "annual" ? "bg-card shadow text-foreground font-medium" : "text-muted-foreground"}`}
            >
              Annual <span className="text-green-500 font-medium">Save up to 70%</span>
            </button>
          </div>
        </div>

        {/* VPN Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-12">
          {VPNs.map((vpn, idx) => (
            <motion.div
              key={vpn.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.08 }}
              className={`relative rounded-2xl border-2 bg-card overflow-hidden ${vpn.highlight ? vpn.borderColor : "border-border"}`}
            >
              {vpn.highlight && (
                <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${vpn.color}`} />
              )}

              <div className="p-6">
                {/* Top row */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{vpn.logo}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="font-heading font-bold text-xl">{vpn.name}</h2>
                        <span className={`text-xs px-2 py-0.5 rounded-full text-white font-body font-medium ${vpn.badgeColor}`}>{vpn.badge}</span>
                      </div>
                      <p className="text-sm text-muted-foreground font-body">{vpn.tagline}</p>
                    </div>
                  </div>
                  <StarRating rating={vpn.rating} />
                </div>

                {/* Price */}
                <div className="mb-4">
                  <span className="text-3xl font-heading font-bold">${billingCycle === "annual" ? vpn.price.annual : vpn.price.monthly}</span>
                  <span className="text-muted-foreground font-body text-sm">/mo</span>
                  {billingCycle === "annual" && <span className="ml-2 text-xs text-muted-foreground font-body">billed annually</span>}
                </div>

                {/* Pros */}
                <ul className="space-y-1.5 mb-5">
                  {vpn.pros.map(p => (
                    <li key={p} className="flex items-start gap-2 text-sm font-body">
                      <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                      <span>{p}</span>
                    </li>
                  ))}
                  {vpn.cons.map(c => (
                    <li key={c} className="flex items-start gap-2 text-sm font-body text-muted-foreground">
                      <X className="w-4 h-4 text-muted-foreground/50 flex-shrink-0 mt-0.5" />
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>

                {/* Cyber Insurance callout for NordVPN */}
                {vpn.cyberInsurance && (
                  <div className="mb-5 rounded-xl border border-blue-500/30 bg-blue-500/5 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Shield className="w-4 h-4 text-blue-500" />
                      <span className="font-heading font-semibold text-sm text-blue-500">Cyber Insurance Add-on</span>
                      <span className="ml-auto text-sm font-bold font-heading">${vpn.cyberInsurance.price}<span className="text-xs font-body font-normal text-muted-foreground">/mo</span></span>
                    </div>
                    <ul className="space-y-1 mb-3">
                      {vpn.cyberInsurance.covered.map(item => (
                        <li key={item} className="flex items-start gap-1.5 text-xs font-body text-muted-foreground">
                          <Check className="w-3.5 h-3.5 text-blue-400 flex-shrink-0 mt-0.5" />
                          {item}
                        </li>
                      ))}
                    </ul>
                    <div className="flex items-start gap-1.5 text-xs text-muted-foreground font-body bg-muted/60 rounded-lg p-2">
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-amber-500" />
                      {vpn.cyberInsurance.note}
                    </div>
                  </div>
                )}

                {/* CTA */}
                <a
                  href={vpn.affiliateUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-body font-semibold text-sm transition-all
                    ${vpn.highlight
                      ? "bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20"
                      : "bg-muted hover:bg-muted/80 text-foreground border border-border"
                    }`}
                >
                  Visit {vpn.name}
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Full Feature Comparison Table */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden mb-12">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="font-heading font-bold text-lg">Full Feature Comparison</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-4 py-3 font-heading font-semibold text-muted-foreground w-48">Feature</th>
                  {VPNs.map(v => (
                    <th key={v.name} className="px-4 py-3 font-heading font-semibold text-center">
                      <span className={v.highlight ? "text-blue-500" : ""}>{v.name}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ALL_FEATURE_KEYS.map((key, i) => (
                  <tr key={key} className={`border-b border-border/50 ${i % 2 === 0 ? "" : "bg-muted/20"}`}>
                    <td className="px-4 py-3 font-body text-muted-foreground">{key}</td>
                    {VPNs.map(v => (
                      <td key={v.name} className="px-4 py-3 text-center">
                        <FeatureVal val={v.features[key]} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="flex items-start gap-3 rounded-xl bg-muted/50 border border-border p-4 text-sm font-body text-muted-foreground">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-500" />
          <p>
            Links to VPN providers may be affiliate links — we may earn a commission at no cost to you. Prices shown are approximate and may vary. Always review the provider's current pricing and terms before purchasing. Cyber Insurance details are based on NordVPN's published offering as of early 2026 — verify coverage at nordvpn.com.
          </p>
        </div>
      </main>
    </div>
  );
}