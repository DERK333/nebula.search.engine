import { searchWikipedia, searchWikidata } from "./wikipedia.js";
import { searchDuckDuckGoInstant, searchDuckDuckGoHtml } from "./duckduckgo.js";
import {
  searchArchiveOrg,
  searchOpenLibrary,
  searchMdn,
  searchNpm,
  searchItunes,
  searchGutendex,
  searchHuggingFace,
  searchCrates,
  searchRubyGems,
  searchPackagist,
  searchOpenverse,
} from "./open-web.js";
import {
  searchOpenAlex,
  searchSemanticScholar,
  searchCrossref,
  searchPubmed,
  searchArxiv,
} from "./academic.js";
import {
  searchGitHub,
  searchHackerNews,
  searchStackExchange,
  searchReddit,
} from "./community.js";
import {
  searchSearx,
  searchBrave,
  searchBing,
  searchGoogleCse,
  searchMojeek,
  searchBingRss,
} from "./server-web.js";

export const CLIENT_ENGINES = [
  { id: "wikipedia", label: "Wikipedia", cors: true, search: searchWikipedia, timeout: 12000 },
  { id: "wikidata", label: "Wikidata", cors: true, search: searchWikidata, timeout: 8000 },
  { id: "duckduckgo", label: "DuckDuckGo", cors: true, search: searchDuckDuckGoInstant, timeout: 8000 },
  { id: "mdn", label: "MDN", cors: true, search: searchMdn, timeout: 8000 },
  { id: "github", label: "GitHub", cors: true, search: searchGitHub, timeout: 8000 },
  { id: "hackernews", label: "Hacker News", cors: true, search: searchHackerNews, timeout: 8000 },
  { id: "stackoverflow", label: "Stack Overflow", cors: true, search: searchStackExchange, timeout: 8000 },
  { id: "openalex", label: "OpenAlex", cors: true, search: searchOpenAlex, timeout: 10000 },
  { id: "semanticscholar", label: "Semantic Scholar", cors: true, search: searchSemanticScholar, timeout: 10000 },
  { id: "crossref", label: "Crossref", cors: true, search: searchCrossref, timeout: 10000 },
  { id: "pubmed", label: "PubMed", cors: true, search: searchPubmed, timeout: 10000 },
  { id: "arxiv", label: "arXiv", cors: true, search: searchArxiv, timeout: 10000 },
  { id: "archive", label: "Internet Archive", cors: true, search: searchArchiveOrg, timeout: 10000 },
  { id: "openlibrary", label: "Open Library", cors: true, search: searchOpenLibrary, timeout: 8000 },
  { id: "npm", label: "npm", cors: true, search: searchNpm, timeout: 8000 },
  { id: "crates", label: "crates.io", cors: true, search: searchCrates, timeout: 8000 },
  { id: "rubygems", label: "RubyGems", cors: true, search: searchRubyGems, timeout: 8000 },
  { id: "packagist", label: "Packagist", cors: true, search: searchPackagist, timeout: 8000 },
  { id: "huggingface", label: "Hugging Face", cors: true, search: searchHuggingFace, timeout: 8000 },
  { id: "gutenberg", label: "Gutenberg", cors: true, search: searchGutendex, timeout: 8000 },
  { id: "itunes", label: "iTunes", cors: true, search: searchItunes, timeout: 8000 },
  { id: "openverse", label: "Openverse", cors: true, search: searchOpenverse, timeout: 8000 },
];

export const SERVER_ENGINES = [
  { id: "duckduckgo-html", label: "DuckDuckGo Web", cors: false, search: searchDuckDuckGoHtml, timeout: 20000 },
  { id: "bing-rss", label: "Bing Web", cors: false, search: searchBingRss, timeout: 12000 },
  { id: "searxng", label: "SearXNG", cors: false, search: searchSearx, timeout: 10000 },
  { id: "brave", label: "Brave Search", cors: false, search: searchBrave, timeout: 12000 },
  { id: "bing", label: "Bing", cors: false, search: searchBing, timeout: 12000 },
  { id: "google", label: "Google CSE", cors: false, search: searchGoogleCse, timeout: 12000 },
  { id: "mojeek", label: "Mojeek", cors: false, search: searchMojeek, timeout: 8000 },
  { id: "reddit", label: "Reddit", cors: false, search: searchReddit, timeout: 8000 },
];

export function selectEngines({ includeServerEngines = false, keys = {} } = {}) {
  const client = CLIENT_ENGINES;
  if (!includeServerEngines) return client;
  return [
    ...client,
    ...SERVER_ENGINES.filter((engine) => {
      if (engine.id === "brave") return Boolean(keys.brave);
      if (engine.id === "bing") return Boolean(keys.bing);
      if (engine.id === "google") return Boolean(keys.google && keys.googleCx);
      if (engine.id === "mojeek") return Boolean(keys.mojeek);
      return true;
    }),
  ];
}

export {
  searchWikipedia,
  searchWikidata,
  searchDuckDuckGoInstant,
  searchDuckDuckGoHtml,
  searchArchiveOrg,
  searchOpenLibrary,
  searchMdn,
  searchNpm,
  searchItunes,
  searchGutendex,
  searchHuggingFace,
  searchCrates,
  searchRubyGems,
  searchPackagist,
  searchOpenverse,
  searchOpenAlex,
  searchSemanticScholar,
  searchCrossref,
  searchPubmed,
  searchArxiv,
  searchGitHub,
  searchHackerNews,
  searchStackExchange,
  searchReddit,
  searchSearx,
  searchBrave,
  searchBing,
  searchGoogleCse,
  searchMojeek,
  searchBingRss,
};
