import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// ── Stop words (ignored in term scoring) ────────────────────────────────────
const STOP_WORDS = new Set([
  "the","a","an","and","or","but","in","on","at","to","for","of","with",
  "by","from","is","it","its","be","as","are","was","were","been","has",
  "have","had","do","does","did","will","would","could","should","may",
  "might","can","not","no","so","if","then","than","that","this","these",
  "those","they","their","them","we","our","us","you","your","he","she",
  "his","her","i","my","me","what","which","who","when","where","how",
  "more","also","just","about","up","out","into","there","here","all",
  "some","any","each","other","after","before","over","under","between",
]);

// ── Tokenize text into meaningful terms ─────────────────────────────────────
function tokenize(text) {
  return (text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s\-\_]/g, " ")
    .split(/\s+/)
    .filter(t => t.length > 1 && !STOP_WORDS.has(t));
}

// ── Build term frequency map ─────────────────────────────────────────────────
function termFreq(tokens) {
  const freq = {};
  for (const t of tokens) freq[t] = (freq[t] || 0) + 1;
  return freq;
}

// ── TF-IDF relevance score ───────────────────────────────────────────────────
// Scores a single page against the query terms with field weights
function scorePage(page, queryTerms, corpusSize) {
  if (!queryTerms.length) return 0;

  const titleTokens = tokenize(page.title);
  const descTokens = tokenize(page.description);
  const snippetTokens = tokenize(page.content_snippet);
  const kwTokens = (page.keywords || []).flatMap(k => tokenize(k));

  const titleFreq = termFreq(titleTokens);
  const descFreq = termFreq(descTokens);
  const snippetFreq = termFreq(snippetTokens);
  const kwFreq = termFreq(kwTokens);

  // Full query phrase bonus
  const fullQuery = queryTerms.join(" ");
  const titleLower = (page.title || "").toLowerCase();
  const descLower = (page.description || "").toLowerCase();
  const snippetLower = (page.content_snippet || "").toLowerCase();

  let score = 0;

  // Exact phrase match — strong signal
  if (titleLower.includes(fullQuery)) score += 40;
  else if (descLower.includes(fullQuery)) score += 20;
  else if (snippetLower.includes(fullQuery)) score += 10;

  // Per-term scoring with TF-style weighting
  for (const term of queryTerms) {
    const tf_title   = Math.log1p(titleFreq[term]   || 0);
    const tf_desc    = Math.log1p(descFreq[term]    || 0);
    const tf_snippet = Math.log1p(snippetFreq[term] || 0);
    const tf_kw      = Math.log1p(kwFreq[term]      || 0);

    // Field weights: title >> keywords > description > snippet
    score += tf_title   * 12;
    score += tf_kw      * 8;
    score += tf_desc    * 5;
    score += tf_snippet * 2;

    // Bonus: term appears at start of title (very strong intent signal)
    if (titleLower.startsWith(term)) score += 8;

    // Bonus: term in URL path (natural, not SEO-stuffed)
    const urlPath = (() => { try { return new URL(page.url).pathname.toLowerCase(); } catch { return ""; } })();
    if (urlPath.includes(term) && urlPath.length < 60) score += 4;

    // Bonus: term in domain name (canonical authority)
    if ((page.domain || "").toLowerCase().includes(term)) score += 6;
  }

  // ── QUERY COVERAGE: fraction of query terms matched ──────────────────────
  const allText = [titleLower, descLower, snippetLower].join(" ");
  const coveredTerms = queryTerms.filter(t => allText.includes(t));
  const coverage = coveredTerms.length / queryTerms.length;
  score *= (0.3 + 0.7 * coverage); // heavy penalty for partial coverage

  // ── CONTENT QUALITY signals (anti-SEO, pro-substance) ───────────────────
  const wordCount = page.word_count || 0;

  // Content depth reward: pages with more real content rank higher
  const depthBonus = Math.min(Math.log1p(wordCount / 100), 3.0);
  score += depthBonus * 3;

  // Description quality: long, unique descriptions beat thin SEO snippets
  const descLen = (page.description || "").length;
  if (descLen > 80)  score += 2;
  if (descLen > 200) score += 2;

  // Penalize extremely thin content (SEO doorway pages)
  if (wordCount < 50)  score *= 0.4;
  if (wordCount < 200) score *= 0.7;

  // ── FRESHNESS ────────────────────────────────────────────────────────────
  if (page.last_crawled) {
    const ageMs = Date.now() - new Date(page.last_crawled).getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    // Fresh pages get a bonus; stale pages get a small penalty
    if (ageDays < 7)   score += 3;
    else if (ageDays < 30)  score += 1;
    else if (ageDays > 180) score *= 0.9;
  }

  // ── ANTI-SEO PENALTIES ───────────────────────────────────────────────────
  // Penalize keyword-stuffed URLs (long, dash-heavy = SEO-optimized slugs)
  const urlPath2 = (() => { try { return new URL(page.url).pathname; } catch { return ""; } })();
  const dashCount = (urlPath2.match(/-/g) || []).length;
  const segCount  = urlPath2.split("/").filter(Boolean).length;
  if (dashCount > 6)  score *= 0.85; // over-optimized slug
  if (segCount > 5)   score *= 0.90; // buried deep page
  if (urlPath2.includes("?")) score *= 0.85; // parameterized / dynamic

  // Penalize pages with suspiciously keyword-dense titles
  const titleWordCount = titleTokens.length;
  const queryHitsInTitle = queryTerms.filter(t => titleLower.includes(t)).length;
  if (titleWordCount > 0) {
    const titleKwDensity = queryHitsInTitle / titleWordCount;
    if (titleKwDensity > 0.6 && titleWordCount > 4) score *= 0.8; // stuffed title
  }

  // ── AUTHORITY (light, secondary to relevance) ────────────────────────────
  const qualityScore = page.quality_score || 0;
  const inboundLinks = page.inbound_links || 0;
  const authorityBonus = qualityScore * 5 + Math.log1p(inboundLinks) * 0.5;

  // Relevance is 80% of final ranking, authority is 20%
  return score * 0.80 + authorityBonus * 0.20;
}

// ── Deduplicate by domain (max 2 results per domain) ────────────────────────
function deduplicateByDomain(results, maxPerDomain = 2) {
  const domainCount = {};
  return results.filter(r => {
    const d = r.domain || "unknown";
    domainCount[d] = (domainCount[d] || 0) + 1;
    return domainCount[d] <= maxPerDomain;
  });
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const body = await req.json().catch(() => ({}));
  const { query, limit = 15 } = body;

  if (!query || !query.trim()) {
    return Response.json({ results: [], total: 0 });
  }

  const rawTerms = tokenize(query);
  // Also include original multi-word sub-phrases for phrase matching
  const queryTerms = [...new Set(rawTerms)];

  if (queryTerms.length === 0) {
    return Response.json({ results: [], total: 0 });
  }

  // Fetch a broad set of active pages — no pre-sort bias, pure relevance wins
  const allPages = await base44.asServiceRole.entities.IndexedPage.filter(
    { status: "active" }, "-last_crawled", 2000
  );

  if (allPages.length === 0) {
    return Response.json({ results: [], total: 0, from_index: false });
  }

  const corpusSize = allPages.length;

  // Score every page purely on relevance
  const scored = allPages
    .map(page => ({ page, score: scorePage(page, queryTerms, corpusSize) }))
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score);

  // Deduplicate: max 2 results per domain so one site can't dominate
  const deduped = deduplicateByDomain(scored.map(r => ({
    title: r.page.title || r.page.url,
    url: r.page.url,
    description: r.page.description || r.page.content_snippet || "",
    domain: r.page.domain,
    score: r.score,
    quality_score: r.page.quality_score,
    page_rank: r.page.page_rank,
    word_count: r.page.word_count,
    last_crawled: r.page.last_crawled
  })));

  const results = deduped.slice(0, limit);

  return Response.json({ results, total: scored.length, from_index: true });
});