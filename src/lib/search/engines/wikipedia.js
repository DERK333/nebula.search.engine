import { fetchJson, makeResult, stripTags } from "../utils.js";

function wikiUrl(title) {
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;
}

export async function searchWikipedia({ query, fetchImpl, signal, maxResults = 250 }) {
  const results = [];
  const related = [];
  let offset = 0;
  const pageSize = 50;

  while (results.length < maxResults) {
    const limit = Math.min(pageSize, maxResults - results.length);
    const url =
      `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}` +
      `&srlimit=${limit}&sroffset=${offset}&format=json&origin=*`;
    const data = await fetchJson(url, { fetchImpl, signal, timeout: 10000 });
    const hits = data?.query?.search || [];
    hits.forEach((hit, index) => {
      const result = makeResult({
        title: hit.title,
        url: wikiUrl(hit.title),
        description: stripTags(hit.snippet || ""),
      }, "wikipedia", offset + index);
      if (result) results.push(result);
    });
    const total = data?.query?.searchinfo?.totalhits || 0;
    offset += hits.length;
    if (!hits.length || offset >= total) break;
  }

  try {
    const suggestUrl =
      `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=20&namespace=0&format=json&origin=*`;
    const suggest = await fetchJson(suggestUrl, { fetchImpl, signal, timeout: 6000 });
    const titles = Array.isArray(suggest?.[1]) ? suggest[1] : [];
    const descs = Array.isArray(suggest?.[2]) ? suggest[2] : [];
    const urls = Array.isArray(suggest?.[3]) ? suggest[3] : [];
    titles.forEach((title, index) => {
      related.push(title);
      const result = makeResult({
        title,
        url: urls[index] || wikiUrl(title),
        description: descs[index] || "",
      }, "wikipedia", results.length + index);
      if (result && !results.some((item) => item.url === result.url)) results.push(result);
    });
  } catch {
    // suggestions are optional
  }

  return {
    results,
    hasMore: false,
    related,
  };
}

export async function searchWikidata({ query, fetchImpl, signal, maxResults = 40 }) {
  const url =
    `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(query)}` +
    `&language=en&limit=${Math.min(maxResults, 50)}&format=json&origin=*`;
  const data = await fetchJson(url, { fetchImpl, signal, timeout: 8000 });
  const results = (data?.search || []).map((item, index) => makeResult({
    title: item.label || item.id,
    url: item.concepturi || `https://www.wikidata.org/wiki/${item.id}`,
    description: item.description || "",
  }, "wikidata", index)).filter(Boolean);

  return { results, related: (data?.search || []).map((item) => item.label).filter(Boolean) };
}
