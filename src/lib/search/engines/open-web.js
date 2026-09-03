import { fetchJson, makeResult, stripTags } from "../utils.js";

export async function searchArchiveOrg({ query, fetchImpl, signal, maxResults = 120, page = 1 }) {
  const rows = Math.min(maxResults, 100);
  const url =
    `https://archive.org/advancedsearch.php?q=${encodeURIComponent(query)}` +
    `&fl[]=identifier&fl[]=title&fl[]=description&fl[]=mediatype&sort[]=downloads+desc&rows=${rows}&page=${page}&output=json`;
  const data = await fetchJson(url, { fetchImpl, signal, timeout: 10000 });
  const docs = data?.response?.docs || [];
  const results = docs.map((doc, index) => makeResult({
    title: doc.title || doc.identifier,
    url: `https://archive.org/details/${doc.identifier}`,
    description: Array.isArray(doc.description) ? doc.description[0] : (doc.description || doc.mediatype || ""),
    content_type: "archive",
  }, "archive", index)).filter(Boolean);
  const total = data?.response?.numFound || results.length;
  return { results, hasMore: page * rows < total, nextCursor: page + 1 };
}

export async function searchOpenLibrary({ query, fetchImpl, signal, maxResults = 80 }) {
  const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=${Math.min(maxResults, 100)}`;
  const data = await fetchJson(url, { fetchImpl, signal, timeout: 10000 });
  const results = (data?.docs || []).map((doc, index) => makeResult({
    title: doc.title,
    url: doc.key ? `https://openlibrary.org${doc.key}` : `https://openlibrary.org/search?q=${encodeURIComponent(doc.title || query)}`,
    description: [doc.author_name?.[0], doc.first_publish_year, doc.subject?.slice(0, 3).join(", ")].filter(Boolean).join(" · "),
    content_type: "archive",
  }, "openlibrary", index)).filter(Boolean);
  return { results };
}

export async function searchMdn({ query, fetchImpl, signal, maxResults = 50 }) {
  const url = `https://developer.mozilla.org/api/v1/search?q=${encodeURIComponent(query)}&locale=en-US`;
  const data = await fetchJson(url, { fetchImpl, signal, timeout: 8000 });
  const results = (data?.documents || []).slice(0, maxResults).map((doc, index) => makeResult({
    title: doc.title,
    url: `https://developer.mozilla.org${doc.mdn_url}`,
    description: doc.summary || "",
    content_type: "documentation",
  }, "mdn", index)).filter(Boolean);
  return { results };
}

export async function searchNpm({ query, fetchImpl, signal, maxResults = 40 }) {
  const url = `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(query)}&size=${Math.min(maxResults, 100)}`;
  const data = await fetchJson(url, { fetchImpl, signal, timeout: 8000 });
  const results = (data?.objects || []).map((item, index) => {
    const pkg = item.package || {};
    return makeResult({
      title: `${pkg.name}${pkg.version ? ` v${pkg.version}` : ""}`,
      url: pkg.links?.npm || `https://www.npmjs.com/package/${pkg.name}`,
      description: pkg.description || "",
      content_type: "package",
    }, "npm", index);
  }).filter(Boolean);
  return { results };
}

export async function searchItunes({ query, fetchImpl, signal, maxResults = 20 }) {
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&limit=${Math.min(maxResults, 50)}`;
  const data = await fetchJson(url, { fetchImpl, signal, timeout: 8000 });
  const results = (data?.results || []).map((item, index) => makeResult({
    title: item.trackName || item.collectionName || item.artistName,
    url: item.trackViewUrl || item.collectionViewUrl || item.artistViewUrl,
    description: [item.kind || item.wrapperType, item.primaryGenreName, item.artistName].filter(Boolean).join(" · "),
    content_type: "media",
  }, "itunes", index)).filter(Boolean);
  return { results };
}

export async function searchGutendex({ query, fetchImpl, signal, maxResults = 30 }) {
  const url = `https://gutendex.com/books?search=${encodeURIComponent(query)}`;
  const data = await fetchJson(url, { fetchImpl, signal, timeout: 8000 });
  const results = (data?.results || []).slice(0, maxResults).map((book, index) => makeResult({
    title: book.title,
    url: book.formats?.["text/html"] || `https://www.gutenberg.org/ebooks/${book.id}`,
    description: (book.authors || []).map((author) => author.name).join(", "),
    content_type: "archive",
  }, "gutenberg", index)).filter(Boolean);
  return { results };
}

export function parseOpenAlexAbstract(abstractInverted) {
  if (!abstractInverted || typeof abstractInverted !== "object") return "";
  const words = [];
  for (const [word, positions] of Object.entries(abstractInverted)) {
    for (const position of positions) words[position] = word;
  }
  return stripTags(words.filter(Boolean).join(" ")).slice(0, 400);
}

export async function searchHuggingFace({ query, fetchImpl, signal, maxResults = 40 }) {
  const url = `https://huggingface.co/api/models?search=${encodeURIComponent(query)}&limit=${Math.min(maxResults, 50)}`;
  const data = await fetchJson(url, { fetchImpl, signal, timeout: 8000 });
  const models = Array.isArray(data) ? data : (data?.models || []);
  const results = models.map((model, index) => makeResult({
    title: model.id || model.modelId,
    url: `https://huggingface.co/${model.id || model.modelId}`,
    description: (model.tags || []).slice(0, 8).join(", ") || "Hugging Face model",
    content_type: "repository",
  }, "huggingface", index)).filter(Boolean);
  return { results };
}

export async function searchCrates({ query, fetchImpl, signal, maxResults = 30 }) {
  const url = `https://crates.io/api/v1/crates?q=${encodeURIComponent(query)}&per_page=${Math.min(maxResults, 50)}`;
  const data = await fetchJson(url, { fetchImpl, signal, timeout: 8000 });
  const results = (data?.crates || []).map((crate, index) => makeResult({
    title: crate.name,
    url: `https://crates.io/crates/${crate.id || crate.name}`,
    description: crate.description || "",
    content_type: "package",
  }, "crates", index)).filter(Boolean);
  return { results };
}

export async function searchRubyGems({ query, fetchImpl, signal, maxResults = 30 }) {
  const url = `https://rubygems.org/api/v1/search.json?query=${encodeURIComponent(query)}`;
  const data = await fetchJson(url, { fetchImpl, signal, timeout: 8000 });
  const results = (Array.isArray(data) ? data : []).slice(0, maxResults).map((gem, index) => makeResult({
    title: gem.name,
    url: gem.project_uri || gem.homepage_uri || `https://rubygems.org/gems/${gem.name}`,
    description: gem.info || "",
    content_type: "package",
  }, "rubygems", index)).filter(Boolean);
  return { results };
}

export async function searchPackagist({ query, fetchImpl, signal, maxResults = 30 }) {
  const url = `https://packagist.org/search.json?q=${encodeURIComponent(query)}`;
  const data = await fetchJson(url, { fetchImpl, signal, timeout: 8000 });
  const results = (data?.results || []).slice(0, maxResults).map((pkg, index) => makeResult({
    title: pkg.name,
    url: pkg.url || `https://packagist.org/packages/${pkg.name}`,
    description: pkg.description || "",
    content_type: "package",
  }, "packagist", index)).filter(Boolean);
  return { results };
}

export async function searchOpenverse({ query, fetchImpl, signal, maxResults = 30 }) {
  const url = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(query)}&page_size=${Math.min(maxResults, 50)}`;
  const data = await fetchJson(url, { fetchImpl, signal, timeout: 8000 });
  const results = (data?.results || []).map((item, index) => makeResult({
    title: item.title || item.id,
    url: item.foreign_landing_url || item.url,
    description: [item.creator, item.license].filter(Boolean).join(" · "),
    content_type: "media",
  }, "openverse", index)).filter(Boolean);
  return { results };
}
