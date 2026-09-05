import { base44 } from "./base44Client";

function unwrap(result) {
  return result?.data ?? result;
}

export const webSearch = (payload) => unwrap(base44.functions.invoke("webSearch", payload));
export const searchIndex = (payload) => unwrap(base44.functions.invoke("searchIndex", payload));
export const indexOnSearch = (payload) => unwrap(base44.functions.invoke("indexOnSearch", payload));
export const crawlPage = (payload) => unwrap(base44.functions.invoke("crawlPage", payload));

export const functions = {
  webSearch,
  searchIndex,
  indexOnSearch,
  crawlPage,
};
