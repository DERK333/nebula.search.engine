import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const MAX_DEPTH = 3;
const MAX_LINKS_PER_PAGE = 15;

// Seed URLs spanning diverse domains
const SEED_URLS = [
  // ── General web ──────────────────────────────────────────────────────────
  "https://en.wikipedia.org/wiki/Main_Page",
  "https://www.bbc.com",
  "https://techcrunch.com",
  "https://www.reddit.com/r/technology",
  "https://news.ycombinator.com",
  "https://www.nytimes.com",
  "https://www.theguardian.com",
  "https://stackoverflow.com",
  "https://github.com/explore",
  "https://www.wired.com",
  "https://arstechnica.com",
  "https://www.scientificamerican.com",
  "https://www.nature.com",
  "https://www.nationalgeographic.com",
  "https://css-tricks.com",
  "https://smashingmagazine.com",
  "https://developer.mozilla.org",
  "https://www.cnn.com",
  "https://www.forbes.com",
  "https://medium.com",

  // ── Crypto news & media ───────────────────────────────────────────────────
  "https://coindesk.com",
  "https://cointelegraph.com",
  "https://decrypt.co",
  "https://theblock.co",
  "https://bitcoinmagazine.com",
  "https://cryptobriefing.com",
  "https://www.coindesk.com/markets",
  "https://www.coindesk.com/tech",
  "https://www.coindesk.com/web3",
  "https://www.coingecko.com",
  "https://coinmarketcap.com",
  "https://messari.io",
  "https://delphi.digital",
  "https://www.bankless.com",
  "https://unchainedcrypto.com",

  // ── Bitcoin ────────────────────────────────────────────────────────────────
  "https://bitcoin.org/en/",
  "https://bitcoincore.org",
  "https://lightning.network",
  "https://mempool.space",
  "https://en.wikipedia.org/wiki/Bitcoin",
  "https://learnmeabitcoin.com",

  // ── Ethereum & EVM ────────────────────────────────────────────────────────
  "https://ethereum.org/en/",
  "https://docs.ethereum.org",
  "https://etherscan.io",
  "https://ethgasstation.info",
  "https://eips.ethereum.org",
  "https://soliditylang.org",
  "https://hardhat.org",
  "https://foundry-rs.github.io/foundry",
  "https://viem.sh",
  "https://wagmi.sh",
  "https://www.alchemy.com/blog",
  "https://blog.quicknode.com",
  "https://www.infura.io/blog",

  // ── Layer 2 / Rollups ─────────────────────────────────────────────────────
  "https://optimism.io",
  "https://docs.optimism.io",
  "https://arbitrum.io",
  "https://developer.arbitrum.io",
  "https://polygon.technology",
  "https://wiki.polygon.technology",
  "https://zksync.io",
  "https://docs.zksync.io",
  "https://starkware.co",
  "https://docs.starknet.io",
  "https://base.org",
  "https://docs.base.org",
  "https://linea.build",
  "https://scroll.io",
  "https://taiko.xyz",
  "https://blast.io",
  "https://manta.network",
  "https://mantle.xyz",

  // ── Solana ────────────────────────────────────────────────────────────────
  "https://solana.com",
  "https://docs.solana.com",
  "https://solscan.io",
  "https://explorer.solana.com",
  "https://solana.com/ecosystem",
  "https://anchor-lang.com",

  // ── Cosmos ecosystem ──────────────────────────────────────────────────────
  "https://cosmos.network",
  "https://docs.cosmos.network",
  "https://mintscan.io",
  "https://osmosis.zone",
  "https://app.osmosis.zone",
  "https://celestia.org",
  "https://docs.celestia.org",
  "https://dydx.exchange",

  // ── Polkadot / Substrate ──────────────────────────────────────────────────
  "https://polkadot.network",
  "https://docs.substrate.io",
  "https://wiki.polkadot.network",

  // ── Avalanche ─────────────────────────────────────────────────────────────
  "https://avax.network",
  "https://docs.avax.network",
  "https://snowtrace.io",

  // ── BNB Chain ─────────────────────────────────────────────────────────────
  "https://www.bnbchain.org",
  "https://docs.bnbchain.org",
  "https://bscscan.com",

  // ── Sui / Aptos / Move ────────────────────────────────────────────────────
  "https://sui.io",
  "https://docs.sui.io",
  "https://aptos.dev",
  "https://aptos.network",

  // ── Near Protocol ─────────────────────────────────────────────────────────
  "https://near.org",
  "https://docs.near.org",
  "https://explorer.near.org",

  // ── Tezos ─────────────────────────────────────────────────────────────────
  "https://tezos.com",
  "https://tezos.gitlab.io",

  // ── Algorand ──────────────────────────────────────────────────────────────
  "https://algorand.com",
  "https://developer.algorand.org",

  // ── Cardano ───────────────────────────────────────────────────────────────
  "https://cardano.org",
  "https://docs.cardano.org",

  // ── Fantom / Sonic ────────────────────────────────────────────────────────
  "https://fantom.foundation",
  "https://docs.fantom.foundation",

  // ── TRON ─────────────────────────────────────────────────────────────────
  "https://tron.network",
  "https://developers.tron.network",

  // ── DeFi protocols ────────────────────────────────────────────────────────
  "https://uniswap.org",
  "https://docs.uniswap.org",
  "https://app.uniswap.org",
  "https://aave.com",
  "https://docs.aave.com",
  "https://app.aave.com",
  "https://compound.finance",
  "https://docs.compound.finance",
  "https://makerdao.com",
  "https://docs.makerdao.com",
  "https://sky.money",
  "https://curve.fi",
  "https://resources.curve.fi",
  "https://balancer.fi",
  "https://docs.balancer.fi",
  "https://lido.fi",
  "https://docs.lido.fi",
  "https://rocketpool.net",
  "https://docs.rocketpool.net",
  "https://eigenlayer.xyz",
  "https://docs.eigenlayer.xyz",
  "https://pendle.finance",
  "https://docs.pendle.finance",
  "https://yearn.fi",
  "https://docs.yearn.fi",
  "https://yearn.finance",
  "https://gmx.io",
  "https://docs.gmx.io",
  "https://synthetix.io",
  "https://docs.synthetix.io",
  "https://convexfinance.com",
  "https://frax.finance",
  "https://docs.frax.finance",
  "https://liquity.org",
  "https://instadapp.io",
  "https://app.1inch.io",
  "https://docs.1inch.io",
  "https://paraswap.io",
  "https://bungee.exchange",
  "https://stargate.finance",
  "https://www.layerzero.network",
  "https://axelar.network",
  "https://hop.exchange",
  "https://across.to",
  // ── OKX DeFi-featured DApps ───────────────────────────────────────────────
  "https://alchemix.fi",
  "https://alchemix-finance.gitbook.io/user-docs",
  "https://ens.domains",
  "https://docs.ens.domains",
  "https://app.ens.domains",
  "https://morpho.xyz",
  "https://docs.morpho.xyz",
  "https://beefy.finance",
  "https://docs.beefy.finance",
  "https://nexusmutual.io",
  "https://docs.nexusmutual.io",
  "https://1inch.io",
  "https://magiceden.io",
  // ── Liquid staking / restaking ────────────────────────────────────────────
  "https://etherfi.bid",
  "https://docs.ether.fi",
  "https://www.staderlabs.com",
  "https://docs.staderlabs.com",
  "https://dinero.xyz",
  "https://kelpdao.xyz",
  "https://puffer.fi",
  // ── Perpetuals / derivatives DEX ──────────────────────────────────────────
  "https://hyperliquid.xyz",
  "https://app.hyperliquid.xyz",
  "https://dydx.exchange",
  "https://docs.dydx.exchange",
  "https://kwenta.io",
  "https://docs.kwenta.io",
  "https://gains.trade",
  "https://vertex.xyz",
  "https://docs.vertexprotocol.com",
  "https://aevo.xyz",
  "https://premia.blue",
  // ── Lending (additional) ──────────────────────────────────────────────────
  "https://sparklend.com",
  "https://docs.spark.fi",
  "https://euler.finance",
  "https://docs.euler.finance",
  "https://silo.finance",
  "https://docs.silo.finance",
  "https://radiantcapital.com",
  "https://benqi.fi",
  "https://venus.io",
  "https://docs.venus.io",
  // ── Yield / vaults ────────────────────────────────────────────────────────
  "https://harvest.finance",
  "https://docs.harvest.finance",
  "https://alpacafinance.org",
  "https://docs.alpacafinance.org",
  "https://sommelier.finance",
  "https://app.sommelier.finance",
  // ── Stablecoins / CDP ─────────────────────────────────────────────────────
  "https://crvusd.curve.fi",
  "https://prismafinance.com",
  "https://f(x)protocol.io",
  "https://raft.fi",
  "https://docs.raft.fi",
  // ── Cross-chain bridges ───────────────────────────────────────────────────
  "https://portalbridge.com",
  "https://wormhole.com",
  "https://docs.wormhole.com",
  "https://synapse.is",
  "https://docs.synapseprotocol.com",
  "https://cbridge.celer.network",
  "https://docs.celer.network",
  "https://orbiter.finance",
  "https://relay.link",
  // ── Real World Assets (RWA) ───────────────────────────────────────────────
  "https://centrifuge.io",
  "https://docs.centrifuge.io",
  "https://maple.finance",
  "https://docs.maple.finance",
  "https://goldfinch.finance",
  "https://clearpool.finance",
  "https://ondo.finance",
  "https://docs.ondo.finance",
  // ── Prediction markets / misc ─────────────────────────────────────────────
  "https://polymarket.com",
  "https://docs.polymarket.com",
  "https://augur.net",
  "https://gnosis.io",
  "https://cow.fi",
  "https://docs.cow.fi",

  // ── DEX aggregators / tools ───────────────────────────────────────────────
  "https://dexscreener.com",
  "https://dextools.io",
  "https://defillama.com",
  "https://tokenterminal.com",
  "https://nansen.ai",
  "https://dune.com",
  "https://app.zerion.io",
  "https://debank.com",
  "https://zapper.xyz",

  // ── NFT platforms ─────────────────────────────────────────────────────────
  "https://opensea.io",
  "https://blur.io",
  "https://magiceden.io",
  "https://rarible.com",
  "https://foundation.app",
  "https://superrare.com",
  "https://niftygateway.com",
  "https://artblocks.io",
  "https://manifold.xyz",
  "https://zora.co",

  // ── Wallets ───────────────────────────────────────────────────────────────
  "https://metamask.io",
  "https://docs.metamask.io",
  "https://www.ledger.com",
  "https://trezor.io",
  "https://phantom.app",
  "https://rainbow.me",
  "https://www.coinbase.com/wallet",
  "https://trustwallet.com",
  "https://safe.global",
  "https://docs.safe.global",
  "https://rabby.io",

  // ── Exchanges (CEX) ───────────────────────────────────────────────────────
  "https://www.coinbase.com",
  "https://www.binance.com",
  "https://kraken.com",
  "https://www.kucoin.com",
  "https://www.okx.com",
  "https://www.bybit.com",

  // ── DAOs & governance ─────────────────────────────────────────────────────
  "https://snapshot.org",
  "https://tally.xyz",
  "https://www.withtally.com",
  "https://boardroom.io",
  "https://gitcoin.co",
  "https://prop.house",

  // ── Developer tools / infra ────────────────────────────────────────────────
  "https://www.alchemy.com",
  "https://www.quicknode.com",
  "https://moralis.io",
  "https://thegraph.com",
  "https://docs.thegraph.com",
  "https://chainlink.com",
  "https://docs.chain.link",
  "https://tenderly.co",
  "https://www.openzeppelin.com",
  "https://docs.openzeppelin.com",
  "https://trufflesuite.com",
  "https://book.getfoundry.sh",
  "https://www.web3.js.org",
  "https://docs.ethers.org",
  "https://rainbowkit.com",
  "https://walletconnect.com",
  "https://docs.walletconnect.com",

  // ── Stablecoins ───────────────────────────────────────────────────────────
  "https://www.circle.com",
  "https://tether.to",
  "https://sky.money",

  // ── Web3 learning resources ───────────────────────────────────────────────
  "https://www.web3.university",
  "https://learnweb3.io",
  "https://speedrunethereum.com",
  "https://www.cyfrin.io",
  "https://cryptozombies.io",
  "https://buildspace.so",
  "https://en.wikipedia.org/wiki/Web3",
  "https://en.wikipedia.org/wiki/Decentralized_finance",
  "https://en.wikipedia.org/wiki/Non-fungible_token",
  "https://en.wikipedia.org/wiki/Ethereum",
  "https://en.wikipedia.org/wiki/Solana_(blockchain_platform)",
  "https://en.wikipedia.org/wiki/Blockchain",
  "https://en.wikipedia.org/wiki/Decentralized_autonomous_organization",

  // ── Reddit communities ────────────────────────────────────────────────────
  "https://www.reddit.com/r/ethereum",
  "https://www.reddit.com/r/Bitcoin",
  "https://www.reddit.com/r/CryptoCurrency",
  "https://www.reddit.com/r/defi",
  "https://www.reddit.com/r/solana",
  "https://www.reddit.com/r/NFT",
  "https://www.reddit.com/r/web3",
];

function extractDomain(url) {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return null;
  }
}

function normalizeUrl(url, base) {
  try {
    const u = new URL(url, base);
    // Only http/https
    if (!["http:", "https:"].includes(u.protocol)) return null;
    // Remove fragments
    u.hash = "";
    const normalized = u.toString();
    // Skip common non-content extensions
    if (/\.(jpg|jpeg|png|gif|svg|ico|pdf|zip|mp4|mp3|css|js|woff|woff2|ttf)(\?|$)/i.test(normalized)) return null;
    return normalized;
  } catch {
    return null;
  }
}

function computeQualityScore({ wordCount, title, description, inboundLinks }) {
  let score = 0;
  // Word count (0-0.3)
  score += Math.min(wordCount / 2000, 1) * 0.3;
  // Has title (0-0.2)
  if (title && title.length > 5) score += 0.2;
  // Has description (0-0.2)
  if (description && description.length > 20) score += 0.2;
  // Inbound links bonus (0-0.3)
  score += Math.min(inboundLinks / 50, 1) * 0.3;
  return Math.min(score, 1);
}

function computePageRank(inboundLinks, domainAuthority) {
  // Simplified PageRank: base + inbound link boost + domain authority
  const base = 1.0;
  const linkBoost = Math.log1p(inboundLinks) * 0.5;
  return base + linkBoost + (domainAuthority || 0);
}

// Known high-authority domains get bonus
const HIGH_AUTHORITY_DOMAINS = new Set([
  // General
  "wikipedia.org", "bbc.com", "nytimes.com", "theguardian.com",
  "nature.com", "scientificamerican.com", "stackoverflow.com",
  "github.com", "developer.mozilla.org", "reuters.com", "apnews.com",
  // Crypto news
  "coindesk.com", "cointelegraph.com", "decrypt.co", "theblock.co",
  "bitcoinmagazine.com", "messari.io", "defillama.com", "dune.com",
  // Core chains
  "bitcoin.org", "ethereum.org", "docs.ethereum.org", "solana.com",
  "docs.solana.com", "cosmos.network", "polkadot.network", "avax.network",
  "sui.io", "aptos.dev", "near.org", "cardano.org",
  // L2s
  "optimism.io", "arbitrum.io", "polygon.technology", "zksync.io",
  "starkware.co", "base.org", "linea.build", "scroll.io",
  // DeFi
  "uniswap.org", "aave.com", "makerdao.com", "compound.finance",
  "curve.fi", "lido.fi", "eigenlayer.xyz", "thegraph.com",
  "rocketpool.net", "yearn.finance", "yearn.fi", "convexfinance.com",
  "morpho.xyz", "beefy.finance", "nexusmutual.io", "gmx.io",
  "hyperliquid.xyz", "dydx.exchange", "ens.domains", "alchemix.fi",
  "1inch.io", "pendle.finance", "frax.finance", "synthetix.io",
  "across.to", "stargate.finance", "layerzero.network", "axelar.network",
  "wormhole.com", "centrifuge.io", "maple.finance", "ondo.finance",
  "polymarket.com", "cow.fi", "euler.finance", "silo.finance",
  "venus.io", "benqi.fi", "radiantcapital.com", "etherfi.bid",
  "puffer.fi", "kelpdao.xyz", "sparklend.com", "hop.exchange",
  "relay.link", "orbiter.finance", "vertex.xyz", "gains.trade", "aevo.xyz",
  // Infra / tools
  "alchemy.com", "quicknode.com", "chainlink.com", "openzeppelin.com",
  "walletconnect.com", "metamask.io", "safe.global", "etherscan.io",
  // Exchanges
  "coinbase.com", "binance.com", "kraken.com",
]);

function getDomainAuthority(domain) {
  for (const d of HIGH_AUTHORITY_DOMAINS) {
    if (domain && domain.includes(d)) return 2.0;
  }
  return 0;
}

async function fetchPageContent(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  
  const response = await fetch(url, {
    signal: controller.signal,
    headers: {
      "User-Agent": "ExploreBot/1.0 (web search indexer)",
      "Accept": "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9",
    },
    redirect: "follow",
  });
  clearTimeout(timeout);

  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) throw new Error("Not HTML content");

  return await response.text();
}

function parseHtml(html, baseUrl) {
  // Extract title
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim().substring(0, 200) : "";

  // Extract meta description
  const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
  const description = descMatch ? descMatch[1].trim().substring(0, 500) : "";

  // Extract body text
  let bodyText = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const wordCount = bodyText.split(/\s+/).filter(Boolean).length;
  const contentSnippet = bodyText.substring(0, 500);

  // Extract keywords from content
  const words = bodyText.toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 3);
  
  const freq = {};
  words.forEach(w => { freq[w] = (freq[w] || 0) + 1; });
  const stopWords = new Set(["that","this","with","from","they","have","been","will","your","what","when","more","also","into","than","some","were","then","which","their","there","would","about","could","other","these","those"]);
  const keywords = Object.entries(freq)
    .filter(([w]) => !stopWords.has(w))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([w]) => w);

  // Extract links
  const linkRegex = /href=["']([^"'#?][^"']*?)["']/gi;
  const links = [];
  let match;
  while ((match = linkRegex.exec(html)) !== null && links.length < MAX_LINKS_PER_PAGE) {
    const normalized = normalizeUrl(match[1], baseUrl);
    if (normalized) links.push(normalized);
  }

  // Detect language (simple heuristic)
  const language = html.match(/lang=["']([a-z]{2})/i)?.[1] || "en";

  return { title, description, contentSnippet, keywords, wordCount, links, language };
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();

  if (!user || user.role !== "admin") {
    return Response.json({ error: "Admin access required" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { action, url: targetUrl, seedMode } = body;

  // ---- SEED ACTION ----
  if (action === "seed") {
    const seeded = [];
    for (const seedUrl of SEED_URLS) {
      const domain = extractDomain(seedUrl);
      if (!domain) continue;
      const existing = await base44.asServiceRole.entities.CrawlQueue.filter({ url: seedUrl });
      if (existing.length === 0) {
        await base44.asServiceRole.entities.CrawlQueue.create({
          url: seedUrl, domain, depth: 0, priority: 10, status: "pending", attempts: 0
        });
        seeded.push(seedUrl);
      }
    }
    return Response.json({ seeded: seeded.length, total: SEED_URLS.length });
  }

  // ---- CRAWL BATCH ACTION ----
  if (action === "crawl_batch") {
    const batchSize = body.batchSize || 5;

    // Pick pending items sorted by priority desc
    const queue = await base44.asServiceRole.entities.CrawlQueue.filter(
      { status: "pending" }, "-priority", batchSize
    );

    if (queue.length === 0) {
      return Response.json({ message: "Queue empty", crawled: 0 });
    }

    const results = [];

    for (const item of queue) {
      // Mark as processing
      await base44.asServiceRole.entities.CrawlQueue.update(item.id, { status: "processing" });

      let success = false;
      try {
        // Check if already indexed
        const existing = await base44.asServiceRole.entities.IndexedPage.filter({ url: item.url });
        if (existing.length > 0) {
          await base44.asServiceRole.entities.CrawlQueue.update(item.id, { status: "done" });
          results.push({ url: item.url, status: "duplicate" });
          continue;
        }

        const html = await fetchPageContent(item.url);
        const parsed = parseHtml(html, item.url);

        // Count existing inbound links to this URL
        const inboundPages = await base44.asServiceRole.entities.IndexedPage.filter({ url: item.url });
        const inboundLinks = item.source_url ? 1 : 0; // simplified

        const domainAuthority = getDomainAuthority(item.domain);
        const pageRank = computePageRank(inboundLinks, domainAuthority);
        const qualityScore = computeQualityScore({
          wordCount: parsed.wordCount,
          title: parsed.title,
          description: parsed.description,
          inboundLinks
        });
        const finalScore = (pageRank * 0.6) + (qualityScore * 10 * 0.4);

        // Save indexed page
        await base44.asServiceRole.entities.IndexedPage.create({
          url: item.url,
          domain: item.domain,
          title: parsed.title,
          description: parsed.description,
          content_snippet: parsed.contentSnippet,
          keywords: parsed.keywords,
          inbound_links: inboundLinks,
          outbound_links: parsed.links.length,
          page_rank: pageRank,
          quality_score: qualityScore,
          final_score: finalScore,
          language: parsed.language,
          word_count: parsed.wordCount,
          crawl_depth: item.depth,
          last_crawled: new Date().toISOString(),
          status: "active"
        });

        // Enqueue discovered links (if depth allows)
        if (item.depth < MAX_DEPTH) {
          for (const link of parsed.links.slice(0, 10)) {
            const linkDomain = extractDomain(link);
            if (!linkDomain) continue;
            const alreadyQueued = await base44.asServiceRole.entities.CrawlQueue.filter({ url: link });
            if (alreadyQueued.length === 0) {
              const priority = HIGH_AUTHORITY_DOMAINS.has(linkDomain) ? 8 : 4;
              await base44.asServiceRole.entities.CrawlQueue.create({
                url: link,
                domain: linkDomain,
                depth: item.depth + 1,
                priority,
                source_url: item.url,
                status: "pending",
                attempts: 0
              });
            }
          }
        }

        await base44.asServiceRole.entities.CrawlQueue.update(item.id, { status: "done" });
        success = true;
        results.push({ url: item.url, status: "indexed", links: parsed.links.length });
      } catch (err) {
        await base44.asServiceRole.entities.CrawlQueue.update(item.id, {
          status: "failed",
          attempts: (item.attempts || 0) + 1
        });
        results.push({ url: item.url, status: "error", error: err.message });
      }
    }

    return Response.json({ crawled: results.length, results });
  }

  // ---- RERANK ACTION ----
  if (action === "rerank") {
    const pages = await base44.asServiceRole.entities.IndexedPage.list("-inbound_links", 100);
    for (const page of pages) {
      const domainAuthority = getDomainAuthority(page.domain);
      const pageRank = computePageRank(page.inbound_links || 0, domainAuthority);
      const qualityScore = computeQualityScore({
        wordCount: page.word_count || 0,
        title: page.title,
        description: page.description,
        inboundLinks: page.inbound_links || 0
      });
      const finalScore = (pageRank * 0.6) + (qualityScore * 10 * 0.4);
      await base44.asServiceRole.entities.IndexedPage.update(page.id, {
        page_rank: pageRank,
        quality_score: qualityScore,
        final_score: finalScore
      });
    }
    return Response.json({ reranked: pages.length });
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
});