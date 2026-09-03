import { fetchJson, makeResult, stripTags } from "../utils.js";

export async function searchGitHub({ query, fetchImpl, signal, maxResults = 100 }) {
  const headers = { Accept: "application/vnd.github+json", "User-Agent": "ExploreSearch" };
  const repoUrl = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&per_page=${Math.min(maxResults, 100)}&sort=stars`;
  const data = await fetchJson(repoUrl, { fetchImpl, signal, timeout: 8000, headers });
  const results = (data?.items || []).map((repo, index) => makeResult({
    title: repo.full_name,
    url: repo.html_url,
    description: repo.description || `${repo.language || "Repository"} · ${repo.stargazers_count} stars`,
    content_type: "repository",
  }, "github", index)).filter(Boolean);
  return { results };
}

export async function searchHackerNews({ query, fetchImpl, signal, maxResults = 80 }) {
  const url = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&hitsPerPage=${Math.min(maxResults, 100)}`;
  const data = await fetchJson(url, { fetchImpl, signal, timeout: 8000 });
  const results = (data?.hits || []).map((hit, index) => makeResult({
    title: hit.title || hit.story_title || "Hacker News discussion",
    url: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
    description: stripTags(hit.comment_text || hit.story_text || `HN · ${hit.author || ""} · ${hit.points || 0} points`),
    content_type: hit._tags?.includes("story") ? "discussion" : "discussion",
  }, "hackernews", index)).filter(Boolean);
  return { results };
}

export async function searchStackExchange({ query, fetchImpl, signal, maxResults = 80 }) {
  const url =
    `https://api.stackexchange.com/2.3/search/advanced?order=desc&sort=relevance&q=${encodeURIComponent(query)}` +
    `&site=stackoverflow&pagesize=${Math.min(maxResults, 100)}&filter=default`;
  const data = await fetchJson(url, { fetchImpl, signal, timeout: 8000 });
  const results = (data?.items || []).map((item, index) => makeResult({
    title: item.title,
    url: item.link,
    description: (item.tags || []).join(", "),
    content_type: "discussion",
  }, "stackoverflow", index)).filter(Boolean);
  return { results };
}

export async function searchReddit({ query, fetchImpl, signal, maxResults = 60 }) {
  const url = `https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&limit=${Math.min(maxResults, 100)}&sort=relevance`;
  const data = await fetchJson(url, {
    fetchImpl,
    signal,
    timeout: 8000,
    headers: { "User-Agent": "ExploreSearch/2.0" },
  });
  const children = data?.data?.children || [];
  const results = children.map((child, index) => {
    const post = child.data || {};
    return makeResult({
      title: post.title,
      url: post.url_overridden_by_dest && /^https?:/i.test(post.url_overridden_by_dest)
        ? post.url_overridden_by_dest
        : `https://www.reddit.com${post.permalink || ""}`,
      description: stripTags(post.selftext || `r/${post.subreddit} · ${post.score || 0} upvotes`),
      content_type: "discussion",
    }, "reddit", index);
  }).filter(Boolean);
  return { results };
}
