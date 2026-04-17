import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// ═══════════════════════════════════════════════════════════════════════════
// STOP WORDS
// ═══════════════════════════════════════════════════════════════════════════
const STOP_WORDS = new Set([
  "the","a","an","and","or","but","in","on","at","to","for","of","with",
  "by","from","is","it","its","be","as","are","was","were","been","has",
  "have","had","do","does","did","will","would","could","should","may",
  "might","can","not","no","so","if","then","than","that","this","these",
  "those","they","their","them","we","our","us","you","your","he","she",
  "his","her","i","my","me","what","which","who","when","where","how",
  "more","also","just","about","up","out","into","there","here","all",
  "some","any","each","other","after","before","over","under","between",
  "get","got","getting","make","making","use","using","used","one","two",
]);

// ═══════════════════════════════════════════════════════════════════════════
// SYNONYM MAP — expands queries semantically
// ═══════════════════════════════════════════════════════════════════════════
const SYNONYMS = {
  // tech
  "javascript": ["js","node","nodejs","ecmascript"],
  "js": ["javascript","node","ecmascript"],
  "typescript": ["ts"],
  "python": ["py","django","flask","fastapi"],
  "machine learning": ["ml","ai","artificial intelligence","deep learning"],
  "ai": ["artificial intelligence","machine learning","ml","llm","gpt"],
  "llm": ["large language model","gpt","claude","ai","artificial intelligence"],
  "database": ["db","sql","nosql","postgres","mongodb","mysql"],
  "api": ["rest","graphql","endpoint","interface"],
  "crypto": ["cryptocurrency","blockchain","bitcoin","ethereum","defi","web3"],
  "bitcoin": ["btc","crypto","blockchain","satoshi"],
  "ethereum": ["eth","evm","solidity","web3","defi"],
  "defi": ["decentralized finance","ethereum","uniswap","lending","yield"],
  "nft": ["non-fungible token","opensea","digital art","collectible"],
  "security": ["cybersecurity","infosec","hacking","vulnerability","exploit"],
  "hacking": ["security","exploit","vulnerability","penetration testing","pentest"],
  "privacy": ["anonymity","tor","vpn","encryption","surveillance"],
  "vpn": ["virtual private network","privacy","anonymity"],
  "tor": ["onion","privacy","anonymity","dark web"],
  // news/general
  "news": ["latest","breaking","report","article","current events"],
  "how to": ["tutorial","guide","howto","step by step","learn"],
  "tutorial": ["how to","guide","learn","beginner","walkthrough"],
  "best": ["top","recommended","review","ranking","comparison"],
  "free": ["open source","gratis","no cost","freeware"],
  "download": ["install","get","setup","package"],
  // science
  "research": ["study","paper","academic","journal","analysis"],
  "science": ["scientific","research","study","academic"],
};

// ═══════════════════════════════════════════════════════════════════════════
// STEMMER — lightweight suffix-stripping (Porter-lite)
// ═══════════════════════════════════════════════════════════════════════════
function stem(word) {
  let w = word.toLowerCase();
  // Remove common suffixes
  if (w.length > 7 && w.endsWith("ational")) return w.slice(0, -5) + "e";
  if (w.length > 6 && w.endsWith("tional"))  return w.slice(0, -2);
  if (w.length > 5 && w.endsWith("izing"))   return w.slice(0, -3) + "e";
  if (w.length > 5 && w.endsWith("ising"))   return w.slice(0, -3) + "e";
  if (w.length > 5 && w.endsWith("ating"))   return w.slice(0, -3) + "e";
  if (w.length > 5 && w.endsWith("alize"))   return w.slice(0, -3);
  if (w.length > 5 && w.endsWith("alism"))   return w.slice(0, -3);
  if (w.length > 5 && w.endsWith("alist"))   return w.slice(0, -3);
  if (w.length > 5 && w.endsWith("ation"))   return w.slice(0, -3) + "e";
  if (w.length > 4 && w.endsWith("ness"))    return w.slice(0, -4);
  if (w.length > 4 && w.endsWith("ment"))    return w.slice(0, -4);
  if (w.length > 4 && w.endsWith("ings"))    return w.slice(0, -4);
  if (w.length > 4 && w.endsWith("ized"))    return w.slice(0, -2) + "e";
  if (w.length > 4 && w.endsWith("iser"))    return w.slice(0, -2);
  if (w.length > 4 && w.endsWith("izer"))    return w.slice(0, -2);
  if (w.length > 4 && w.endsWith("able"))    return w.slice(0, -4);
  if (w.length > 4 && w.endsWith("ible"))    return w.slice(0, -4);
  if (w.length > 4 && w.endsWith("ness"))    return w.slice(0, -4);
  if (w.length > 4 && w.endsWith("tion"))    return w.slice(0, -3) + "e";
  if (w.length > 4 && w.endsWith("ful"))     return w.slice(0, -3);
  if (w.length > 4 && w.endsWith("less"))    return w.slice(0, -4);
  if (w.length > 3 && w.endsWith("ing"))     return w.slice(0, -3);
  if (w.length > 3 && w.endsWith("ity"))     return w.slice(0, -3);
  if (w.length > 3 && w.endsWith("ies"))     return w.slice(0, -3) + "y";
  if (w.length > 3 && w.endsWith("ied"))     return w.slice(0, -3) + "y";
  if (w.length > 3 && w.endsWith("ous"))     return w.slice(0, -3);
  if (w.length > 3 && w.endsWith("ive"))     return w.slice(0, -3);
  if (w.length > 3 && w.endsWith("ize"))     return w.slice(0, -3);
  if (w.length > 3 && w.endsWith("ise"))     return w.slice(0, -3);
  if (w.length > 3 && w.endsWith("ers"))     return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("ied"))     return w.slice(0, -2);
  if (w.length > 2 && w.endsWith("er"))      return w.slice(0, -2);
  if (w.length > 2 && w.endsWith("ed"))      return w.slice(0, -2);
  if (w.length > 2 && w.endsWith("ly"))      return w.slice(0, -2);
  if (w.length > 2 && w.endsWith("es"))      return w.slice(0, -2);
  if (w.length > 1 && w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
}

// ═══════════════════════════════════════════════════════════════════════════
// TOKENIZE with stemming
// ═══════════════════════════════════════════════════════════════════════════
function tokenize(text, applyStem = false) {
  const tokens = (text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s\-\_\']/g, " ")
    .split(/\s+/)
    .filter(t => t.length > 1 && !STOP_WORDS.has(t));
  return applyStem ? tokens.map(stem) : tokens;
}

// ═══════════════════════════════════════════════════════════════════════════
// BUILD BIGRAMS from a token array
// ═══════════════════════════════════════════════════════════════════════════
function bigrams(tokens) {
  const bg = [];
  for (let i = 0; i < tokens.length - 1; i++) {
    bg.push(`${tokens[i]}_${tokens[i+1]}`);
  }
  return bg;
}

// ═══════════════════════════════════════════════════════════════════════════
// QUERY INTENT CLASSIFICATION
// ═══════════════════════════════════════════════════════════════════════════
function classifyIntent(query) {
  const q = query.toLowerCase();
  if (/^(what is|what are|who is|define|meaning of|explain)/i.test(q)) return "informational";
  if (/^(how to|how do|how can|steps to|tutorial|guide|learn)/i.test(q)) return "instructional";
  if (/^(best|top|vs|compare|review|recommend|versus)/i.test(q)) return "comparative";
  if (/\b(buy|price|purchase|shop|store|deal|discount|coupon)\b/i.test(q)) return "transactional";
  if (/\b(news|latest|today|breaking|current|recent|2024|2025|2026)\b/i.test(q)) return "news";
  if (/\b(download|install|get|setup|package|release)\b/i.test(q)) return "download";
  return "general";
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPAND QUERY with synonyms
// ═══════════════════════════════════════════════════════════════════════════
function expandQuery(queryTerms, rawQuery) {
  const expanded = new Set(queryTerms);
  const rawLower = rawQuery.toLowerCase();

  // Check for multi-word synonym keys
  for (const [phrase, syns] of Object.entries(SYNONYMS)) {
    if (rawLower.includes(phrase)) {
      syns.forEach(s => tokenize(s).forEach(t => expanded.add(t)));
    }
  }

  // Check single-term synonyms
  for (const term of queryTerms) {
    if (SYNONYMS[term]) {
      SYNONYMS[term].forEach(s => tokenize(s).forEach(t => expanded.add(t)));
    }
    // Also check stemmed form
    const stemmed = stem(term);
    if (SYNONYMS[stemmed]) {
      SYNONYMS[stemmed].forEach(s => tokenize(s).forEach(t => expanded.add(t)));
    }
  }

  return [...expanded];
}

// ═══════════════════════════════════════════════════════════════════════════
// IDF COMPUTATION — Inverse Document Frequency across corpus
// ═══════════════════════════════════════════════════════════════════════════
function computeIDF(pages, allQueryTerms) {
  const idf = {};
  const N = pages.length;
  for (const term of allQueryTerms) {
    const stemT = stem(term);
    let df = 0;
    for (const page of pages) {
      const allText = [page.title, page.description, page.content_snippet, ...(page.keywords || [])].join(" ").toLowerCase();
      if (allText.includes(term) || allText.includes(stemT)) df++;
    }
    // BM25 IDF formula: log((N - df + 0.5) / (df + 0.5) + 1)
    idf[term] = Math.log((N - df + 0.5) / (df + 0.5) + 1);
  }
  return idf;
}

// ═══════════════════════════════════════════════════════════════════════════
// BM25 FIELD SCORER
// k1 controls term saturation, b controls length normalization
// ═══════════════════════════════════════════════════════════════════════════
function bm25Field(tf, fieldLen, avgFieldLen, idfVal, k1 = 1.5, b = 0.75) {
  if (tf === 0 || idfVal <= 0) return 0;
  const norm = 1 - b + b * (fieldLen / Math.max(avgFieldLen, 1));
  return idfVal * ((tf * (k1 + 1)) / (tf + k1 * norm));
}

// ═══════════════════════════════════════════════════════════════════════════
// DOMAIN TIER — content authority signal (not link popularity)
// ═══════════════════════════════════════════════════════════════════════════
const AUTHORITY_TIERS = {
  // Tier 1: Canonical knowledge / primary sources
  tier1: new Set([
    "wikipedia.org","arxiv.org","pubmed.ncbi.nlm.nih.gov","ncbi.nlm.nih.gov",
    "nature.com","science.org","scholar.google.com","semanticscholar.org",
    "docs.python.org","developer.mozilla.org","docs.microsoft.com",
    "developer.android.com","developer.apple.com","docs.oracle.com",
    "w3.org","ietf.org","rfc-editor.org","ecma-international.org",
    "bitcoin.org","ethereum.org","docs.ethereum.org",
    "nvd.nist.gov","cve.mitre.org","csrc.nist.gov","owasp.org",
    "attack.mitre.org","law.cornell.edu","govinfo.gov",
    "eff.org","freedom.press","securedrop.org","torproject.org",
    "gnu.org","kernel.org","rust-lang.org","golang.org","python.org",
    "react.dev","vuejs.org","svelte.dev","nextjs.org","docs.soliditylang.org",
  ]),
  // Tier 2: High-quality specialist sources
  tier2: new Set([
    "stackoverflow.com","github.com","gitlab.com","npmjs.com",
    "theblock.co","coindesk.com","messari.io","defillama.com","dune.com",
    "krebsonsecurity.com","schneier.com","thedfirreport.com",
    "portswigger.net","exploit-db.com","bleepingcomputer.com",
    "darkreading.com","arstechnica.com","theregister.com",
    "propublica.org","theintercept.com","icij.org","occrp.org","bellingcat.com",
    "arxiv.org","ssrn.com","researchgate.net","doaj.org","core.ac.uk",
    "solana.com","cosmos.network","polkadot.network","chainlink.com",
    "uniswap.org","aave.com","compound.finance","curve.fi","lido.fi",
    "etherscan.io","bscscan.com","polygonscan.com","solscan.io",
    "hackthebox.com","tryhackme.com","ctftime.org","pwn.college",
    "privacyguides.org","whonix.org","shodan.io","haveibeenpwned.com",
  ]),
  // Tier 3: Reputable general / news sources
  tier3: new Set([
    "bbc.com","reuters.com","apnews.com","theguardian.com","nytimes.com",
    "wired.com","techcrunch.com","thenextweb.com","zdnet.com",
    "404media.co","cointelegraph.com","decrypt.co","bitcoinmagazine.com",
    "medium.com","substack.com","hackernews.com","news.ycombinator.com",
    "reddit.com","twitter.com","x.com",
  ]),
};

function getDomainAuthority(domain) {
  const d = (domain || "").toLowerCase();
  for (const t1 of AUTHORITY_TIERS.tier1) { if (d.includes(t1)) return 3; }
  for (const t2 of AUTHORITY_TIERS.tier2) { if (d.includes(t2)) return 2; }
  for (const t3 of AUTHORITY_TIERS.tier3) { if (d.includes(t3)) return 1; }
  return 0;
}

// ═══════════════════════════════════════════════════════════════════════════
// CONTENT TYPE SIGNALS — understand what kind of page this is
// ═══════════════════════════════════════════════════════════════════════════
function detectContentType(page) {
  const title = (page.title || "").toLowerCase();
  const desc  = (page.description || "").toLowerCase();
  const url   = (page.url || "").toLowerCase();
  const snippet = (page.content_snippet || "").toLowerCase();

  if (/\b(abstract|doi:|methodology|conclusion|references|citation)\b/.test(desc + snippet)) return "research";
  if (/\b(tutorial|step\s*\d|install|clone|npm|pip|cargo|brew)\b/.test(desc + snippet)) return "technical_guide";
  if (/\b(breaking|reported|according to|sources say|journalist)\b/.test(desc + snippet)) return "news";
  if (/\b(buy|cart|checkout|\$\d+|price|shipping|order)\b/.test(desc + snippet)) return "commercial";
  if (url.includes("/blog/") || url.includes("/post/") || url.includes("/article/")) return "blog";
  if (url.includes("/docs/") || url.includes("/documentation/") || url.includes("/reference/")) return "documentation";
  if (url.includes("/wiki/")) return "wiki";
  if (/\b(terms of service|privacy policy|cookie policy|gdpr)\b/.test(title + desc)) return "legal_boilerplate";
  return "general";
}

// ═══════════════════════════════════════════════════════════════════════════
// INTENT ↔ CONTENT TYPE COMPATIBILITY BONUS
// ═══════════════════════════════════════════════════════════════════════════
function intentContentBonus(intent, contentType) {
  const matrix = {
    informational: { wiki: 1.3, research: 1.25, documentation: 1.2, blog: 1.0, general: 1.0, news: 0.9, commercial: 0.6, legal_boilerplate: 0.3 },
    instructional:  { technical_guide: 1.4, documentation: 1.3, blog: 1.1, wiki: 1.1, general: 1.0, research: 0.8, commercial: 0.5, legal_boilerplate: 0.2 },
    comparative:    { blog: 1.2, wiki: 1.1, news: 1.1, general: 1.0, technical_guide: 1.0, research: 1.0, commercial: 0.7, legal_boilerplate: 0.2 },
    news:           { news: 1.4, blog: 1.1, general: 1.0, wiki: 0.9, research: 0.8, technical_guide: 0.7, commercial: 0.5, legal_boilerplate: 0.2 },
    transactional:  { commercial: 1.3, general: 1.0, blog: 0.8, wiki: 0.7, research: 0.5, legal_boilerplate: 0.2 },
    download:       { technical_guide: 1.3, documentation: 1.2, blog: 1.0, general: 1.0, wiki: 0.9, legal_boilerplate: 0.2 },
    general:        { wiki: 1.1, documentation: 1.1, research: 1.1, technical_guide: 1.0, blog: 1.0, news: 1.0, general: 1.0, commercial: 0.8, legal_boilerplate: 0.3 },
  };
  return (matrix[intent] || matrix.general)[contentType] || 1.0;
}

// ═══════════════════════════════════════════════════════════════════════════
// POSITIONAL / PROXIMITY SCORING
// How close query terms appear to each other in text (semantic proximity)
// ═══════════════════════════════════════════════════════════════════════════
function proximityScore(text, queryTerms) {
  if (queryTerms.length < 2) return 0;
  const words = tokenize(text);
  const positions = {};
  words.forEach((w, i) => {
    const s = stem(w);
    for (const qt of queryTerms) {
      if (w === qt || s === stem(qt)) {
        if (!positions[qt]) positions[qt] = [];
        positions[qt].push(i);
      }
    }
  });

  const covered = Object.keys(positions);
  if (covered.length < 2) return 0;

  // Find minimum span window containing all query terms
  let minSpan = Infinity;
  const posArrays = covered.map(t => positions[t]);
  const indices = posArrays.map(() => 0);

  for (let iter = 0; iter < 500; iter++) {
    const current = indices.map((idx, i) => posArrays[i][idx]);
    const span = Math.max(...current) - Math.min(...current);
    if (span < minSpan) minSpan = span;
    // Advance the pointer with the minimum position
    const minIdx = current.indexOf(Math.min(...current));
    indices[minIdx]++;
    if (indices[minIdx] >= posArrays[minIdx].length) break;
  }

  // Closer = better: span of 1 = adjacent (max bonus), span > 50 = no bonus
  return minSpan === Infinity ? 0 : Math.max(0, 1 - minSpan / 50);
}

// ═══════════════════════════════════════════════════════════════════════════
// LINGUISTIC DIVERSITY — reward pages that cover query from multiple angles
// ═══════════════════════════════════════════════════════════════════════════
function linguisticDiversity(page, queryTerms) {
  // Count how many DISTINCT query terms appear across DIFFERENT fields
  const fields = {
    title: (page.title || "").toLowerCase(),
    description: (page.description || "").toLowerCase(),
    snippet: (page.content_snippet || "").toLowerCase(),
    keywords: (page.keywords || []).join(" ").toLowerCase(),
  };
  let fieldCoverage = 0;
  for (const term of queryTerms) {
    const stemT = stem(term);
    let termFieldCount = 0;
    for (const text of Object.values(fields)) {
      if (text.includes(term) || text.includes(stemT)) termFieldCount++;
    }
    // A term appearing in 3+ fields = semantically embedded in the page
    if (termFieldCount >= 3) fieldCoverage += 1.5;
    else if (termFieldCount >= 2) fieldCoverage += 1.0;
    else if (termFieldCount >= 1) fieldCoverage += 0.5;
  }
  return fieldCoverage / Math.max(queryTerms.length, 1);
}

// ═══════════════════════════════════════════════════════════════════════════
// ANTI-SEO PENALTY COMPUTATION
// ═══════════════════════════════════════════════════════════════════════════
function antiSEOPenalty(page, queryTerms) {
  let penalty = 1.0;
  const title = (page.title || "");
  const url = (page.url || "");

  try {
    const parsed = new URL(url);
    const path = parsed.pathname;
    const dashCount = (path.match(/-/g) || []).length;
    const segCount = path.split("/").filter(Boolean).length;

    // Over-optimised slug
    if (dashCount > 7) penalty *= 0.75;
    else if (dashCount > 4) penalty *= 0.90;

    // Buried deep in site hierarchy
    if (segCount > 6) penalty *= 0.85;

    // Query parameters = dynamic / paginated pages
    if (parsed.search && parsed.search.length > 10) penalty *= 0.80;
  } catch {}

  // Title keyword stuffing
  const titleTokens = tokenize(title);
  const queryHits = queryTerms.filter(t => title.toLowerCase().includes(t)).length;
  if (titleTokens.length > 3) {
    const density = queryHits / titleTokens.length;
    if (density > 0.7) penalty *= 0.70; // extremely stuffed
    else if (density > 0.5) penalty *= 0.85;
  }

  // Boilerplate detection: privacy policies, ToS pages
  const lowerTitle = title.toLowerCase();
  if (/privacy policy|terms of service|cookie notice|gdpr/.test(lowerTitle)) penalty *= 0.20;
  if (/404|page not found|error/.test(lowerTitle)) penalty *= 0.10;

  // Thin content
  const wordCount = page.word_count || 0;
  if (wordCount < 50)  penalty *= 0.30;
  else if (wordCount < 150) penalty *= 0.60;
  else if (wordCount < 300) penalty *= 0.80;

  return penalty;
}

// ═══════════════════════════════════════════════════════════════════════════
// FRESHNESS SCORE
// ═══════════════════════════════════════════════════════════════════════════
function freshnessScore(page, intent) {
  if (!page.last_crawled) return 1.0;
  const ageDays = (Date.now() - new Date(page.last_crawled).getTime()) / 86400000;

  // News intent: freshness is critical
  if (intent === "news") {
    if (ageDays < 1)   return 2.0;
    if (ageDays < 7)   return 1.5;
    if (ageDays < 30)  return 1.1;
    if (ageDays > 90)  return 0.6;
    return 0.8;
  }
  // Other intents: freshness matters less for evergreen content
  if (ageDays < 7)   return 1.15;
  if (ageDays < 30)  return 1.05;
  if (ageDays < 180) return 1.0;
  if (ageDays < 365) return 0.95;
  return 0.90;
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN SCORING FUNCTION
// ═══════════════════════════════════════════════════════════════════════════
function scorePage(page, queryTerms, expandedTerms, idf, avgLens, intent) {
  if (!queryTerms.length) return 0;

  const titleTokens  = tokenize(page.title);
  const descTokens   = tokenize(page.description);
  const snippetTokens= tokenize(page.content_snippet);
  const kwTokens     = (page.keywords || []).flatMap(k => tokenize(k));

  const titleStemmed   = titleTokens.map(stem);
  const descStemmed    = descTokens.map(stem);
  const snippetStemmed = snippetTokens.map(stem);
  const kwStemmed      = kwTokens.map(stem);

  const titleLower   = (page.title || "").toLowerCase();
  const descLower    = (page.description || "").toLowerCase();
  const snippetLower = (page.content_snippet || "").toLowerCase();
  const allText      = [titleLower, descLower, snippetLower, (page.keywords||[]).join(" ").toLowerCase()].join(" ");

  // ── 1. QUERY COVERAGE CHECK ──────────────────────────────────────────────
  // Core query terms must have some match, else page is irrelevant
  const coreHits = queryTerms.filter(t => allText.includes(t) || allText.includes(stem(t)));
  const coverage = coreHits.length / queryTerms.length;
  if (coverage === 0) return 0; // Zero relevance = skip entirely

  // ── 2. EXACT PHRASE MATCH ────────────────────────────────────────────────
  const fullPhrase = queryTerms.join(" ");
  let phraseBonus = 0;
  if (titleLower.includes(fullPhrase))   phraseBonus = 50;
  else if (descLower.includes(fullPhrase))    phraseBonus = 25;
  else if (snippetLower.includes(fullPhrase)) phraseBonus = 12;

  // ── 3. BM25 SCORING PER FIELD ─────────────────────────────────────────────
  // Use both original and stemmed forms; take the max contribution
  let bm25Score = 0;
  const termsToScore = [...new Set([...queryTerms, ...queryTerms.map(stem)])];

  for (const term of termsToScore) {
    const idfVal = idf[term] || idf[stem(term)] || 0.5;

    // Count TF in each field (exact + stemmed)
    const tf_title   = titleStemmed.filter(t => t === term || t === stem(term)).length
                     + titleTokens.filter(t => t === term).length;
    const tf_desc    = descStemmed.filter(t => t === term || t === stem(term)).length
                     + descTokens.filter(t => t === term).length;
    const tf_snippet = snippetStemmed.filter(t => t === term || t === stem(term)).length
                     + snippetTokens.filter(t => t === term).length;
    const tf_kw      = kwStemmed.filter(t => t === term || t === stem(term)).length
                     + kwTokens.filter(t => t === term).length;

    // BM25 per field with different k1 (saturation) settings
    bm25Score += bm25Field(tf_title,   titleTokens.length,   avgLens.title,   idfVal, 1.2, 0.75) * 4.0; // title weight highest
    bm25Score += bm25Field(tf_kw,      kwTokens.length,      avgLens.kw,      idfVal, 1.2, 0.5)  * 3.0; // keywords
    bm25Score += bm25Field(tf_desc,    descTokens.length,    avgLens.desc,    idfVal, 1.5, 0.75) * 2.0; // description
    bm25Score += bm25Field(tf_snippet, snippetTokens.length, avgLens.snippet, idfVal, 1.5, 0.75) * 1.0; // snippet
  }

  // ── 4. BIGRAM / PHRASE PROXIMITY ─────────────────────────────────────────
  const queryBigrams = bigrams(queryTerms);
  const titleBigrams = bigrams(titleStemmed);
  const descBigrams  = bigrams(descStemmed);
  let bigramBonus = 0;
  for (const bg of queryBigrams) {
    const [a, b] = bg.split("_");
    const bgStem = `${stem(a)}_${stem(b)}`;
    if (titleBigrams.includes(bg) || titleBigrams.includes(bgStem)) bigramBonus += 8;
    else if (descBigrams.includes(bg) || descBigrams.includes(bgStem)) bigramBonus += 4;
  }

  // ── 5. SEMANTIC PROXIMITY (word window) ──────────────────────────────────
  const proxTitle   = proximityScore(titleLower, queryTerms) * 12;
  const proxDesc    = proximityScore(descLower, queryTerms) * 6;
  const proxSnippet = proximityScore(snippetLower, queryTerms) * 3;
  const proximityTotal = proxTitle + proxDesc + proxSnippet;

  // ── 6. SYNONYM / EXPANDED TERM BONUS (weighted lower) ───────────────────
  const synonymTerms = expandedTerms.filter(t => !queryTerms.includes(t));
  let synonymBonus = 0;
  for (const t of synonymTerms) {
    if (allText.includes(t) || allText.includes(stem(t))) synonymBonus += 1.5;
  }

  // ── 7. POSITION BONUS — term at start of title = high intent match ───────
  let positionBonus = 0;
  for (const term of queryTerms) {
    if (titleLower.startsWith(term)) positionBonus += 10;
    else if (titleLower.startsWith(queryTerms.slice(0, 2).join(" "))) positionBonus += 6;
  }

  // ── 8. LINGUISTIC DIVERSITY ───────────────────────────────────────────────
  const diversity = linguisticDiversity(page, queryTerms) * 8;

  // ── 9. CONTENT AUTHORITY ──────────────────────────────────────────────────
  const domainTier = getDomainAuthority(page.domain);
  const authorityScore = [0, 3, 6, 12][domainTier]; // tier 1 = 12pts, tier 3 = 3pts

  // ── 10. CONTENT TYPE + INTENT COMPATIBILITY ──────────────────────────────
  const contentType = detectContentType(page);
  const intentMultiplier = intentContentBonus(intent, contentType);

  // ── 11. FRESHNESS ─────────────────────────────────────────────────────────
  const freshness = freshnessScore(page, intent);

  // ── 12. ANTI-SEO PENALTIES ───────────────────────────────────────────────
  const seoMult = antiSEOPenalty(page, queryTerms);

  // ── 13. COVERAGE MULTIPLIER ──────────────────────────────────────────────
  // Partial matches are penalised exponentially
  const coverageMult = Math.pow(coverage, 1.5);

  // ── COMBINE ──────────────────────────────────────────────────────────────
  // Relevance signals (BM25, phrase, proximity, bigrams, synonyms, diversity, position)
  const relevanceScore = bm25Score + phraseBonus + bigramBonus + proximityTotal
                       + synonymBonus + positionBonus + diversity;

  // Authority is additive but capped relative to relevance
  const authorityAdditive = Math.min(authorityScore, relevanceScore * 0.25);

  const rawScore = (relevanceScore + authorityAdditive) * coverageMult * intentMultiplier * freshness * seoMult;

  return rawScore;
}

// ═══════════════════════════════════════════════════════════════════════════
// DEDUPLICATE — max N results per domain
// ═══════════════════════════════════════════════════════════════════════════
function deduplicateByDomain(results, maxPerDomain = 2) {
  const domainCount = {};
  return results.filter(r => {
    const d = r.domain || "unknown";
    domainCount[d] = (domainCount[d] || 0) + 1;
    return domainCount[d] <= maxPerDomain;
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// HANDLER
// ═══════════════════════════════════════════════════════════════════════════
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const body = await req.json().catch(() => ({}));
  const { query, limit = 15 } = body;

  if (!query || !query.trim()) {
    return Response.json({ results: [], total: 0 });
  }

  // ── Parse and expand query ───────────────────────────────────────────────
  const rawQuery     = query.trim();
  const intent       = classifyIntent(rawQuery);
  const coreTerms    = [...new Set(tokenize(rawQuery))];
  const expandedTerms= expandQuery(coreTerms, rawQuery);

  if (coreTerms.length === 0) {
    return Response.json({ results: [], total: 0 });
  }

  // ── Fetch pages ──────────────────────────────────────────────────────────
  const allPages = await base44.asServiceRole.entities.IndexedPage.filter(
    { status: "active" }, "-last_crawled", 2000
  );

  if (allPages.length === 0) {
    return Response.json({ results: [], total: 0, from_index: false });
  }

  // ── Compute IDF across corpus ────────────────────────────────────────────
  const idf = computeIDF(allPages, [...new Set([...expandedTerms, ...expandedTerms.map(stem)])]);

  // ── Compute average field lengths ────────────────────────────────────────
  const avgLens = {
    title:   allPages.reduce((s, p) => s + tokenize(p.title).length,   0) / allPages.length,
    desc:    allPages.reduce((s, p) => s + tokenize(p.description).length, 0) / allPages.length,
    snippet: allPages.reduce((s, p) => s + tokenize(p.content_snippet).length, 0) / allPages.length,
    kw:      allPages.reduce((s, p) => s + (p.keywords || []).length,   0) / allPages.length,
  };

  // ── Score all pages ──────────────────────────────────────────────────────
  const scored = allPages
    .map(page => ({ page, score: scorePage(page, coreTerms, expandedTerms, idf, avgLens, intent) }))
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score);

  // ── Deduplicate ──────────────────────────────────────────────────────────
  const deduped = deduplicateByDomain(
    scored.map(r => ({
      title:        r.page.title || r.page.url,
      url:          r.page.url,
      description:  r.page.description || r.page.content_snippet || "",
      domain:       r.page.domain,
      score:        r.score,
      intent,
      content_type: detectContentType(r.page),
      quality_score:r.page.quality_score,
      word_count:   r.page.word_count,
      last_crawled: r.page.last_crawled,
    }))
  );

  return Response.json({
    results: deduped.slice(0, limit),
    total: scored.length,
    from_index: true,
    intent,
  });
});