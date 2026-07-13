import base44 from "@base44/vite-plugin"
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

function decodeHtmlEntities(text = "") {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripTags(text = "") {
  return decodeHtmlEntities(text.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

function getDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function matchesDomain(hostname, expectedDomain) {
  const host = (hostname || "").toLowerCase();
  const expected = (expectedDomain || "").toLowerCase();
  return host === expected || host.endsWith(`.${expected}`);
}

function inferContentType({ url, title, description }) {
  const haystack = `${url} ${title} ${description}`.toLowerCase();
  if (/wikipedia\.org/.test(url)) return "wiki";
  if (/(docs|documentation|reference|manual|learn|guide)/.test(haystack)) return "documentation";
  if (/(tutorial|how to|how-to|step by step|walkthrough)/.test(haystack)) return "technical_guide";
  if (/(news|breaking|report|latest|today|article)/.test(haystack)) return "news";
  if (/(buy|price|shop|store|cart|amazon|shopping)/.test(haystack)) return "commercial";
  if (/(research|paper|study|journal|arxiv|pubmed)/.test(haystack)) return "research";
  if (/(blog|post|medium\.com|substack\.com)/.test(haystack)) return "blog";
  if (/(privacy policy|terms of service|cookie policy)/.test(haystack)) return "legal_boilerplate";
  return "general";
}

function inferQualityScore({ url, title, description }) {
  let score = 0.45;
  const domain = getDomain(url);
  const authorityDomains = [
    "wikipedia.org", "developer.mozilla.org", "docs.python.org", "docs.github.com",
    "arxiv.org", "pubmed.ncbi.nlm.nih.gov", "reuters.com", "apnews.com",
    "bbc.com", "nature.com", "science.org", "stackoverflow.com", "github.com",
  ];
  if (authorityDomains.some((d) => matchesDomain(domain, d))) score += 0.25;
  if ((title || "").length > 15 && (title || "").length < 120) score += 0.1;
  if ((description || "").length > 60) score += 0.1;
  if (/^https:\/\//i.test(url)) score += 0.05;
  return Math.min(score, 0.95);
}

function parseDuckDuckGoResults(html, limit = 30) {
  const results = [];
  const anchorRegex = /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  const anchors = [...html.matchAll(anchorRegex)];

  for (let i = 0; i < anchors.length && results.length < limit; i += 1) {
    const match = anchors[i];
    const next = anchors[i + 1];
    const blockStart = match.index ?? 0;
    const blockEnd = next?.index ?? html.length;
    const block = html.slice(blockStart, blockEnd);
    const snippetMatch = block.match(/<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/);
    const rawUrl = match[1].replace(/&amp;/g, "&");
    const urlMatch = rawUrl.match(/[?&]uddg=([^&]+)/i);
    const urlCandidate = urlMatch ? urlMatch[1] : rawUrl.replace(/^\/\//, "https://");
    let url = urlCandidate;
    try {
      url = decodeURIComponent(urlCandidate);
    } catch {
      url = urlCandidate;
    }
    const title = stripTags(match[2]);
    const description = snippetMatch ? stripTags(snippetMatch[1]) : "";

    if (!url || !/^https?:\/\//i.test(url)) continue;
    results.push({
      title,
      url,
      description,
      domain: getDomain(url),
      content_type: inferContentType({ url, title, description }),
      quality_score: inferQualityScore({ url, title, description }),
      score: Math.max(1, 100 - i),
    });
  }

  return results;
}

function realWebSearchPlugin() {
  const registerSearchMiddleware = (server) => {
    server.middlewares.use(async (req, res, next) => {
      if (!req.url?.startsWith("/api/search")) return next();

      try {
        const requestUrl = new URL(req.url, "http://localhost");
        const query = requestUrl.searchParams.get("q")?.trim();
        const limit = Math.min(Number(requestUrl.searchParams.get("limit") || 30), 50);

        if (!query) {
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ results: [], total: 0, returned: 0, source: "web" }));
          return;
        }

        const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const response = await fetch(searchUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml",
          },
          signal: controller.signal,
        }).finally(() => clearTimeout(timeout));

        if (!response.ok) throw new Error(`Search failed with HTTP ${response.status}`);
        const html = await response.text();
        const results = parseDuckDuckGoResults(html, limit);

        res.statusCode = 200;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({
          results,
          total: results.length,
          returned: results.length,
          source: "web",
        }));
      } catch (error) {
        next(error);
      }
    });
  };

  return {
    name: "real-web-search",
    configureServer(server) {
      registerSearchMiddleware(server);
    },
    configurePreviewServer(server) {
      registerSearchMiddleware(server);
    }
  };
}

// https://vite.dev/config/
export default defineConfig({
  logLevel: 'error', // Suppress warnings, only show errors
  plugins: [
    realWebSearchPlugin(),
    base44({
      // Support for legacy code that imports the base44 SDK with @/integrations, @/entities, etc.
      // can be removed if the code has been updated to use the new SDK imports from @base44/sdk
      legacySDKImports: process.env.BASE44_LEGACY_SDK_IMPORTS === 'true',
      hmrNotifier: true,
      navigationNotifier: true,
      analyticsTracker: true,
      visualEditAgent: true
    }),
    react(),
  ]
});