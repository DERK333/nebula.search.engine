import { tokenize, uniqueStrings } from "./utils.js";

const INTENT_SUFFIXES = {
  instructional: ["tutorial", "guide", "documentation", "how to"],
  comparative: ["vs", "review", "comparison", "best"],
  news: ["news", "latest"],
  research: ["paper", "research", "study"],
};

export function classifyIntent(query) {
  const q = query.toLowerCase();
  if (/^(what is|what are|who is|define|meaning of|explain)/i.test(q)) return "informational";
  if (/^(how to|how do|how can|steps to|tutorial|guide|learn)/i.test(q)) return "instructional";
  if (/^(best|top|vs|compare|review|recommend|versus)/i.test(q)) return "comparative";
  if (/\b(buy|price|purchase|shop|store|deal|discount)\b/i.test(q)) return "transactional";
  if (/\b(news|latest|today|breaking|current|recent)\b/i.test(q)) return "news";
  if (/\b(paper|study|research|journal|doi)\b/i.test(q)) return "research";
  return "general";
}

export function expandQueries(query, related = []) {
  const q = (query || "").trim();
  if (!q) return [];

  const intent = classifyIntent(q);
  const expansions = [q];
  const words = q.split(/\s+/);

  if (words.length > 1 && !q.includes("\"")) expansions.push(`"${q}"`);

  for (const extra of related) {
    if (extra && extra.toLowerCase() !== q.toLowerCase()) expansions.push(extra);
  }

  const suffixes = INTENT_SUFFIXES[intent] || [];
  for (const suffix of suffixes.slice(0, 2)) {
    if (!q.toLowerCase().includes(suffix)) expansions.push(`${q} ${suffix}`);
  }

  return uniqueStrings(expansions).slice(0, 8);
}

export function siteScopedQueries(query) {
  const q = (query || "").trim();
  if (!q) return [];
  return [
    `${q} site:edu`,
    `${q} site:gov`,
    `${q} site:org`,
  ];
}

export function coreTerms(query) {
  return uniqueStrings(tokenize(query));
}
