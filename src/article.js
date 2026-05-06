export async function generateArticle(keyword, kd, vol, log) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Missing ANTHROPIC_API_KEY env var");

  const competitionLevel = kd == null ? "unknown" : kd < 30 ? "low" : kd < 60 ? "medium" : "high";
  log(`Writing article for "${keyword}" (competition: ${competitionLevel})...`);

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4000,
      system: `You are an expert SEO content writer. Return ONLY valid JSON (no markdown fences, no preamble) with exactly these fields:
- title: string - H1 headline for the article
- seo_title: string - SEO title tag, max 60 chars, keyword near the start
- content: string - Full HTML article body using <h2>,<h3>,<p>,<ul>,<li>,<strong> tags. Min 800 words. Include keyword 4-6 times. Add FAQ section at end.
- excerpt: string - Meta description, max 160 chars, include keyword
- pinterest_description: string - Pinterest caption, max 500 chars, with call to action
- unsplash_query: string - 2 to 4 words for a relevant Unsplash hero image (e.g. "laptop coffee workspace")`,
      messages: [{
        role: "user",
        content: `Write a complete SEO article for the keyword: "${keyword}"\nSearch volume: ${vol?.toLocaleString() ?? "unknown"}/month\nCompetition level: ${competitionLevel} (KD: ${kd ?? "unknown"})`,
      }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic API HTTP ${res.status}: ${err}`);
  }

  const data = await res.json();
  const raw = data.content?.find(b => b.type === "text")?.text || "";

  let article;
  try {
    article = JSON.parse(raw.replace(/```json|```/g, "").trim());
  } catch (e) {
    throw new Error(`Failed to parse Claude response: ${e.message}\nRaw: ${raw.slice(0, 300)}`);
  }

  if (!article.title || !article.content) throw new Error("Claude response missing title or content");

  log(`Article ready: "${article.title}"`);
  log(`Unsplash query: "${article.unsplash_query}"`);
  return article;
}
