import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";
const SEARCH_UA = "ExploreBot/2.0 (+https://github.com; federated open-web search indexer)";
const MAX_RESULTS = 2000;

function decodeHtmlEntities(text = "") {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripTags(text = "") {
  return decodeHtmlEntities(String(text).replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

function canonicalizeUrl(raw) {
  if (!raw) return "";
  let value = String(raw).trim();
  if (value.startsWith("//")) value = `https:${value}`;
  try {
    const url = new URL(value);
    if (!/^https?:$/i.test(url.protocol)) return "";
    url.hash = "";
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    let href = url.toString();
    if (url.pathname !== "/" && href.endsWith("/")) href = href.slice(0, -1);
    return href;
  } catch {
    return "";
  }
}

function getDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function inferContentType({ url = "", title = "", description = "" }) {
  const haystack = `${url} ${title} ${description}`.toLowerCase();
  if (/wikipedia\.org/.test(url)) return "wiki";
  if (/(arxiv|pubmed|semanticscholar|openalex|crossref|doi\.org)/.test(haystack)) return "research";
  if (/(docs|documentation|mdn)/.test(haystack)) return "documentation";
  if (/(tutorial|how to|guide)/.test(haystack)) return "technical_guide";
  if (/github\.com/.test(url)) return "repository";
  if (/(stackoverflow|news\.ycombinator|reddit)/.test(url)) return "discussion";
  if (/(news|breaking|latest)/.test(haystack)) return "news";
  if (/(blog|medium\.com|substack)/.test(haystack)) return "blog";
  return "general";
}

function makeResult({ title, url, description }, source, rank) {
  const canonical = canonicalizeUrl(url);
  if (!canonical) return null;
  const cleanTitle = stripTags(title || canonical);
  const cleanDesc = stripTags(description || "");
  return {
    title: cleanTitle,
    url: canonical,
    description: cleanDesc,
    domain: getDomain(canonical),
    content_type: inferContentType({ url: canonical, title: cleanTitle, description: cleanDesc }),
    quality_score: 0.55,
    score: Math.max(1, 100 - rank),
    source,
    sources: [source],
  };
}

function parseDuckDuckGoResults(html, limit = 50) {
  const results = [];
  const anchorRegex = /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  const anchors = [...html.matchAll(anchorRegex)];
  for (let i = 0; i < anchors.length && results.length < limit; i += 1) {
    const match = anchors[i];
    const next = anchors[i + 1];
    const block = html.slice(match.index ?? 0, next?.index ?? html.length);
    const snippetMatch = block.match(/<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/);
    const rawUrl = match[1].replace(/&amp;/g, "&");
    const urlMatch = rawUrl.match(/[?&]uddg=([^&]+)/i);
    const urlCandidate = urlMatch ? urlMatch[1] : rawUrl.replace(/^\/\//, "https://");
    let url = urlCandidate;
    try { url = decodeURIComponent(urlCandidate); } catch { url = urlCandidate; }
    const result = makeResult({ title: stripTags(match[2]), url, description: snippetMatch ? stripTags(snippetMatch[1]) : "" }, "duckduckgo", i);
    if (result) results.push(result);
  }
  return results;
}

function parseNextOffset(html) {
  const match = html.match(/name=["']s["'][^>]*value=["'](\d+)["']/i)
    || html.match(/value=["'](\d+)["'][^>]*name=["']s["']/i);
  return match ? Number(match[1]) : null;
}

async function fetchWithTimeout(url, options = {}, timeout = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { ...options, signal: controller.signal, redirect: "follow" });
  } finally {
    clearTimeout(timer);
  }
}

async function searchDuckDuckGoHtml(query, { startOffset = 0, maxPages = 20, maxResults = 600 } = {}) {
  const results = [];
  const seen = new Set();
  let offset = startOffset;
  let nextOffset = null;

  for (let page = 0; page < maxPages && results.length < maxResults; page += 1) {
    let response;
    if (!offset) {
      response = await fetchWithTimeout(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
        headers: { "User-Agent": UA, Accept: "text/html" },
      });
    } else {
      response = await fetchWithTimeout("https://html.duckduckgo.com/html/", {
        method: "POST",
        headers: {
          "User-Agent": UA,
          Accept: "text/html",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: `q=${encodeURIComponent(query)}&s=${offset}&next=y&v=l&o=json&api=d.js&kl=us-en`,
      });
    }
    if (!response.ok) break;
    const html = await response.text();
    const parsed = parseDuckDuckGoResults(html, 50);
    const fresh = parsed.filter((item) => {
      if (seen.has(item.url)) return false;
      seen.add(item.url);
      return true;
    });
    if (!fresh.length) break;
    results.push(...fresh);
    nextOffset = parseNextOffset(html);
    if (nextOffset == null || nextOffset === offset) offset += fresh.length;
    else offset = nextOffset;
  }

  return { results, hasMore: Boolean(nextOffset) && results.length >= 10, cursor: nextOffset };
}

async function searchWikipedia(query, maxResults = 200) {
  const results = [];
  let offset = 0;
  while (results.length < maxResults) {
    const limit = Math.min(50, maxResults - results.length);
    const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=${limit}&sroffset=${offset}&format=json`;
    const response = await fetchWithTimeout(url, { headers: { "User-Agent": SEARCH_UA } });
    if (!response.ok) break;
    const data = await response.json();
    const hits = data?.query?.search || [];
    hits.forEach((hit, index) => {
      const result = makeResult({
        title: hit.title,
        url: `https://en.wikipedia.org/wiki/${encodeURIComponent(hit.title.replace(/ /g, "_"))}`,
        description: stripTags(hit.snippet || ""),
      }, "wikipedia", offset + index);
      if (result) results.push(result);
    });
    offset += hits.length;
    const total = data?.query?.searchinfo?.totalhits || 0;
    if (!hits.length || offset >= total) break;
  }
  return results;
}

async function searchSearx(query) {
  const instances = [
    Deno.env.get("SEARXNG_URL"),
    "https://priv.au",
    "https://searx.be",
    "https://searx.tiekoetter.com",
  ].filter(Boolean);

  for (const origin of instances) {
    try {
      const base = origin.replace(/\/$/, "");
      const response = await fetchWithTimeout(
        `${base}/search?q=${encodeURIComponent(query)}&format=json&pageno=1&categories=general`,
        { headers: { Accept: "application/json", "User-Agent": SEARCH_UA } },
        8000,
      );
      if (!response.ok) continue;
      const data = await response.json();
      const results = (data?.results || []).map((item, index) => makeResult({
        title: item.title,
        url: item.url || item.href,
        description: item.content || "",
      }, "searxng", index)).filter(Boolean);
      if (results.length) return results;
    } catch {
      // try next public instance
    }
  }
  return [];
}

async function searchKeyedEngines(query) {
  const results = [];
  const brave = Deno.env.get("BRAVE_SEARCH_API_KEY");
  const bing = Deno.env.get("BING_SEARCH_API_KEY");
  const google = Deno.env.get("GOOGLE_API_KEY");
  const googleCx = Deno.env.get("GOOGLE_CSE_ID");
  const mojeek = Deno.env.get("MOJEEK_API_KEY");

  const tasks = [];

  if (brave) {
    tasks.push((async () => {
      for (let offset = 0; offset < 200; offset += 20) {
        const response = await fetchWithTimeout(
          `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=20&offset=${offset}`,
          { headers: { Accept: "application/json", "X-Subscription-Token": brave } },
        );
        if (!response.ok) break;
        const data = await response.json();
        const hits = data?.web?.results || [];
        if (!hits.length) break;
        hits.forEach((item, index) => {
          const result = makeResult({ title: item.title, url: item.url, description: item.description || "" }, "brave", offset + index);
          if (result) results.push(result);
        });
        if (hits.length < 20) break;
      }
    })());
  }

  if (bing) {
    tasks.push((async () => {
      for (let offset = 0; offset < 150; offset += 50) {
        const response = await fetchWithTimeout(
          `https://api.bing.microsoft.com/v7.0/search?q=${encodeURIComponent(query)}&count=50&offset=${offset}`,
          { headers: { "Ocp-Apim-Subscription-Key": bing } },
        );
        if (!response.ok) break;
        const data = await response.json();
        const hits = data?.webPages?.value || [];
        if (!hits.length) break;
        hits.forEach((item, index) => {
          const result = makeResult({ title: item.name, url: item.url, description: item.snippet || "" }, "bing", offset + index);
          if (result) results.push(result);
        });
        if (hits.length < 50) break;
      }
    })());
  }

  if (google && googleCx) {
    tasks.push((async () => {
      for (let start = 1; start <= 100; start += 10) {
        const response = await fetchWithTimeout(
          `https://www.googleapis.com/customsearch/v1?key=${encodeURIComponent(google)}&cx=${encodeURIComponent(googleCx)}&q=${encodeURIComponent(query)}&num=10&start=${start}`,
        );
        if (!response.ok) break;
        const data = await response.json();
        const hits = data?.items || [];
        if (!hits.length) break;
        hits.forEach((item, index) => {
          const result = makeResult({ title: item.title, url: item.link, description: item.snippet || "" }, "google", start + index);
          if (result) results.push(result);
        });
        if (hits.length < 10) break;
      }
    })());
  }

  if (mojeek) {
    tasks.push((async () => {
      const response = await fetchWithTimeout(
        `https://api.mojeek.com/search?q=${encodeURIComponent(query)}&api_key=${encodeURIComponent(mojeek)}&fmt=json`,
      );
      if (!response.ok) return;
      const data = await response.json();
      (data?.response?.results || data?.results || []).forEach((item, index) => {
        const result = makeResult({ title: item.title, url: item.url, description: item.desc || item.description || "" }, "mojeek", index);
        if (result) results.push(result);
      });
    })());
  }

  await Promise.allSettled(tasks);
  return results;
}

async function searchBingRss(query) {
  const variants = [`${query}`, `"${query}"`, `${query} documentation`, `${query} tutorial`, `${query} official site`];
  const results = [];
  const seen = new Set();
  for (const variant of variants) {
    try {
      const response = await fetchWithTimeout(
        `https://www.bing.com/search?q=${encodeURIComponent(variant)}&format=rss`,
        { headers: { Accept: "application/rss+xml, application/xml, text/xml", "User-Agent": SEARCH_UA } },
        8000,
      );
      if (!response.ok) continue;
      const xml = await response.text();
      const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)];
      for (const item of items) {
        const title = stripTags(item[1].match(/<title>([\s\S]*?)<\/title>/i)?.[1] || "");
        const url = stripTags(item[1].match(/<link>([\s\S]*?)<\/link>/i)?.[1] || "");
        const description = stripTags(item[1].match(/<description>([\s\S]*?)<\/description>/i)?.[1] || "");
        const result = makeResult({ title, url, description }, "bing", results.length);
        if (result && !seen.has(result.url)) {
          seen.add(result.url);
          results.push(result);
        }
      }
    } catch {
      // optional
    }
  }
  return results;
}
  const seen = new Map();
  for (const { results, source } of lists) {
    results.forEach((item, index) => {
      if (!item?.url || seen.size >= MAX_RESULTS) return;
      const existing = seen.get(item.url);
      if (!existing) {
        seen.set(item.url, { ...item, source, sources: [source], rrf: 1 / (60 + index + 1) });
        return;
      }
      existing.rrf += 1 / (60 + index + 1);
      if (!existing.sources.includes(source)) existing.sources.push(source);
      if ((item.description || "").length > (existing.description || "").length) existing.description = item.description;
    });
  }
  return [...seen.values()].sort((a, b) => (b.rrf || 0) - (a.rrf || 0));
}

function relatedQueries(query) {
  const q = query.trim();
  return [`${q} site:edu`, `${q} site:gov`, `${q} site:org`];
}

Deno.serve(async (req) => {
  createClientFromRequest(req);
  const body = await req.json().catch(() => ({}));
  const query = (body.query || body.q || "").trim();
  const cursor = body.cursor;
  const mode = body.mode || "full";

  if (!query) {
    return Response.json({ results: [], total: 0, returned: 0, source: "webSearch" });
  }

  if (mode === "continue" && cursor != null) {
    const more = await searchDuckDuckGoHtml(query, { startOffset: Number(cursor) || 0, maxPages: 8, maxResults: 240 });
    return Response.json({
      results: more.results,
      total: more.results.length,
      returned: more.results.length,
      hasMore: more.hasMore,
      cursor: more.cursor,
      source: "webSearch",
    });
  }

  const started = Date.now();
  const [ddg, wiki, searx, keyed, bing] = await Promise.all([
    searchDuckDuckGoHtml(query, { maxPages: 20, maxResults: 600 }).catch(() => ({ results: [], hasMore: false, cursor: null })),
    searchWikipedia(query, 200).catch(() => []),
    searchSearx(query).catch(() => []),
    searchKeyedEngines(query).catch(() => []),
    searchBingRss(query).catch(() => []),
  ]);

  const expansionHits = [];
  for (const extra of relatedQueries(query)) {
    if (Date.now() - started > 12000) break;
    try {
      const extraDdg = await searchDuckDuckGoHtml(extra, { maxPages: 2, maxResults: 60 });
      expansionHits.push(...extraDdg.results);
    } catch {
      // optional coverage
    }
  }

  const merged = merge([
    { results: ddg.results, source: "duckduckgo" },
    { results: wiki, source: "wikipedia" },
    { results: searx, source: "searxng" },
    { results: keyed, source: keyed[0]?.source || "web" },
    { results: bing, source: "bing" },
    { results: expansionHits, source: "duckduckgo" },
  ]);

  const sources = {};
  for (const item of merged) {
    for (const source of item.sources || [item.source]) {
      sources[source] = (sources[source] || 0) + 1;
    }
  }

  return Response.json({
    results: merged,
    total: merged.length,
    returned: merged.length,
    hasMore: Boolean(ddg.hasMore),
    cursor: ddg.cursor,
    sources,
    source: "webSearch",
    elapsed_ms: Date.now() - started,
  });
});
