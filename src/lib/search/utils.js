const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with",
  "by", "from", "is", "it", "its", "be", "as", "are", "was", "were", "been", "has",
  "have", "had", "do", "does", "did", "will", "would", "could", "should", "may",
  "not", "no", "so", "if", "then", "than", "that", "this", "these", "those",
  "what", "which", "who", "when", "where", "how", "about", "into", "over",
]);

const TRACKING_PARAMS = /^(utm_|fbclid|gclid|mc_|yclid|igshid|_hs|ref$|ref_)/i;

const AUTHORITY_DOMAINS = [
  "wikipedia.org", "developer.mozilla.org", "docs.python.org", "docs.github.com",
  "arxiv.org", "pubmed.ncbi.nlm.nih.gov", "ncbi.nlm.nih.gov", "reuters.com",
  "apnews.com", "bbc.com", "nature.com", "science.org", "stackoverflow.com",
  "github.com", "gitlab.com", "w3.org", "ietf.org", "gov", "edu",
  "semanticscholar.org", "openalex.org", "crossref.org", "archive.org",
  "news.ycombinator.com", "npmjs.com", "pypi.org", "crates.io",
];

export const SEARCH_UA =
  "ExploreBot/2.0 (+https://github.com; federated open-web search indexer)";

export function decodeHtmlEntities(text = "") {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

export function stripTags(text = "") {
  return decodeHtmlEntities(String(text).replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

export function getDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

export function matchesDomain(hostname, expectedDomain) {
  const host = (hostname || "").toLowerCase();
  const expected = (expectedDomain || "").toLowerCase();
  return host === expected || host.endsWith(`.${expected}`);
}

export function canonicalizeUrl(raw) {
  if (!raw) return "";
  let value = String(raw).trim();
  if (value.startsWith("//")) value = `https:${value}`;
  try {
    const url = new URL(value);
    if (!/^https?:$/i.test(url.protocol)) return "";
    url.hash = "";
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
      url.pathname = url.pathname.replace(/\/+$/, "");
    }
    const params = [...url.searchParams.entries()].filter(([key]) => !TRACKING_PARAMS.test(key));
    params.sort(([a], [b]) => a.localeCompare(b));
    url.search = "";
    params.forEach(([key, val]) => url.searchParams.append(key, val));
    return url.toString();
  } catch {
    return "";
  }
}

export function tokenize(text, { keepStops = false } = {}) {
  return (text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s\-_']/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1 && (keepStops || !STOP_WORDS.has(token)));
}

export function inferContentType({ url = "", title = "", description = "" } = {}) {
  const haystack = `${url} ${title} ${description}`.toLowerCase();
  const domain = getDomain(url);

  if (matchesDomain(domain, "wikipedia.org") || /\/wiki\//.test(url)) return "wiki";
  if (/(arxiv\.org|pubmed|semanticscholar|openalex|crossref|doi\.org|ssrn\.com)/.test(haystack)) return "research";
  if (/(docs|documentation|reference|manual|mdn)/.test(haystack)) return "documentation";
  if (/(tutorial|how to|how-to|step by step|walkthrough|guide)/.test(haystack)) return "technical_guide";
  if (matchesDomain(domain, "github.com") || matchesDomain(domain, "gitlab.com")) {
    return /(issues|pull|discussions)/.test(url) ? "discussion" : "repository";
  }
  if (/(stackoverflow\.com|stackexchange\.com|news\.ycombinator\.com|reddit\.com)/.test(domain)) return "discussion";
  if (/(npmjs\.com|pypi\.org|crates\.io|packagist\.org)/.test(domain)) return "package";
  if (/(archive\.org|openlibrary\.org|gutenberg)/.test(domain)) return "archive";
  if (/(news|breaking|report|latest|today|article)/.test(haystack)) return "news";
  if (/(buy|price|shop|store|cart|amazon|shopping)/.test(haystack)) return "commercial";
  if (/(blog|post|medium\.com|substack\.com)/.test(haystack)) return "blog";
  if (/(privacy policy|terms of service|cookie policy)/.test(haystack)) return "legal_boilerplate";
  return "general";
}

export function inferQualityScore({ url = "", title = "", description = "" } = {}) {
  let score = 0.45;
  const domain = getDomain(url);
  if (AUTHORITY_DOMAINS.some((item) => item.includes(".") ? matchesDomain(domain, item) : domain.endsWith(`.${item}`) || domain.endsWith(item))) {
    score += 0.25;
  }
  if ((title || "").length > 15 && (title || "").length < 140) score += 0.1;
  if ((description || "").length > 60) score += 0.1;
  if (/^https:\/\//i.test(url)) score += 0.05;
  return Math.min(score, 0.98);
}

export function makeResult(partial, source, rank = 0) {
  const url = canonicalizeUrl(partial.url);
  if (!url) return null;
  const title = stripTags(partial.title || url);
  const description = stripTags(partial.description || "");
  const domain = partial.domain || getDomain(url);
  return {
    title,
    url,
    description,
    domain,
    content_type: partial.content_type || inferContentType({ url, title, description }),
    quality_score: partial.quality_score ?? inferQualityScore({ url, title, description }),
    score: partial.score ?? Math.max(1, 100 - rank),
    source,
    sources: [source],
    word_count: partial.word_count,
    last_crawled: partial.last_crawled,
  };
}

export function scoreDocument(doc, queryTerms) {
  if (!queryTerms.length) return 0;
  const title = (doc.title || "").toLowerCase();
  const description = `${doc.description || ""} ${doc.content_snippet || ""}`.toLowerCase();
  const keywords = (doc.keywords || []).join(" ").toLowerCase();
  const haystack = `${title} ${description} ${keywords}`;
  const hits = queryTerms.filter((term) => haystack.includes(term));
  if (!hits.length) return 0;
  const coverage = hits.length / queryTerms.length;
  let score = coverage * 20;
  for (const term of queryTerms) {
    if (title.includes(term)) score += 8;
    if (description.includes(term)) score += 2;
    if (keywords.includes(term)) score += 3;
  }
  const phrase = queryTerms.join(" ");
  if (title.includes(phrase)) score += 18;
  else if (description.includes(phrase)) score += 8;
  return score * (0.6 + (doc.quality_score || 0.4));
}

export async function fetchWithTimeout(url, {
  fetchImpl = fetch,
  timeout = 8000,
  headers = {},
  method = "GET",
  body,
  signal,
} = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  const onAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener("abort", onAbort, { once: true });
  }
  try {
    const response = await fetchImpl(url, {
      method,
      body,
      headers,
      signal: controller.signal,
      redirect: "follow",
    });
    return response;
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener("abort", onAbort);
  }
}

export async function fetchJson(url, options = {}) {
  const response = await fetchWithTimeout(url, {
    ...options,
    headers: {
      Accept: "application/json, text/plain, */*",
      "User-Agent": SEARCH_UA,
      ...(options.headers || {}),
    },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return response.json();
}

export async function fetchText(url, options = {}) {
  const response = await fetchWithTimeout(url, {
    ...options,
    headers: {
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "User-Agent": SEARCH_UA,
      ...(options.headers || {}),
    },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return response.text();
}

export function uniqueStrings(values) {
  const seen = new Set();
  const out = [];
  for (const value of values) {
    const trimmed = (value || "").trim();
    if (!trimmed || seen.has(trimmed.toLowerCase())) continue;
    seen.add(trimmed.toLowerCase());
    out.push(trimmed);
  }
  return out;
}
