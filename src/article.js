import { BUSINESS } from "../config/topics.js";

export async function generateArticle(keyword, kd, vol, relatedPosts, relatedTerms, log) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Missing ANTHROPIC_API_KEY env var");

  const competitionLevel = kd == null ? "unknown" : kd < 30 ? "low" : kd < 60 ? "medium" : "high";
  log(`Writing article for "${keyword}" (competition: ${competitionLevel})...`);

  // Build internal links block for blog posts
  const postLinksBlock = relatedPosts.length > 0
    ? `INTERNAL LINKS — Blog Posts (link naturally within body copy):
${relatedPosts.map(p => `  - "${p.title}" → ${p.url}`).join("\n")}`
    : `No related blog posts available for internal linking.`;

  // Build glossary links block — treated differently (definitions, link on first mention)
  const termLinksBlock = relatedTerms.length > 0
    ? `INTERNAL LINKS — Glossary Terms (link the first time each term appears in the article):
${relatedTerms.map(t => `  - "${t.title}" → ${t.url}`).join("\n")}
These are glossary definition pages. Link the term word naturally as anchor text the first time it appears. Do not force them in — only link if the term genuinely appears in the content.`
    : `No glossary terms available for internal linking.`;

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
      system: `You are an expert content writer for ${BUSINESS.name}, a ${BUSINESS.type}.
Your audience is ${BUSINESS.audience}.
Your writing tone is ${BUSINESS.tone}.
Your niche is ${BUSINESS.niche}.

You write blog posts that genuinely help couples feel confident and inspired about writing their wedding vows. You naturally reference that ${BUSINESS.name} offers professional vow writing help as a soft, non-pushy call to action — never salesy.

Return ONLY valid JSON (no markdown fences, no preamble) with exactly these fields:
- title: string - compelling H1 headline for the article
- seo_title: string - SEO title tag, max 60 chars, keyword near the start
- content: string - Full HTML article body using <h2>,<h3>,<p>,<ul>,<li>,<strong>,<a href="..."> tags. Min 800 words. Include keyword naturally 4-6 times. Add a FAQ section at the end. Include one gentle mention of ${BUSINESS.name}. Weave all provided internal links naturally into the body copy as real <a href="URL">anchor text</a> tags.
- excerpt: string - Meta description MUST be between 120 and 155 characters. MUST include the target keyword. Written to maximise click-through rate. Count the characters carefully.
- pinterest_description: string - Warm, romantic Pinterest caption max 500 chars with a call to action
- unsplash_query: string - 2 to 4 words for a beautiful wedding hero image on Unsplash (e.g. "wedding ceremony romantic", "bride groom vows", "wedding rings flowers")`,
      messages: [{
        role: "user",
        content: `Write a complete, helpful blog post for the keyword: "${keyword}"
Search volume: ${vol?.toLocaleString() ?? "unknown"}/month
Competition: ${competitionLevel}

Target keyword for meta description: "${keyword}"
Meta description must be 120-155 characters and must contain "${keyword}".

${postLinksBlock}

${termLinksBlock}

Linking rules:
- Blog post links: weave into relevant sentences naturally, use descriptive anchor text
- Glossary term links: link the term word itself on its first mention only (e.g. <a href="URL">officiant</a>)
- Never list links at the bottom — all links must appear naturally within the body copy
- Do not force a link if it doesn't fit naturally

Remember: the reader is an engaged couple who may feel nervous or overwhelmed about writing their vows. Be encouraging, warm, and practical.`,
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
  log(`Excerpt length: ${article.excerpt?.length ?? 0} chars`);
  log(`Unsplash query: "${article.unsplash_query}"`);
  log(`Post links: ${relatedPosts.length} | Term links: ${relatedTerms.length}`);
  return article;
}
