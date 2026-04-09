import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const MAX_DEPTH = 3;
const MAX_LINKS_PER_PAGE = 15;

// Seed URLs spanning diverse domains
const SEED_URLS = [
  "https://en.wikipedia.org/wiki/Main_Page",
  "https://www.bbc.com",
  "https://techcrunch.com",
  "https://www.reddit.com/r/technology",
  "https://news.ycombinator.com",
  "https://www.nytimes.com",
  "https://www.theguardian.com",
  "https://stackoverflow.com",
  "https://github.com/explore",
  "https://www.wired.com",
  "https://arstechnica.com",
  "https://www.scientificamerican.com",
  "https://www.nature.com",
  "https://www.nationalgeographic.com",
  "https://css-tricks.com",
  "https://smashingmagazine.com",
  "https://developer.mozilla.org",
  "https://www.cnn.com",
  "https://www.forbes.com",
  "https://medium.com",
];

function extractDomain(url) {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return null;
  }
}

function normalizeUrl(url, base) {
  try {
    const u = new URL(url, base);
    // Only http/https
    if (!["http:", "https:"].includes(u.protocol)) return null;
    // Remove fragments
    u.hash = "";
    const normalized = u.toString();
    // Skip common non-content extensions
    if (/\.(jpg|jpeg|png|gif|svg|ico|pdf|zip|mp4|mp3|css|js|woff|woff2|ttf)(\?|$)/i.test(normalized)) return null;
    return normalized;
  } catch {
    return null;
  }
}

function computeQualityScore({ wordCount, title, description, inboundLinks }) {
  let score = 0;
  // Word count (0-0.3)
  score += Math.min(wordCount / 2000, 1) * 0.3;
  // Has title (0-0.2)
  if (title && title.length > 5) score += 0.2;
  // Has description (0-0.2)
  if (description && description.length > 20) score += 0.2;
  // Inbound links bonus (0-0.3)
  score += Math.min(inboundLinks / 50, 1) * 0.3;
  return Math.min(score, 1);
}

function computePageRank(inboundLinks, domainAuthority) {
  // Simplified PageRank: base + inbound link boost + domain authority
  const base = 1.0;
  const linkBoost = Math.log1p(inboundLinks) * 0.5;
  return base + linkBoost + (domainAuthority || 0);
}

// Known high-authority domains get bonus
const HIGH_AUTHORITY_DOMAINS = new Set([
  "wikipedia.org", "bbc.com", "nytimes.com", "theguardian.com",
  "nature.com", "scientificamerican.com", "stackoverflow.com",
  "github.com", "developer.mozilla.org", "reuters.com", "apnews.com"
]);

function getDomainAuthority(domain) {
  for (const d of HIGH_AUTHORITY_DOMAINS) {
    if (domain && domain.includes(d)) return 2.0;
  }
  return 0;
}

async function fetchPageContent(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  
  const response = await fetch(url, {
    signal: controller.signal,
    headers: {
      "User-Agent": "ExploreBot/1.0 (web search indexer)",
      "Accept": "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9",
    },
    redirect: "follow",
  });
  clearTimeout(timeout);

  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) throw new Error("Not HTML content");

  return await response.text();
}

function parseHtml(html, baseUrl) {
  // Extract title
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim().substring(0, 200) : "";

  // Extract meta description
  const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
  const description = descMatch ? descMatch[1].trim().substring(0, 500) : "";

  // Extract body text
  let bodyText = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const wordCount = bodyText.split(/\s+/).filter(Boolean).length;
  const contentSnippet = bodyText.substring(0, 500);

  // Extract keywords from content
  const words = bodyText.toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 3);
  
  const freq = {};
  words.forEach(w => { freq[w] = (freq[w] || 0) + 1; });
  const stopWords = new Set(["that","this","with","from","they","have","been","will","your","what","when","more","also","into","than","some","were","then","which","their","there","would","about","could","other","these","those"]);
  const keywords = Object.entries(freq)
    .filter(([w]) => !stopWords.has(w))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([w]) => w);

  // Extract links
  const linkRegex = /href=["']([^"'#?][^"']*?)["']/gi;
  const links = [];
  let match;
  while ((match = linkRegex.exec(html)) !== null && links.length < MAX_LINKS_PER_PAGE) {
    const normalized = normalizeUrl(match[1], baseUrl);
    if (normalized) links.push(normalized);
  }

  // Detect language (simple heuristic)
  const language = html.match(/lang=["']([a-z]{2})/i)?.[1] || "en";

  return { title, description, contentSnippet, keywords, wordCount, links, language };
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();

  if (!user || user.role !== "admin") {
    return Response.json({ error: "Admin access required" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { action, url: targetUrl, seedMode } = body;

  // ---- SEED ACTION ----
  if (action === "seed") {
    const seeded = [];
    for (const seedUrl of SEED_URLS) {
      const domain = extractDomain(seedUrl);
      if (!domain) continue;
      const existing = await base44.asServiceRole.entities.CrawlQueue.filter({ url: seedUrl });
      if (existing.length === 0) {
        await base44.asServiceRole.entities.CrawlQueue.create({
          url: seedUrl, domain, depth: 0, priority: 10, status: "pending", attempts: 0
        });
        seeded.push(seedUrl);
      }
    }
    return Response.json({ seeded: seeded.length, total: SEED_URLS.length });
  }

  // ---- CRAWL BATCH ACTION ----
  if (action === "crawl_batch") {
    const batchSize = body.batchSize || 5;

    // Pick pending items sorted by priority desc
    const queue = await base44.asServiceRole.entities.CrawlQueue.filter(
      { status: "pending" }, "-priority", batchSize
    );

    if (queue.length === 0) {
      return Response.json({ message: "Queue empty", crawled: 0 });
    }

    const results = [];

    for (const item of queue) {
      // Mark as processing
      await base44.asServiceRole.entities.CrawlQueue.update(item.id, { status: "processing" });

      let success = false;
      try {
        // Check if already indexed
        const existing = await base44.asServiceRole.entities.IndexedPage.filter({ url: item.url });
        if (existing.length > 0) {
          await base44.asServiceRole.entities.CrawlQueue.update(item.id, { status: "done" });
          results.push({ url: item.url, status: "duplicate" });
          continue;
        }

        const html = await fetchPageContent(item.url);
        const parsed = parseHtml(html, item.url);

        // Count existing inbound links to this URL
        const inboundPages = await base44.asServiceRole.entities.IndexedPage.filter({ url: item.url });
        const inboundLinks = item.source_url ? 1 : 0; // simplified

        const domainAuthority = getDomainAuthority(item.domain);
        const pageRank = computePageRank(inboundLinks, domainAuthority);
        const qualityScore = computeQualityScore({
          wordCount: parsed.wordCount,
          title: parsed.title,
          description: parsed.description,
          inboundLinks
        });
        const finalScore = (pageRank * 0.6) + (qualityScore * 10 * 0.4);

        // Save indexed page
        await base44.asServiceRole.entities.IndexedPage.create({
          url: item.url,
          domain: item.domain,
          title: parsed.title,
          description: parsed.description,
          content_snippet: parsed.contentSnippet,
          keywords: parsed.keywords,
          inbound_links: inboundLinks,
          outbound_links: parsed.links.length,
          page_rank: pageRank,
          quality_score: qualityScore,
          final_score: finalScore,
          language: parsed.language,
          word_count: parsed.wordCount,
          crawl_depth: item.depth,
          last_crawled: new Date().toISOString(),
          status: "active"
        });

        // Enqueue discovered links (if depth allows)
        if (item.depth < MAX_DEPTH) {
          for (const link of parsed.links.slice(0, 10)) {
            const linkDomain = extractDomain(link);
            if (!linkDomain) continue;
            const alreadyQueued = await base44.asServiceRole.entities.CrawlQueue.filter({ url: link });
            if (alreadyQueued.length === 0) {
              const priority = HIGH_AUTHORITY_DOMAINS.has(linkDomain) ? 8 : 4;
              await base44.asServiceRole.entities.CrawlQueue.create({
                url: link,
                domain: linkDomain,
                depth: item.depth + 1,
                priority,
                source_url: item.url,
                status: "pending",
                attempts: 0
              });
            }
          }
        }

        await base44.asServiceRole.entities.CrawlQueue.update(item.id, { status: "done" });
        success = true;
        results.push({ url: item.url, status: "indexed", links: parsed.links.length });
      } catch (err) {
        await base44.asServiceRole.entities.CrawlQueue.update(item.id, {
          status: "failed",
          attempts: (item.attempts || 0) + 1
        });
        results.push({ url: item.url, status: "error", error: err.message });
      }
    }

    return Response.json({ crawled: results.length, results });
  }

  // ---- RERANK ACTION ----
  if (action === "rerank") {
    const pages = await base44.asServiceRole.entities.IndexedPage.list("-inbound_links", 100);
    for (const page of pages) {
      const domainAuthority = getDomainAuthority(page.domain);
      const pageRank = computePageRank(page.inbound_links || 0, domainAuthority);
      const qualityScore = computeQualityScore({
        wordCount: page.word_count || 0,
        title: page.title,
        description: page.description,
        inboundLinks: page.inbound_links || 0
      });
      const finalScore = (pageRank * 0.6) + (qualityScore * 10 * 0.4);
      await base44.asServiceRole.entities.IndexedPage.update(page.id, {
        page_rank: pageRank,
        quality_score: qualityScore,
        final_score: finalScore
      });
    }
    return Response.json({ reranked: pages.length });
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
});