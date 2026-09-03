import { fetchJson, fetchText, makeResult, stripTags, canonicalizeUrl } from "../utils.js";

function flattenRelated(topics, bucket = []) {
  for (const topic of topics || []) {
    if (topic?.Topics) flattenRelated(topic.Topics, bucket);
    else if (topic?.FirstURL) bucket.push(topic);
  }
  return bucket;
}

export async function searchDuckDuckGoInstant({ query, fetchImpl, signal }) {
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
  const data = await fetchJson(url, { fetchImpl, signal, timeout: 8000 });
  const results = [];
  const related = [];

  if (data?.AbstractURL) {
    results.push(makeResult({
      title: data.Heading || query,
      url: data.AbstractURL,
      description: data.AbstractText || "",
    }, "duckduckgo", 0));
  }

  (data?.Results || []).forEach((item, index) => {
    const result = makeResult({
      title: stripTags(item.Text || item.FirstURL),
      url: item.FirstURL,
      description: stripTags(item.Result || item.Text || ""),
    }, "duckduckgo", index + 1);
    if (result) results.push(result);
  });

  flattenRelated(data?.RelatedTopics).forEach((item, index) => {
    const title = stripTags((item.Text || "").split(" - ")[0] || item.FirstURL);
    const description = stripTags(item.Text || "");
    if (title) related.push(title);
    const result = makeResult({
      title,
      url: item.FirstURL,
      description,
    }, "duckduckgo", results.length + index);
    if (result) results.push(result);
  });

  return { results: results.filter(Boolean), related };
}

export function parseDuckDuckGoResults(html, limit = 50) {
  const results = [];
  const anchorRegex = /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  const anchors = [...html.matchAll(anchorRegex)];

  for (let i = 0; i < anchors.length && results.length < limit; i += 1) {
    const match = anchors[i];
    const next = anchors[i + 1];
    const block = html.slice(match.index ?? 0, next?.index ?? html.length);
    const snippetMatch = block.match(/<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/)
      || block.match(/<td[^>]*class="result-snippet"[^>]*>([\s\S]*?)<\/td>/);
    const rawUrl = match[1].replace(/&amp;/g, "&");
    const urlMatch = rawUrl.match(/[?&]uddg=([^&]+)/i);
    const urlCandidate = urlMatch ? urlMatch[1] : rawUrl.replace(/^\/\//, "https://");
    let url = urlCandidate;
    try {
      url = decodeURIComponent(urlCandidate);
    } catch {
      url = urlCandidate;
    }
    const result = makeResult({
      title: stripTags(match[2]),
      url,
      description: snippetMatch ? stripTags(snippetMatch[1]) : "",
    }, "duckduckgo", i);
    if (result) results.push(result);
  }

  return results;
}

function isDuckDuckGoBlocked(html = "") {
  return /anomaly-modal|cc=botnet/i.test(html);
}

export function parseDuckDuckGoLite(html, limit = 50) {
  const results = [];
  const linkRegex = /<a[^>]*class="result-link"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  const matches = [...html.matchAll(linkRegex)];
  const snippetRegex = /<td[^>]*class="result-snippet"[^>]*>([\s\S]*?)<\/td>/gi;
  const snippets = [...html.matchAll(snippetRegex)].map((item) => stripTags(item[1]));

  for (let i = 0; i < matches.length && results.length < limit; i += 1) {
    const result = makeResult({
      title: stripTags(matches[i][2]),
      url: matches[i][1],
      description: snippets[i] || "",
    }, "duckduckgo", i);
    if (result) results.push(result);
  }
  return results;
}

export function parseNextDuckDuckGoOffset(html) {
  const match = html.match(/name=["']s["'][^>]*value=["'](\d+)["']/i)
    || html.match(/value=["'](\d+)["'][^>]*name=["']s["']/i);
  return match ? Number(match[1]) : null;
}

async function fetchDuckDuckGoPage(query, offset, fetchImpl, signal) {
  const headers = {
    Accept: "text/html,application/xhtml+xml",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36",
  };

  if (!offset) {
    return fetchText(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
      fetchImpl,
      signal,
      timeout: 10000,
      headers,
    });
  }

  return fetchText("https://html.duckduckgo.com/html/", {
    fetchImpl,
    signal,
    timeout: 10000,
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: `q=${encodeURIComponent(query)}&s=${offset}&next=y&v=l&o=json&api=d.js&kl=us-en`,
  });
}

export async function searchDuckDuckGoHtml({
  query,
  fetchImpl,
  signal,
  maxPages = 20,
  maxResults = 600,
  startOffset = 0,
}) {
  const results = [];
  const seen = new Set();
  let offset = startOffset;
  let nextOffset = null;

  for (let page = 0; page < maxPages && results.length < maxResults; page += 1) {
    let html = "";
    try {
      html = await fetchDuckDuckGoPage(query, offset, fetchImpl, signal);
    } catch {
      break;
    }
    if (isDuckDuckGoBlocked(html)) break;
    const parsed = parseDuckDuckGoResults(html, 50);
    const fresh = parsed.filter((item) => {
      const key = canonicalizeUrl(item.url);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    if (!fresh.length) {
      if (page === 0) {
        try {
          const lite = await fetchText(`https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`, {
            fetchImpl,
            signal,
            timeout: 8000,
            headers: { "User-Agent": "Mozilla/5.0" },
          });
          const liteParsed = parseDuckDuckGoLite(lite, 50);
          liteParsed.forEach((item) => {
            const key = canonicalizeUrl(item.url);
            if (key && !seen.has(key)) {
              seen.add(key);
              results.push(item);
            }
          });
        } catch {
          // lite is a fallback only
        }
      }
      break;
    }
    results.push(...fresh);
    nextOffset = parseNextDuckDuckGoOffset(html);
    if (nextOffset == null || nextOffset === offset) {
      offset += fresh.length;
      nextOffset = offset;
    } else {
      offset = nextOffset;
    }
  }

  return {
    results,
    hasMore: Boolean(nextOffset) && results.length >= 10,
    nextCursor: nextOffset,
  };
}
