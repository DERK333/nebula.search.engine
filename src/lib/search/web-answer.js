import { Core } from "@/api/integrations";

const WEB_ANSWER_SCHEMA = {
  type: "object",
  properties: {
    answer: { type: "string" },
    bullets: { type: "array", items: { type: "string" } },
    followups: { type: "array", items: { type: "string" } },
  },
};

export async function invokeWebAnswer(query, { invokeLLM = (params) => Core.InvokeLLM(params) } = {}) {
  const trimmed = (query || "").trim();
  if (!trimmed) return null;
  try {
    const data = await invokeLLM({
      prompt: [
        `Answer this web search query with current public knowledge: "${trimmed}".`,
        "Write a concise, factual overview (2-4 sentences).",
        "Add up to 4 short bullets of key facts.",
        "Suggest up to 4 follow-up searches.",
        "Do not invent URLs. If you are unsure, say so.",
      ].join(" "),
      add_context_from_internet: true,
      response_json_schema: WEB_ANSWER_SCHEMA,
    });
    if (!data || typeof data !== "object") return null;
    const answer = typeof data.answer === "string" ? data.answer.trim() : "";
    if (!answer) return null;
    return {
      answer,
      bullets: Array.isArray(data.bullets) ? data.bullets.filter(Boolean).slice(0, 4) : [],
      followups: Array.isArray(data.followups) ? data.followups.filter(Boolean).slice(0, 4) : [],
    };
  } catch {
    return null;
  }
}
