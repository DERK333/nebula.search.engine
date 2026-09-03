import { fetchJson, fetchText, makeResult, SEARCH_UA, stripTags, uniqueStrings } from "../utils.js";
import { searchDuckDuckGoHtml } from "./duckduckgo.js";

const DEFAULT_SEARX_INSTANCES = [
  "https://priv.au",
  "https://searx.be",
  "https://search.sapti.me",
  "https://searx.tiekoetter.com",
];

export async function searchSearx({ query, fetchImpl, signal, keys = {}, page = 1, maxResults = 80 }) {
  const instances = [keys.searxUrl, ...DEFAULT_SEARX_INSTANCES].filter(Boolean);
  let lastError = null;

  for (const origin of instances) {
    const base = String(origin).replace(/\/$/, "");
    const url = `${base}/search?q=${encodeURIComponent(query)}&format=json&pageno=${page}&categories=general`;
    try {
      const data = await fetchJson(url, {
        fetchImpl,
        signal,
        timeout: 8000,
        headers: { Accept: "application/json", "User-Agent": SEARCH_UA },
      });
      const results = (data?.results || []).slice(0, maxResults).map((item, index) => makeResult({
        title: item.title,
        url: item.url || item.href,
        description: item.content || item.pretty_url || "",
      }, "searxng", index)).filter(Boolean);
      if (results.length) return { results, instance: base, hasMore: Boolean(data?.results?.length) };
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) throw lastError;
  return { results: [] };
}

export async function searchBrave({ query, fetchImpl, signal, keys = {}, maxResults = 200 }) {
  if (!keys.brave) return { results: [] };
  const results = [];
  const pageSize = 20;
  for (let offset = 0; offset < maxResults; offset += pageSize) {
    const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${pageSize}&offset=${offset}`;
    const data = await fetchJson(url, {
      fetchImpl,
      signal,
      timeout: 8000,
      headers: {
        Accept: "application/json",
        "X-Subscription-Token": keys.brave,
      },
    });
    const hits = data?.web?.results || [];
    if (!hits.length) break;
    hits.forEach((item, index) => {
      const result = makeResult({
        title: item.title,
        url: item.url,
        description: item.description || "",
      }, "brave", offset + index);
      if (result) results.push(result);
    });
    if (hits.length < pageSize) break;
  }
  return { results };
}

export async function searchBing({ query, fetchImpl, signal, keys = {}, maxResults = 150 }) {
  if (!keys.bing) return { results: [] };
  const results = [];
  const pageSize = 50;
  for (let offset = 0; offset < maxResults; offset += pageSize) {
    const url = `https://api.bing.microsoft.com/v7.0/search?q=${encodeURIComponent(query)}&count=${pageSize}&offset=${offset}`;
    const data = await fetchJson(url, {
      fetchImpl,
      signal,
      timeout: 8000,
      headers: { "Ocp-Apim-Subscription-Key": keys.bing },
    });
    const hits = data?.webPages?.value || [];
    if (!hits.length) break;
    hits.forEach((item, index) => {
      const result = makeResult({
        title: item.name,
        url: item.url,
        description: item.snippet || "",
      }, "bing", offset + index);
      if (result) results.push(result);
    });
    if (hits.length < pageSize) break;
  }
  return { results };
}

export async function searchGoogleCse({ query, fetchImpl, signal, keys = {}, maxResults = 100 }) {
  if (!keys.google || !keys.googleCx) return { results: [] };
  const results = [];
  for (let start = 1; start <= maxResults; start += 10) {
    const url =
      `https://www.googleapis.com/customsearch/v1?key=${encodeURIComponent(keys.google)}` +
      `&cx=${encodeURIComponent(keys.googleCx)}&q=${encodeURIComponent(query)}&num=10&start=${start}`;
    const data = await fetchJson(url, { fetchImpl, signal, timeout: 8000 });
    const hits = data?.items || [];
    if (!hits.length) break;
    hits.forEach((item, index) => {
      const result = makeResult({
        title: item.title,
        url: item.link,
        description: item.snippet || "",
      }, "google", start + index);
      if (result) results.push(result);
    });
    if (hits.length < 10) break;
  }
  return { results };
}

export async function searchMojeek({ query, fetchImpl, signal, keys = {}, maxResults = 100 }) {
  if (!keys.mojeek) return { results: [] };
  const url = `https://api.mojeek.com/search?q=${encodeURIComponent(query)}&api_key=${encodeURIComponent(keys.mojeek)}&fmt=json`;
  const data = await fetchJson(url, { fetchImpl, signal, timeout: 8000 });
  const results = (data?.response?.results || data?.results || []).slice(0, maxResults).map((item, index) => makeResult({
    title: item.title,
    url: item.url,
    description: item.desc || item.description || "",
  }, "mojeek", index)).filter(Boolean);
  return { results };
}

export function parseBingRss(xml, limit = 50) {
  const items = [...String(xml).matchAll(/<item>([\s\S]*?)<\/item>/gi)];
  const results = [];
  for (let i = 0; i < items.length && results.length < limit; i += 1) {
    const block = items[i][1];
    const title = stripTags(block.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || "");
    const url = stripTags(block.match(/<link>([\s\S]*?)<\/link>/i)?.[1] || "");
    const description = stripTags(block.match(/<description>([\s\S]*?)<\/description>/i)?.[1] || "");
    const result = makeResult({ title, url, description }, "bing", i);
    if (result) results.push(result);
  }
  return results;
}

export async function searchBingRss({ query, fetchImpl, signal, maxResults = 80 }) {
  const variants = uniqueStrings([
    query,
    `"${query}"`,
    `${query} documentation`,
    `${query} tutorial`,
    `${query} official site`,
    `${query} site:edu`,
    `${query} site:gov`,
  ]).slice(0, 7);

  const results = [];
  const seen = new Set();
  for (const variant of variants) {
    if (results.length >= maxResults) break;
    const xml = await fetchText(`https://www.bing.com/search?q=${encodeURIComponent(variant)}&format=rss`, {
      fetchImpl,
      signal,
      timeout: 8000,
      headers: {
        Accept: "application/rss+xml, application/xml, text/xml",
        "User-Agent": SEARCH_UA,
      },
    });
    for (const item of parseBingRss(xml, 20)) {
      if (seen.has(item.url) || results.length >= maxResults) continue;
      seen.add(item.url);
      results.push(item);
    }
  }
  return { results };
}

export async function searchServerWeb(ctx) {
  const ddg = await searchDuckDuckGoHtml(ctx);
  return ddg;
}

export { searchDuckDuckGoHtml };
