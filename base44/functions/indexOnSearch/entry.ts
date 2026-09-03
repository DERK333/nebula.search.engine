import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const MAX_METADATA = 40;
const MAX_DEEP_FETCH = 8;
const MAX_LINKS_PER_PAGE = 20;
const SEARCH_UA = "ExploreBot/2.0 (+https://github.com; federated open-web search indexer)";

function extractDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function normalizeUrl(url, base) {
  try {
    const parsed = new URL(url, base);
    if (!["http:", "https:"].includes(parsed.protocol)) return null;
    parsed.hash = "";
    const normalized = parsed.toString();
    if (/\.(jpg|jpeg|png|gif|svg|ico|pdf|zip|mp4|mp3|css|js|woff|woff2|ttf)(\?|$)/i.test(normalized)) return null;
    return normalized;
  } catch {
    return null;
  }
}

function computeQualityScore({ wordCount, title, description }) {
  let score = 0.35;
  score += Math.min((wordCount || 0) / 1500, 1) * 0.3;
  if (title && title.length > 10 && title.length < 120) score += 0.15;
  if (description && description.length > 60) score += 0.15;
  return Math.min(score, 1);
}

async function fetchPageContent(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  const response = await fetch(url, {
    signal: controller.signal,
    headers: {
      "User-Agent": SEARCH_UA,
      Accept: "text/html,application/xhtml+xml",
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

function removeHtmlBlocks(html, tagName) {
  const openNeedle = `<${tagName}`;
  const closeNeedle = `</${tagName}`;
  let output = String(html);
  for (let guard = 0; guard < 64; guard += 1) {
    const lower = output.toLowerCase();
    const start = lower.indexOf(openNeedle);
    if (start === -1) break;
    const afterOpen = output.indexOf(">", start);
    if (afterOpen === -1) {
      output = output.slice(0, start);
      break;
    }
    const end = lower.indexOf(closeNeedle, afterOpen + 1);
    if (end === -1) {
      output = output.slice(0, start);
      break;
    }
    const afterClose = output.indexOf(">", end);
    if (afterClose === -1) {
      output = output.slice(0, start);
      break;
    }
    output = `${output.slice(0, start)} ${output.slice(afterClose + 1)}`;
  }
  return output;
}

function htmlToPlainText(html) {
  let text = removeHtmlBlocks(html, "script");
  text = removeHtmlBlocks(text, "style");
  let stripped = "";
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === "<") {
      const close = text.indexOf(">", i);
      if (close === -1) break;
      stripped += " ";
      i = close;
      continue;
    }
    stripped += ch;
  }
  return stripped.replace(/\s+/g, " ").trim();
}

function parseHtml(html, baseUrl) {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim().substring(0, 200) : "";
  const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
  const description = descMatch ? descMatch[1].trim().substring(0, 500) : "";

  const bodyText = htmlToPlainText(html);

  const wordCount = bodyText.split(/\s+/).filter(Boolean).length;
  const contentSnippet = bodyText.substring(0, 500);
  const words = bodyText.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((word) => word.length > 3);
  const freq = {};
  words.forEach((word) => { freq[word] = (freq[word] || 0) + 1; });
  const stopWords = new Set(["that", "this", "with", "from", "they", "have", "been", "will", "your", "what", "when", "more", "also", "into", "than", "some", "were"]);
  const keywords = Object.entries(freq)
    .filter(([word]) => !stopWords.has(word))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([word]) => word);

  const linkRegex = /href=["']([^"'#?][^"']*?)["']/gi;
  const links = [];
  let match;
  while ((match = linkRegex.exec(html)) !== null && links.length < MAX_LINKS_PER_PAGE) {
    const normalized = normalizeUrl(match[1], baseUrl);
    if (normalized) links.push(normalized);
  }

  const language = html.match(/lang=["']([a-z]{2})/i)?.[1] || "en";
  return { title, description, contentSnippet, keywords, wordCount, links, language };
}

async function upsertPage(base44, record) {
  const existing = await base44.asServiceRole.entities.IndexedPage.filter({ url: record.url });
  if (existing.length > 0) {
    await base44.asServiceRole.entities.IndexedPage.update(existing[0].id, record);
    return "updated";
  }
  await base44.asServiceRole.entities.IndexedPage.create(record);
  return "created";
}

async function enqueueUrl(base44, url, sourceUrl) {
  const domain = extractDomain(url);
  if (!domain) return false;
  const alreadyQueued = await base44.asServiceRole.entities.CrawlQueue.filter({ url });
  if (alreadyQueued.length > 0) return false;
  await base44.asServiceRole.entities.CrawlQueue.create({
    url,
    domain,
    depth: 1,
    priority: 7,
    source_url: sourceUrl,
    status: "pending",
    attempts: 0,
  });
  return true;
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json().catch(() => ({}));
  const query = (body.query || "").trim();
  const incoming = Array.isArray(body.results) ? body.results : [];

  if (!incoming.length) {
    return Response.json({ indexed: 0, queued: 0, deep_fetched: 0, query });
  }

  const unique = [];
  const seen = new Set();
  for (const item of incoming) {
    if (!item?.url || seen.has(item.url) || unique.length >= MAX_METADATA) continue;
    const domain = extractDomain(item.url);
    if (!domain) continue;
    seen.add(item.url);
    unique.push({ ...item, domain });
  }

  let indexed = 0;
  let queued = 0;
  let deepFetched = 0;
  const errors = [];

  for (const item of unique) {
    try {
      const qualityScore = computeQualityScore({
        wordCount: 0,
        title: item.title,
        description: item.description,
      });
      await upsertPage(base44, {
        url: item.url,
        domain: item.domain,
        title: item.title || item.url,
        description: item.description || "",
        content_snippet: item.description || "",
        keywords: query ? query.toLowerCase().split(/\s+/).filter((token) => token.length > 1) : [],
        inbound_links: 1,
        outbound_links: 0,
        page_rank: 1,
        quality_score: item.quality_score || qualityScore,
        final_score: (item.quality_score || qualityScore) * 10,
        language: "en",
        word_count: 0,
        crawl_depth: 0,
        last_crawled: new Date().toISOString(),
        status: "active",
      });
      indexed += 1;
      if (await enqueueUrl(base44, item.url, "search:" + query)) queued += 1;
    } catch (error) {
      errors.push({ url: item.url, error: error.message });
    }
  }

  for (const item of unique.slice(0, MAX_DEEP_FETCH)) {
    try {
      const html = await fetchPageContent(item.url);
      const parsed = parseHtml(html, item.url);
      const qualityScore = computeQualityScore({
        wordCount: parsed.wordCount,
        title: parsed.title || item.title,
        description: parsed.description || item.description,
      });
      await upsertPage(base44, {
        url: item.url,
        domain: item.domain,
        title: parsed.title || item.title || item.url,
        description: parsed.description || item.description || "",
        content_snippet: parsed.contentSnippet,
        keywords: parsed.keywords,
        inbound_links: 1,
        outbound_links: parsed.links.length,
        page_rank: 1 + Math.log1p(parsed.links.length) * 0.2,
        quality_score: qualityScore,
        final_score: qualityScore * 10,
        language: parsed.language,
        word_count: parsed.wordCount,
        crawl_depth: 0,
        last_crawled: new Date().toISOString(),
        status: "active",
      });
      deepFetched += 1;
      for (const link of parsed.links.slice(0, 12)) {
        if (await enqueueUrl(base44, link, item.url)) queued += 1;
      }
    } catch (error) {
      errors.push({ url: item.url, error: error.message });
    }
  }

  return Response.json({
    indexed,
    queued,
    deep_fetched: deepFetched,
    query,
    errors: errors.slice(0, 8),
  });
});
