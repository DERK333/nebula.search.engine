import { canonicalizeUrl, makeResult, scoreDocument, tokenize } from "./utils.js";

const RRF_K = 60;

export class ResultCollector {
  constructor({ cap = 2500, query = "" } = {}) {
    this.cap = cap;
    this.queryTerms = tokenize(query);
    this.byUrl = new Map();
    this.sources = {};
    this.related = new Set();
    this.engineRanks = new Map();
  }

  addRelated(values = []) {
    for (const value of values) {
      const trimmed = (value || "").trim();
      if (trimmed) this.related.add(trimmed);
    }
  }

  add(rawResults = [], source = "web", { ranked = true } = {}) {
    if (!this.sources[source]) this.sources[source] = 0;
    let added = 0;

    rawResults.forEach((raw, index) => {
      const prepared = raw?.url ? (raw.source ? raw : makeResult(raw, source, index)) : null;
      if (!prepared) return;
      const key = canonicalizeUrl(prepared.url);
      if (!key) return;

      const rrf = ranked ? 1 / (RRF_K + index + 1) : (prepared.score || 1) / 1000;
      const existing = this.byUrl.get(key);
      if (!existing) {
        if (this.byUrl.size >= this.cap) return;
        this.byUrl.set(key, {
          ...prepared,
          url: key,
          sources: [source],
          source,
          rrf,
          score: (prepared.score || 0) + rrf * 100,
        });
        this.sources[source] += 1;
        added += 1;
        return;
      }

      existing.rrf += rrf;
      existing.score = Math.max(existing.score || 0, prepared.score || 0) + rrf * 40;
      existing.quality_score = Math.max(existing.quality_score || 0, prepared.quality_score || 0);
      if ((prepared.description || "").length > (existing.description || "").length) {
        existing.description = prepared.description;
      }
      if (!existing.sources.includes(source)) existing.sources.push(source);
      this.sources[source] += 1;
      added += 1;
    });

    this.engineRanks.set(source, (this.engineRanks.get(source) || 0) + added);
    return added;
  }

  list() {
    const terms = this.queryTerms;
    return [...this.byUrl.values()].sort((a, b) => {
      const lexicalA = terms.length ? scoreDocument(a, terms) : 0;
      const lexicalB = terms.length ? scoreDocument(b, terms) : 0;
      const combinedA = (a.rrf || 0) * 80 + lexicalA;
      const combinedB = (b.rrf || 0) * 80 + lexicalB;
      a.score = combinedA;
      b.score = combinedB;
      if (Math.abs(combinedB - combinedA) > 0.0001) return combinedB - combinedA;
      return (b.quality_score || 0) - (a.quality_score || 0);
    });
  }

  snapshot() {
    const results = this.list();
    return {
      results,
      total: results.length,
      returned: results.length,
      sources: { ...this.sources },
      related: [...this.related],
    };
  }
}

export function mergeResultLists(lists, query = "") {
  const collector = new ResultCollector({ query });
  for (const { results, source } of lists) {
    collector.add(results, source);
  }
  return collector.snapshot();
}
