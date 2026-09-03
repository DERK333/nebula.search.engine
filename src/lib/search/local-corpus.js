import { canonicalizeUrl, getDomain, makeResult, scoreDocument, tokenize } from "./utils.js";
import { coreTerms as queryTerms } from "./query-expand.js";

const MEMORY_MAX = 8000;
const memoryPages = new Map();

function canUseIdb() {
  return typeof indexedDB !== "undefined";
}

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("explore-corpus", 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("pages")) {
        db.createObjectStore("pages", { keyPath: "url" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function idbUpsert(pages) {
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction("pages", "readwrite");
    const store = tx.objectStore("pages");
    pages.forEach((page) => store.put(page));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbAll() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("pages", "readonly");
    const request = tx.objectStore("pages").getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function upsertLocalPages(pages = []) {
  const records = pages.map((page) => {
    const url = canonicalizeUrl(page.url);
    if (!url) return null;
    return {
      url,
      title: page.title || url,
      description: page.description || "",
      content_snippet: page.content_snippet || page.description || "",
      domain: page.domain || getDomain(url),
      keywords: page.keywords || tokenize(`${page.title || ""} ${page.description || ""}`).slice(0, 24),
      content_type: page.content_type,
      quality_score: page.quality_score,
      indexedAt: Date.now(),
      source: page.source || (page.sources || [])[0] || "search",
    };
  }).filter(Boolean);

  if (!records.length) return 0;

  if (canUseIdb()) {
    try {
      await idbUpsert(records);
      return records.length;
    } catch {
      // fall through to memory
    }
  }

  for (const record of records) {
    memoryPages.set(record.url, record);
  }
  if (memoryPages.size > MEMORY_MAX) {
    const extra = memoryPages.size - MEMORY_MAX;
    const keys = [...memoryPages.keys()].slice(0, extra);
    keys.forEach((key) => memoryPages.delete(key));
  }
  return records.length;
}

export async function loadLocalPages() {
  if (canUseIdb()) {
    try {
      const pages = await idbAll();
      if (pages.length) return pages;
    } catch {
      // memory fallback
    }
  }
  return [...memoryPages.values()];
}

export async function searchLocalCorpus(query, { limit = 400 } = {}) {
  const terms = queryTerms(query);
  if (!terms.length) return [];
  const pages = await loadLocalPages();
  return pages
    .map((page) => {
      const score = scoreDocument(page, terms);
      if (score <= 0) return null;
      return makeResult({
        ...page,
        score,
      }, "local-index");
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export async function localCorpusStats() {
  const pages = await loadLocalPages();
  return { pages: pages.length };
}
