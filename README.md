<p align="center">
  <img src="https://img.shields.io/badge/React-18-blue?logo=react" alt="React 18" />
  <img src="https://img.shields.io/badge/Vite-8-purple?logo=vite" alt="Vite 8" />
  <img src="https://img.shields.io/badge/TailwindCSS-3-06B6D4?logo=tailwindcss" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/Capacitor-8-119EFF?logo=capacitor" alt="Capacitor" />
  <img src="https://img.shields.io/badge/License-Private-red" alt="License" />
</p>

# Nebula Search Engine

A privacy-first, federated open-web search engine that ranks results by relevance rather than ad spend. Nebula federates queries across **20+ public APIs** simultaneously, pages through every available hit (no hard result cap), and indexes discovered pages as users search so the corpus grows organically with every query.

> **Philosophy:** Search results should be tailored to relevancy, not payment amount. Nebula filters spam, ranks by content quality and domain authority, and exposes which engine contributed each result.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [System Design](#system-design)
  - [Federated Search Pipeline](#federated-search-pipeline)
  - [Ranking Algorithm](#ranking-algorithm)
  - [Search-Driven Indexing](#search-driven-indexing)
  - [Crawl System](#crawl-system)
- [Integrated Search Engines](#integrated-search-engines)
- [Data Model](#data-model)
- [Project Structure](#project-structure)
- [Pages and Routes](#pages-and-routes)
- [API Reference](#api-reference)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Testing](#testing)
- [Build and Deployment](#build-and-deployment)
- [Android Build](#android-build)
- [Tech Stack](#tech-stack)
- [Support](#support)

Explore federates Wikipedia, DuckDuckGo, GitHub, academic APIs, archive indexes, and optional Brave/Bing/Google/Mojeek keys. It pages through every available hit instead of stopping at the first SERP, then indexes discovered pages (and their outbound links) as people search so the corpus keeps growing.

**Prerequisites:** 

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Browser (React SPA)                         │
│                                                                     │
│  ┌──────────┐  ┌─────────────────┐  ┌───────────────────────────┐  │
│  │  Home    │  │  SearchResults  │  │  CrawlerDashboard (admin) │  │
│  └────┬─────┘  └───────┬─────────┘  └──────────┬────────────────┘  │
│       │                │                        │                   │
│       └────────┬───────┘                        │                   │
│                ▼                                 │                   │
│  ┌──────────────────────────────┐               │                   │
│  │     runSearchSession()       │               │                   │
│  │  ┌───────────────────────┐   │               │                   │
│  │  │  ResultCollector      │   │               │                   │
│  │  │  (RRF + lexical)      │   │               │                   │
│  │  └───────────────────────┘   │               │                   │
│  └──────────┬───────────────────┘               │                   │
│             │ fans out in parallel               │                   │
│  ┌──────────▼───────────────────┐               │                   │
│  │  Client Engines (CORS)       │               │                   │
│  │  Wikipedia, Wikidata, MDN,   │               │                   │
│  │  GitHub, HN, SO, OpenAlex,   │               │                   │
│  │  arXiv, PubMed, Crossref,    │               │                   │
│  │  Archive.org, npm, crates,   │               │                   │
│  │  RubyGems, Packagist, HF,    │               │                   │
│  │  Gutenberg, iTunes, Openverse│               │                   │
│  └──────────────────────────────┘               │                   │
│                                                  │                   │
│  ┌──────────────────────────────┐               │                   │
│  │  Local Corpus (IndexedDB)    │◄──────────────┤                   │
│  │  Searched pages cached for   │  index-on-    │                   │
│  │  instant re-query            │  search       │                   │
│  └──────────────────────────────┘               │                   │
└─────────────────────────────────────────────────┼───────────────────┘
                                                  │
         ┌────────────────────────────────────────┼──────────────────┐
         │              Vite Dev Server            │                  │
         │  ┌────────────────────────┐            │                  │
         │  │  /api/search middleware│            │                  │
         │  │  Server engines:       │            │                  │
         │  │  DDG HTML, Bing RSS,   │            │                  │
         │  │  SearXNG, Brave*, Bing*│            │                  │
         │  │  Google CSE*, Mojeek*, │            │                  │
         │  │  Reddit                │            │                  │
         │  └────────────────────────┘            │                  │
         └────────────────────────────────────────┼──────────────────┘
                                                  │
         ┌────────────────────────────────────────┼──────────────────┐
         │              Base44 Backend (Deno)      │                  │
         │                                        │                  │
         │  ┌──────────────┐  ┌──────────────┐   │                  │
         │  │ searchIndex  │  │  webSearch   │   │                  │
         │  │ BM25 + IDF   │  │  DuckDuckGo  │   │                  │
         │  │ over indexed │  │  Wikipedia    │   │                  │
         │  │ pages        │  │  SearXNG      │   │                  │
         │  │              │  │  Bing RSS     │   │                  │
         │  │              │  │  Brave/Bing/  │   │                  │
         │  │              │  │  Google*      │   │                  │
         │  └──────────────┘  └──────────────┘   │                  │
         │                                        │                  │
         │  ┌──────────────┐  ┌──────────────┐   │                  │
         │  │indexOnSearch  │  │  crawlPage   │◄──┘                  │
         │  │ Upsert meta  │  │  seed / batch │                      │
         │  │ Deep-fetch 8 │  │  / rerank     │                      │
         │  │ Queue links  │  │  Depth 4      │                      │
         │  └──────────────┘  └──────────────┘                       │
         │                                                            │
         │  Entities: IndexedPage, CrawlQueue, SearchHistory,        │
         │            Bookmark, CrawlerStats, SavedPassword           │
         └────────────────────────────────────────────────────────────┘

* = requires optional API key
```

---

## System Design

### Federated Search Pipeline

Every search query triggers a parallel fan-out across multiple tiers of engines:

1. **Client-side engines** (21 CORS-friendly APIs) fire directly from the browser. Results stream into the UI as each resolves.
2. **Server-side engines** (up to 8) run through the Vite middleware at `/api/search`, which can scrape HTML endpoints and use API-key-gated services.
3. **Base44 backend functions** (`webSearch`, `searchIndex`) provide persistent index queries and server-side web scraping with multi-page pagination.
4. **Local corpus** (IndexedDB, memory fallback) returns instant hits from previously indexed pages.

All results merge into a single `ResultCollector` that deduplicates by canonical URL and ranks using **Reciprocal Rank Fusion (RRF)** combined with **lexical scoring**:

```
score(page) = RRF_weight * 80 + lexical_score(page, query_terms)
```

The `onPartial` callback streams intermediate snapshots to the React UI so results appear progressively.

### Ranking Algorithm

#### Client-side ranking (ResultCollector)

| Signal | Weight | Description |
|--------|--------|-------------|
| RRF score | `1/(K+rank+1)`, K=60 | Position-based fusion across all engines |
| Lexical match | Title: +8/term, Description: +2/term, Keywords: +3/term | Token overlap with query |
| Phrase bonus | +18 (title), +8 (description) | Exact phrase match |
| Quality score | 0.0-0.98 multiplier | Domain authority + metadata richness |
| Multi-source | RRF compounds per engine | Pages found by multiple engines rank higher |

#### Server-side ranking (searchIndex - BM25)

The `searchIndex` function runs a full **BM25** implementation with field-weighted scoring:

| Component | Description |
|-----------|-------------|
| BM25 with IDF | `log((N - df + 0.5) / (df + 0.5) + 1)` per term |
| Field weights | Title: 4x, Keywords: 3x, Description: 2x, Snippet: 1x |
| Stemming | Porter-lite suffix stripping |
| Synonym expansion | 50+ synonym groups for tech, crypto, security, science |
| Intent classification | 7 classes: informational, instructional, comparative, transactional, news, download, general |
| Anti-SEO penalties | Keyword stuffing, over-optimized slugs, thin content, boilerplate detection |
| Freshness scoring | News queries: 2x boost for <1 day old; evergreen: gentler decay |
| Domain authority tiers | Tier 1 (canonical): +12pts, Tier 2 (specialist): +6pts, Tier 3 (reputable): +3pts |
| Proximity scoring | Minimum-span window of query terms in text |
| Bigram matching | Adjacent query-term pairs in title/description |

### Search-Driven Indexing

Every search session triggers a background indexing pass:

1. **Local corpus** (browser-side): All result URLs, titles, and descriptions are upserted into IndexedDB (or an in-memory Map fallback, capped at 8,000 pages).
2. **Remote indexing** (`indexOnSearch` function): The top 40 results are sent to the backend, which:
   - Upserts metadata for each URL into the `IndexedPage` entity
   - Deep-fetches the top 8 pages to extract full body text, keywords, and outbound links
   - Queues discovered outbound links (up to 12 per page) into the `CrawlQueue` for future crawling

This means the index grows passively with every search, and the crawler queue continuously expands without manual intervention.

### Crawl System

The admin-only `CrawlerDashboard` manages a persistent breadth-first web crawler:

| Action | Description |
|--------|-------------|
| `seed` | Loads 770+ seed URLs across news, crypto, DeFi, security, privacy, academic, government, and OSINT domains into the crawl queue |
| `crawl_batch` | Processes 5 pending URLs: fetches HTML, extracts title/description/keywords/links, computes quality scores, saves to index, queues outbound links |
| `rerank` | Recomputes PageRank and quality scores for all indexed pages |

Crawl parameters:
- **Max depth**: 4 hops from seed
- **Max links per page**: 40 extracted, 25 enqueued
- **Quality scoring**: Content depth (0-0.35) + Title quality (0-0.15) + Description quality (0-0.20) + Inbound links (0-0.15) + URL cleanliness (0-0.15)
- **PageRank**: `base(1.0) + log1p(inbound_links) * 0.5 + domain_authority`

---

## Integrated Search Engines

### Client-Side Engines (CORS, no API key required)

| Engine | API | Max Results | Content Types |
|--------|-----|-------------|---------------|
| Wikipedia | MediaWiki Search API | 250 (paginated) | Wiki articles |
| Wikidata | wbsearchentities | 40 | Knowledge graph entities |
| DuckDuckGo | Instant Answer API | Varies | Web instant answers |
| MDN Web Docs | MDN Search API | 50 | Developer documentation |
| GitHub | REST Search API | 100 | Repositories |
| Hacker News | Algolia HN API | 80 | Tech discussions |
| Stack Overflow | Stack Exchange API v2.3 | 80 | Q&A threads |
| OpenAlex | Works API | 150 | Academic papers |
| Semantic Scholar | Graph API v1 | 80 | Research papers |
| Crossref | Works API | 80 | DOI metadata |
| PubMed | E-utilities (esearch+esummary) | 80 | Biomedical literature |
| arXiv | Atom API | 80 | Preprints |
| Internet Archive | Advanced Search | 120 (paginated) | Archived content |
| Open Library | Search API | 80 | Books |
| npm | Registry Search | 40 | JavaScript packages |
| crates.io | Crate Search API | 30 | Rust packages |
| RubyGems | Search API | 30 | Ruby packages |
| Packagist | Search API | 30 | PHP packages |
| Hugging Face | Models API | 40 | ML models |
| Project Gutenberg | Gutendex API | 30 | Public domain books |
| iTunes | Search API | 20 | Media (music, apps, podcasts) |
| Openverse | Images API | 30 | Open-licensed media |

### Server-Side Engines (Vite middleware + Base44 functions)

| Engine | Method | API Key Required | Max Results |
|--------|--------|-----------------|-------------|
| DuckDuckGo HTML | HTML scraping + pagination | No | 600 (20 pages) |
| Bing RSS | RSS feed parsing with query variants | No | 80 |
| SearXNG | Public instances (failover) | No | 80 |
| Reddit | JSON search API | No | 60 |
| Brave Search | Web Search API | `BRAVE_SEARCH_API_KEY` | 200 |
| Bing | Web Search API v7 | `BING_SEARCH_API_KEY` | 150 |
| Google CSE | Custom Search JSON API | `GOOGLE_API_KEY` + `GOOGLE_CSE_ID` | 100 |
| Mojeek | Search API | `MOJEEK_API_KEY` | 100 |

---

## Data Model

All entities are managed through the Base44 SDK and stored in the Base44 backend.

### IndexedPage

The core search index entity.

| Field | Type | Description |
|-------|------|-------------|
| `url` | string (required) | Canonical page URL |
| `domain` | string (required) | Extracted hostname |
| `title` | string | Page title |
| `description` | string | Meta description |
| `content_snippet` | string | First 500 chars of body text |
| `keywords` | string[] | Top 20 extracted keywords by frequency |
| `inbound_links` | number | Count of other indexed pages linking here |
| `outbound_links` | number | Count of links found on this page |
| `page_rank` | number | Computed PageRank score |
| `quality_score` | number | 0-1 content quality score |
| `final_score` | number | Combined ranking score |
| `language` | string | Detected language code |
| `word_count` | number | Total words on page |
| `crawl_depth` | number | Hops from seed URL |
| `last_crawled` | datetime | Timestamp of last crawl |
| `status` | enum | `active`, `error`, `duplicate` |

### CrawlQueue

Pending URLs discovered during crawling or search-driven indexing.

| Field | Type | Description |
|-------|------|-------------|
| `url` | string (required) | URL to crawl |
| `domain` | string (required) | Target domain |
| `depth` | number | Current crawl depth |
| `priority` | number | 1-10, higher = crawl sooner |
| `source_url` | string | Referring page URL |
| `status` | enum | `pending`, `processing`, `done`, `failed` |
| `attempts` | number | Retry count |

### SearchHistory

| Field | Type | Description |
|-------|------|-------------|
| `query` | string (required) | Search query text |
| `results_count` | number | Number of results returned |

### Bookmark

| Field | Type | Description |
|-------|------|-------------|
| `url` | string (required) | Bookmarked URL |
| `title` | string (required) | Page title |
| `description` | string | Page description or note |
| `favicon` | string | Favicon URL |
| `collection` | string | Folder name (default: `General`) |
| `tags` | string[] | User-defined tags |

---

## Project Structure

```
nebula.search.engine/
├── base44/
│   ├── entities/                    # Data model schemas (JSONC)
│   │   ├── IndexedPage.jsonc
│   │   ├── CrawlQueue.jsonc
│   │   ├── SearchHistory.jsonc
│   │   ├── Bookmark.jsonc
│   │   ├── CrawlerStats.jsonc
│   │   └── SavedPassword.jsonc
│   └── functions/                   # Base44 serverless functions (Deno)
│       ├── searchIndex/entry.ts     # BM25 search over indexed pages
│       ├── webSearch/entry.ts       # Federated web search (server-side)
│       ├── indexOnSearch/entry.ts   # Index pages discovered during search
│       └── crawlPage/entry.ts      # Web crawler: seed, batch crawl, rerank
│
├── src/
│   ├── api/
│   │   └── base44Client.js          # Base44 SDK client initialization
│   ├── lib/
│   │   ├── search/                  # Federated search engine core
│   │   │   ├── index.js             # Public API re-exports
│   │   │   ├── orchestrator.js      # Fan-out coordinator + time budget
│   │   │   ├── run-search.js        # Full search session with indexing
│   │   │   ├── collector.js         # ResultCollector (RRF + lexical merge)
│   │   │   ├── local-corpus.js      # IndexedDB/memory local page store
│   │   │   ├── query-expand.js      # Intent classification + expansions
│   │   │   ├── server-plugin.js     # Vite middleware for /api/search
│   │   │   ├── utils.js             # URL canonicalization, scoring, parsing
│   │   │   ├── utils.test.js        # Vitest test suite (15 tests)
│   │   │   └── engines/             # Individual search engine adapters
│   │   │       ├── index.js         # Engine registry + selector
│   │   │       ├── wikipedia.js     # Wikipedia + Wikidata
│   │   │       ├── duckduckgo.js    # DDG instant + HTML pagination
│   │   │       ├── academic.js      # OpenAlex, S2, Crossref, PubMed, arXiv
│   │   │       ├── community.js     # GitHub, HN, Stack Overflow, Reddit
│   │   │       ├── open-web.js      # Archive.org, MDN, npm, crates, etc.
│   │   │       └── server-web.js    # SearXNG, Brave, Bing, Google CSE, Mojeek
│   │   ├── AuthContext.jsx
│   │   ├── query-client.js
│   │   └── utils.js
│   ├── pages/
│   │   ├── Home.jsx                 # Search landing page
│   │   ├── SearchResults.jsx        # Federated results with streaming UI
│   │   ├── CrawlerDashboard.jsx     # Admin crawler controls + stats
│   │   ├── Analytics.jsx            # Search analytics + charts
│   │   ├── TrendingSearches.jsx     # Popular queries
│   │   ├── Bookmarks.jsx            # Saved bookmarks by collection
│   │   ├── Saved.jsx                # Quick-saved items
│   │   ├── Passwords.jsx            # Encrypted password vault
│   │   └── VPNComparison.jsx        # VPN comparison table
│   ├── components/
│   │   ├── search/
│   │   │   ├── SearchBar.jsx        # Autocomplete with history
│   │   │   ├── SearchResultItem.jsx # Result card with source badges
│   │   │   ├── SearchFilters.jsx    # Sort, content type, quality, domain hide
│   │   │   ├── SearchSkeleton.jsx   # Loading skeleton
│   │   │   ├── CategoryFilter.jsx   # Category chips
│   │   │   ├── QuickLinks.jsx       # Home page quick links
│   │   │   └── RecentSearches.jsx   # History display
│   │   ├── layout/
│   │   │   ├── NavBar.jsx
│   │   │   └── MobileNavMenu.jsx
│   │   └── ui/                      # shadcn/ui component library
│   └── App.jsx                      # Router + auth provider
│
├── vite.config.js                   # Vite 8 + search middleware plugin
├── vitest.config.js                 # Test configuration
├── tailwind.config.js               # Tailwind CSS v3 theme
├── capacitor.config.ts              # Android build config
├── .github/workflows/
│   └── deploy-pages.yml             # GitHub Pages CI/CD
└── package.json
```

---

## Pages and Routes

| Route | Component | Auth | Description |
|-------|-----------|------|-------------|
| `/` | `Home` | Public | Search landing page with category chips and recent searches |
| `/search?q=` | `SearchResults` | Public | Federated results with streaming, filters, and infinite scroll |
| `/crawler` | `CrawlerDashboard` | Admin | Seed URLs, start/stop crawler, view stats, re-rank index |
| `/analytics` | `Analytics` | Public | Search volume charts, category breakdown, query analytics |
| `/trending` | `TrendingSearches` | Public | Popular recent queries |
| `/bookmarks` | `Bookmarks` | Auth | Bookmarks organized by collection |
| `/saved` | `Saved` | Auth | Quick-saved results |
| `/passwords` | `Passwords` | Auth | Encrypted password manager |
| `/vpn` | `VPNComparison` | Public | VPN service comparison table |

---

## API Reference

### Vite Middleware

#### `GET /api/search`

Federated search endpoint served by the Vite dev/preview server.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `q` | string | required | Search query |
| `cursor` | string | — | Pagination cursor for continued DDG results |

**Response:**

```json
{
  "results": [
    {
      "title": "JavaScript - Wikipedia",
      "url": "https://en.wikipedia.org/wiki/JavaScript",
      "description": "...",
      "domain": "en.wikipedia.org",
      "content_type": "wiki",
      "quality_score": 0.85,
      "score": 42.7,
      "source": "wikipedia",
      "sources": ["wikipedia", "duckduckgo", "bing-rss"]
    }
  ],
  "total": 1107,
  "returned": 1107,
  "sources": { "wikipedia": 250, "github": 100, "..." : "..." },
  "intent": "general",
  "hasMore": false,
  "cursor": null,
  "elapsed_ms": 11200
}
```

### Base44 Functions

| Function | Action | Description |
|----------|--------|-------------|
| `searchIndex` | — | BM25 search over all `IndexedPage` records |
| `webSearch` | — | Server-side federated web search (DDG + Wikipedia + SearXNG + Bing RSS + keyed engines) |
| `indexOnSearch` | — | Upsert discovered pages, deep-fetch top 8, queue outbound links |
| `crawlPage` | `seed` | Load 770+ seed URLs into the crawl queue |
| `crawlPage` | `crawl_batch` | Process N pending URLs from the queue |
| `crawlPage` | `rerank` | Recompute scores for all indexed pages |

---

## Getting Started

### Prerequisites

- **Node.js** >= 18
- **npm** >= 9
- A [Base44](https://base44.com) account (for backend entities and functions)

### Installation

```bash
git clone https://github.com/DERK333/nebula.search.engine.git
cd nebula.search.engine
npm install
```

### Configuration

Create an `.env.local` file in the project root:

```env
VITE_BASE44_APP_ID=your_app_id
VITE_BASE44_APP_BASE_URL=https://your-app.base44.app
```

### Run

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

---

## Environment Variables

### Required

| Variable | Description |
|----------|-------------|
| `VITE_BASE44_APP_ID` | Base44 application ID |
| `VITE_BASE44_APP_BASE_URL` | Base44 backend URL |

### Optional Search Engine API Keys

Adding these keys enables additional search engines with deeper pagination. Without them, the app still federates across all free/CORS-friendly APIs.

| Variable | Engine | Free Tier |
|----------|--------|-----------|
| `BRAVE_SEARCH_API_KEY` | [Brave Search API](https://brave.com/search/api/) | 2,000 queries/mo |
| `BING_SEARCH_API_KEY` | [Bing Web Search API v7](https://www.microsoft.com/en-us/bing/apis/bing-web-search-api) | 1,000 transactions/mo |
| `GOOGLE_API_KEY` | [Google Custom Search JSON API](https://developers.google.com/custom-search) | 100 queries/day |
| `GOOGLE_CSE_ID` | Google Programmable Search Engine ID | — |
| `MOJEEK_API_KEY` | [Mojeek Search API](https://www.mojeek.com/services/api.html) | Varies |
| `SEARXNG_URL` | Self-hosted SearXNG instance URL | Self-hosted |

Keys can be prefixed with `VITE_` for client-side access or set without prefix for server-side only.

---

## Testing

The project uses [Vitest](https://vitest.dev/) for unit testing.

```bash
npm test          # Single run
npm run test:watch  # Watch mode
# Optional search-engine API keys (used by the Vite search proxy and Base44 webSearch function)
BRAVE_SEARCH_API_KEY=
BING_SEARCH_API_KEY=
GOOGLE_API_KEY=
GOOGLE_CSE_ID=
MOJEEK_API_KEY=
SEARXNG_URL=
```

### Test Coverage

The test suite (`src/lib/search/utils.test.js`) covers:

| Area | Tests |
|------|-------|
| URL canonicalization | Tracking param removal, `www.` normalization, hash stripping |
| HTML entity decoding | Double-unescape prevention (`&amp;` decoded last) |
| Content type inference | Wiki, repository, research, documentation detection |
| Document scoring | Term coverage, title/description/keyword matching |
| Query expansion | Intent classification, synonym expansion, site-scoped queries |
| Result collector | URL deduplication, RRF fusion, lexical re-ranking |
| DuckDuckGo parsers | HTML result extraction, offset pagination, instant answer topics |
| Wikipedia engine | Paginated search + OpenSearch suggestions |
| Bing RSS parser | XML item extraction |
| OpenAlex abstracts | Inverted index reconstruction |
| Federated orchestrator | Multi-engine fan-out with failure isolation |
| Local corpus | IndexedDB upsert + memory fallback + query matching |
| Search session | End-to-end merge of client engines, local corpus, and backend functions |

### Linting

```bash
npm run lint      # Check for issues
npm run lint:fix  # Auto-fix
```

---

## Build and Deployment

### Production Build

```bash
npm run build
npm run preview   # Preview locally
```

### GitHub Pages

The repository includes a GitHub Actions workflow (`.github/workflows/deploy-pages.yml`) that automatically builds and deploys to GitHub Pages on push to `main`.

1. Push to `main`
2. GitHub Actions builds with `npm run build`
3. Deploys `dist/` to GitHub Pages with SPA fallback (`404.html`)

Published URL: `https://<username>.github.io/nebula.search.engine/`

### Manual Deploy

Click [Open Sesame](https://base44.com) and click **Publish** in the Base44 dashboard.

---

## Android Build

Nebula supports native Android builds via [Capacitor](https://capacitorjs.com/).

```bash
npm run android:sync   # Build web assets + sync to Android project
npm run android:apk    # Build debug APK
```

Output APK: `android/app/build/outputs/apk/debug/app-debug.apk`

Capacitor config:
- App ID: `com.nebulasearch.engine`
- App Name: `Nebula Search Engine`
- Web directory: `dist`

---

## Tech Stack

### Frontend

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18 | UI framework |
| Vite | 8 | Build tool + dev server + search middleware |
| React Router | 7 | Client-side routing |
| TanStack React Query | 5 | Server state management + caching |
| Tailwind CSS | 3 | Utility-first styling |
| Framer Motion | 11 | Animations and transitions |
| Radix UI | Various | Accessible headless components (via shadcn/ui) |
| Recharts | 2 | Analytics charts |
| Lucide React | 0.475 | Icon library |
| Vitest | 3 | Unit testing framework |

### Backend

| Technology | Purpose |
|------------|---------|
| Base44 SDK | Entity management, authentication, serverless functions |
| Deno (Base44 runtime) | Server-side function execution |

### Mobile

| Technology | Version | Purpose |
|------------|---------|---------|
| Capacitor | 8 | Native Android bridge |

### CI/CD

| Tool | Purpose |
|------|---------|
| GitHub Actions | Build + deploy to GitHub Pages |
| CodeQL | Security scanning |
| ESLint 9 | Code quality |

---


## Support


- **Documentation**: [https://docs.base44.com/Integrations/Using-GitHub](https://docs.base44.com/Integrations/Using-GitHub)

- **Email**: [derek.samuel@web3tech.site](mailto:derek.samuel@web3tech.site)

- **Issues**: [GitHub Issues](https://github.com/DERK333/nebula.search.engine/issues)
