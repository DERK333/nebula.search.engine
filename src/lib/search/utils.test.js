import { describe, expect, it } from "vitest";
import {
  canonicalizeUrl,
  decodeHtmlEntities,
  inferContentType,
  makeResult,
  scoreDocument,
  stripTags,
  tokenize,
} from "./utils.js";
import { ResultCollector } from "./collector.js";
import { classifyIntent, expandQueries, siteScopedQueries } from "./query-expand.js";
import { parseDuckDuckGoResults, parseNextDuckDuckGoOffset, searchDuckDuckGoInstant } from "./engines/duckduckgo.js";
import { searchWikipedia } from "./engines/wikipedia.js";
import { parseOpenAlexAbstract } from "./engines/open-web.js";
import { runFederatedSearch } from "./orchestrator.js";
import { searchLocalCorpus, upsertLocalPages } from "./local-corpus.js";
import { runSearchSession } from "./run-search.js";
import { parseBingRss } from "./engines/server-web.js";

const DDG_HTML = `
<html><body>
  <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fen.wikipedia.org%2Fwiki%2FJavaScript">JavaScript - Wikipedia</a>
  <a class="result__snippet">JavaScript is a programming language.</a>
  <a class="result__a" href="https://developer.mozilla.org/en-US/docs/Web/JavaScript">JavaScript | MDN</a>
  <a class="result__snippet">JavaScript (JS) is a lightweight language.</a>
  <input type="hidden" name="s" value="30" />
</body></html>
`;

describe("url and text helpers", () => {
  it("canonicalizes tracking params, www, and hashes", () => {
    expect(canonicalizeUrl("https://WWW.Example.com/path/?utm_source=x&b=1&a=2#frag"))
      .toBe("https://example.com/path?a=2&b=1");
  });

  it("strips tags and entities", () => {
    expect(stripTags("Hello &amp; <b>world</b>")).toBe("Hello & world");
    expect(decodeHtmlEntities("&quot;hi&quot;")).toBe("\"hi\"");
  });

  it("classifies content types", () => {
    expect(inferContentType({ url: "https://en.wikipedia.org/wiki/X" })).toBe("wiki");
    expect(inferContentType({ url: "https://github.com/foo/bar" })).toBe("repository");
    expect(inferContentType({ url: "https://arxiv.org/abs/123", title: "paper" })).toBe("research");
  });

  it("scores documents by coverage and title hits", () => {
    const score = scoreDocument({
      title: "Rust programming language",
      description: "A language empowering everyone to build reliable software.",
      keywords: ["rust", "systems"],
      quality_score: 0.8,
    }, ["rust", "language"]);
    expect(score).toBeGreaterThan(20);
    expect(scoreDocument({ title: "unrelated" }, ["rust"])).toBe(0);
  });
});

describe("query expansion", () => {
  it("keeps the original query and adds useful variants", () => {
    const expansions = expandQueries("how to learn rust");
    expect(expansions[0]).toBe("how to learn rust");
    expect(expansions.some((item) => item.includes("tutorial") || item.includes("guide"))).toBe(true);
    expect(classifyIntent("how to learn rust")).toBe("instructional");
    expect(siteScopedQueries("rust").length).toBe(3);
  });
});

describe("result collector", () => {
  it("deduplicates URLs and fuses ranks across engines", () => {
    const collector = new ResultCollector({ query: "rust" });
    collector.add([
      makeResult({ title: "Rust", url: "https://www.rust-lang.org/", description: "lang" }, "wikipedia", 0),
    ], "wikipedia");
    collector.add([
      makeResult({ title: "Rust lang", url: "https://rust-lang.org/", description: "The Rust programming language homepage with docs" }, "duckduckgo", 0),
    ], "duckduckgo");
    const list = collector.list();
    expect(list).toHaveLength(1);
    expect(list[0].sources).toEqual(expect.arrayContaining(["wikipedia", "duckduckgo"]));
    expect(list[0].description).toContain("homepage");
  });

  it("ranks query-matching pages above loosely related encyclopedia pages", () => {
    const collector = new ResultCollector({ query: "javascript programming language" });
    collector.add([
      makeResult({ title: "Brainfuck", url: "https://en.wikipedia.org/wiki/Brainfuck", description: "An esoteric programming language" }, "wikipedia", 0),
      makeResult({ title: "JavaScript", url: "https://en.wikipedia.org/wiki/JavaScript", description: "JavaScript is a programming language for the web" }, "wikipedia", 8),
    ], "wikipedia");
    expect(collector.list()[0].title).toBe("JavaScript");
  });
});

describe("duckduckgo parsers", () => {
  it("extracts every result and the next offset", () => {
    const results = parseDuckDuckGoResults(DDG_HTML, 10);
    expect(results).toHaveLength(2);
    expect(results[0].url).toBe("https://en.wikipedia.org/wiki/JavaScript");
    expect(results[1].url).toBe("https://developer.mozilla.org/en-US/docs/Web/JavaScript");
    expect(parseNextDuckDuckGoOffset(DDG_HTML)).toBe(30);
  });

  it("flattens instant-answer related topics", async () => {
    const fetchImpl = async () => ({
      ok: true,
      json: async () => ({
        Heading: "Rust",
        AbstractURL: "https://en.wikipedia.org/wiki/Rust_(programming_language)",
        AbstractText: "A language",
        RelatedTopics: [
          { FirstURL: "https://www.rust-lang.org/", Text: "Rust Language - Official site" },
          { Name: "See also", Topics: [{ FirstURL: "https://doc.rust-lang.org/", Text: "The Rust Book" }] },
        ],
      }),
    });
    const { results, related } = await searchDuckDuckGoInstant({ query: "rust", fetchImpl });
    expect(results.length).toBeGreaterThanOrEqual(3);
    expect(related).toEqual(expect.arrayContaining(["Rust Language", "The Rust Book"]));
  });
});

describe("wikipedia engine", () => {
  it("paginates until the API is exhausted", async () => {
    const fetchImpl = async (url) => {
      const parsed = new URL(url, "https://en.wikipedia.org");
      if (parsed.searchParams.get("action") === "opensearch") {
        return { ok: true, json: async () => ["rust", ["Rustacean"], ["A nickname"], ["https://en.wikipedia.org/wiki/Rustacean"]] };
      }
      const offset = Number(parsed.searchParams.get("sroffset") || 0);
      const hits = offset === 0
        ? [{ title: "Rust", snippet: "systems language" }, { title: "Rust (fungus)", snippet: "plant pathogen" }]
        : [];
      return {
        ok: true,
        json: async () => ({
          query: {
            searchinfo: { totalhits: 2 },
            search: hits,
          },
        }),
      };
    };
    const { results } = await searchWikipedia({ query: "rust", fetchImpl, maxResults: 50 });
    expect(results.some((item) => item.url.includes("Rust"))).toBe(true);
    expect(results.some((item) => item.url.includes("Rustacean"))).toBe(true);
  });
});

describe("bing rss parser", () => {
  it("reads every item from a feed", () => {
    const xml = `<?xml version="1.0"?><rss><channel>
      <item><title>JavaScript - MDN</title><link>https://developer.mozilla.org/docs/Web/JavaScript</link><description>JS docs</description></item>
      <item><title>W3Schools</title><link>https://www.w3schools.com/js/</link><description>JS tutorial</description></item>
    </channel></rss>`;
    const results = parseBingRss(xml);
    expect(results).toHaveLength(2);
    expect(results[0].url).toContain("developer.mozilla.org");
  });
});

describe("openalex abstract reconstruction", () => {
  it("rebuilds inverted abstracts", () => {
    expect(parseOpenAlexAbstract({ Hello: [0], world: [1] })).toBe("Hello world");
  });
});

describe("federated search", () => {
  it("runs every supplied engine and returns all unique hits", async () => {
    const engines = [
      {
        id: "alpha",
        search: async () => ({
          results: [makeResult({ title: "A", url: "https://a.example/1", description: "one" }, "alpha", 0)],
          related: ["more a"],
        }),
      },
      {
        id: "beta",
        search: async () => ({
          results: [
            makeResult({ title: "A", url: "https://a.example/1", description: "one longer description here" }, "beta", 0),
            makeResult({ title: "B", url: "https://b.example/2", description: "two" }, "beta", 1),
          ],
        }),
      },
    ];
    const data = await runFederatedSearch("example query", { engines, includeServerEngines: false });
    expect(data.results).toHaveLength(2);
    expect(data.total).toBe(2);
    expect(data.related).toContain("more a");
    expect(data.engines).toEqual(["alpha", "beta"]);
  });
});

describe("local corpus", () => {
  it("indexes discovered pages and finds them on later queries", async () => {
    await upsertLocalPages([
      { url: "https://docs.example.com/rust", title: "The Rust Book", description: "Learn the rust programming language" },
      { url: "https://docs.example.com/python", title: "Python docs", description: "Python language reference" },
    ]);
    const hits = await searchLocalCorpus("rust programming");
    expect(hits[0].url).toBe("https://docs.example.com/rust");
  });
});

describe("search session", () => {
  it("merges client engines, local corpus, and backend functions without capping", async () => {
    const pages = Array.from({ length: 80 }, (_, index) => ({
      title: `Result ${index}`,
      url: `https://example.com/page/${index}`,
      description: `javascript page ${index}`,
    }));

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url) => {
      if (String(url).includes("/api/search")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ results: pages.slice(0, 40), source: "web", hasMore: true, cursor: 40 }),
        };
      }
      throw new Error(`unexpected fetch ${url}`);
    };

    try {
      const session = await runSearchSession("javascript", {
        fetchImpl: async () => {
          throw new Error("network disabled");
        },
        invokeWebSearch: async () => ({ results: pages.slice(40), source: "webSearch" }),
        invokeSearchIndex: async () => ({ data: { results: [pages[0]], intent: "general" } }),
        invokeIndexOnSearch: async () => ({ data: { indexed: 12, queued: 4 } }),
      });
      await session.indexing;
      expect(session.results.length).toBe(80);
      expect(session.hasMore).toBe(true);
      expect(tokenize("javascript").length).toBeGreaterThan(0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
