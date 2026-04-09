import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

function scoreResultForQuery(page, queryTerms) {
  let relevance = 0;
  const titleLower = (page.title || "").toLowerCase();
  const descLower = (page.description || "").toLowerCase();
  const snippetLower = (page.content_snippet || "").toLowerCase();
  const keywords = page.keywords || [];

  for (const term of queryTerms) {
    const t = term.toLowerCase();
    // Title match (highest weight)
    if (titleLower.includes(t)) relevance += 5;
    // Description match
    if (descLower.includes(t)) relevance += 2;
    // Snippet match
    if (snippetLower.includes(t)) relevance += 1;
    // Keyword match
    if (keywords.some(k => k.includes(t))) relevance += 3;
  }

  return relevance;
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const body = await req.json().catch(() => ({}));
  const { query, limit = 15 } = body;

  if (!query || !query.trim()) {
    return Response.json({ results: [], total: 0 });
  }

  const queryTerms = query.toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(t => t.length > 1);

  if (queryTerms.length === 0) {
    return Response.json({ results: [], total: 0 });
  }

  // Get indexed pages sorted by final_score
  const allPages = await base44.asServiceRole.entities.IndexedPage.filter(
    { status: "active" }, "-final_score", 500
  );

  if (allPages.length === 0) {
    return Response.json({ results: [], total: 0, from_index: false });
  }

  // Score and filter by relevance
  const scored = allPages.map(page => ({
    ...page,
    relevance: scoreResultForQuery(page, queryTerms)
  })).filter(p => p.relevance > 0);

  // Sort by combined score: relevance * 0.5 + final_score * 0.5 (normalized)
  const maxRelevance = Math.max(...scored.map(p => p.relevance), 1);
  const maxFinalScore = Math.max(...scored.map(p => p.final_score || 0), 1);

  scored.sort((a, b) => {
    const scoreA = (a.relevance / maxRelevance) * 0.6 + ((a.final_score || 0) / maxFinalScore) * 0.4;
    const scoreB = (b.relevance / maxRelevance) * 0.6 + ((b.final_score || 0) / maxFinalScore) * 0.4;
    return scoreB - scoreA;
  });

  const results = scored.slice(0, limit).map(p => ({
    title: p.title || p.url,
    url: p.url,
    description: p.description || p.content_snippet || "",
    domain: p.domain,
    final_score: p.final_score,
    quality_score: p.quality_score,
    page_rank: p.page_rank,
    relevance: p.relevance,
    word_count: p.word_count,
    last_crawled: p.last_crawled
  }));

  return Response.json({ results, total: scored.length, from_index: true });
});