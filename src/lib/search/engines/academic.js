import { fetchJson, fetchText, makeResult, stripTags } from "../utils.js";
import { parseOpenAlexAbstract } from "./open-web.js";

export async function searchOpenAlex({ query, fetchImpl, signal, maxResults = 150 }) {
  const perPage = Math.min(maxResults, 200);
  const url = `https://api.openalex.org/works?search=${encodeURIComponent(query)}&per-page=${perPage}&mailto=explore@search.local`;
  const data = await fetchJson(url, { fetchImpl, signal, timeout: 10000 });
  const results = (data?.results || []).map((work, index) => makeResult({
    title: work.display_name,
    url: work.doi ? `https://doi.org/${String(work.doi).replace(/^https?:\/\/doi.org\//, "")}` : (work.id || work.primary_location?.landing_page_url),
    description: parseOpenAlexAbstract(work.abstract_inverted_index) || (work.primary_location?.source?.display_name || ""),
    content_type: "research",
  }, "openalex", index)).filter(Boolean);
  return { results, hasMore: Boolean(data?.meta?.next_cursor) };
}

export async function searchSemanticScholar({ query, fetchImpl, signal, maxResults = 80 }) {
  const url =
    `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}` +
    `&limit=${Math.min(maxResults, 100)}&fields=title,url,abstract,year,venue,externalIds`;
  const data = await fetchJson(url, { fetchImpl, signal, timeout: 10000 });
  const results = (data?.data || []).map((paper, index) => {
    const doi = paper.externalIds?.DOI;
    return makeResult({
      title: paper.title,
      url: paper.url || (doi ? `https://doi.org/${doi}` : `https://www.semanticscholar.org/paper/${paper.paperId}`),
      description: paper.abstract || [paper.venue, paper.year].filter(Boolean).join(" · "),
      content_type: "research",
    }, "semanticscholar", index);
  }).filter(Boolean);
  return { results };
}

export async function searchCrossref({ query, fetchImpl, signal, maxResults = 80 }) {
  const url = `https://api.crossref.org/works?query=${encodeURIComponent(query)}&rows=${Math.min(maxResults, 100)}`;
  const data = await fetchJson(url, { fetchImpl, signal, timeout: 10000 });
  const results = (data?.message?.items || []).map((item, index) => makeResult({
    title: Array.isArray(item.title) ? item.title[0] : item.title,
    url: item.URL || (item.DOI ? `https://doi.org/${item.DOI}` : ""),
    description: [item.container_title?.[0], item.issued?.["date-parts"]?.[0]?.[0], item.abstract ? stripTags(item.abstract).slice(0, 280) : ""]
      .filter(Boolean)
      .join(" · "),
    content_type: "research",
  }, "crossref", index)).filter(Boolean);
  return { results };
}

export async function searchPubmed({ query, fetchImpl, signal, maxResults = 80 }) {
  const searchUrl =
    `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}` +
    `&retmax=${Math.min(maxResults, 100)}&retmode=json`;
  const search = await fetchJson(searchUrl, { fetchImpl, signal, timeout: 8000 });
  const ids = search?.esearchresult?.idlist || [];
  if (!ids.length) return { results: [] };
  const summaryUrl =
    `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${ids.join(",")}&retmode=json`;
  const summary = await fetchJson(summaryUrl, { fetchImpl, signal, timeout: 8000 });
  const results = ids.map((id, index) => {
    const item = summary?.result?.[id];
    return makeResult({
      title: item?.title || `PubMed ${id}`,
      url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
      description: [item?.source, item?.pubdate, item?.fulljournalname].filter(Boolean).join(" · "),
      content_type: "research",
    }, "pubmed", index);
  }).filter(Boolean);
  return { results };
}

export async function searchArxiv({ query, fetchImpl, signal, maxResults = 80 }) {
  const url =
    `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&start=0&max_results=${Math.min(maxResults, 100)}`;
  const xml = await fetchText(url, {
    fetchImpl,
    signal,
    timeout: 10000,
    headers: { Accept: "application/atom+xml" },
  });
  const entries = xml.split("<entry>").slice(1);
  const results = entries.map((entry, index) => {
    const title = stripTags(entry.match(/<title>([\s\S]*?)<\/title>/)?.[1] || "");
    const id = stripTags(entry.match(/<id>([\s\S]*?)<\/id>/)?.[1] || "");
    const summary = stripTags(entry.match(/<summary>([\s\S]*?)<\/summary>/)?.[1] || "").slice(0, 400);
    return makeResult({
      title,
      url: id,
      description: summary,
      content_type: "research",
    }, "arxiv", index);
  }).filter(Boolean);
  return { results };
}
