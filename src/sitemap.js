// src/sitemap.js

const POST_SITEMAP_URL  = "https://helpwithvows.com/post-sitemap.xml";
const TERMS_SITEMAP_URL = "https://helpwithvows.com/terms-sitemap.xml";

// ── Shared XML parser ─────────────────────────────────────────────
async function fetchSitemap(url, log) {
  try {
    const res = await fetch(url, { headers: { "User-Agent": "HelpWithVows-SEO-Bot/1.0" } });
    if (!res.ok) {
      log(`Sitemap fetch failed for ${url} (HTTP ${res.status})`, "warn");
      return [];
    }
    const xml = await res.text();
    const urls = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map(m => m[1].trim());
    const titleMatches      = [...xml.matchAll(/<news:title>(.*?)<\/news:title>/g)];
    const imageTitleMatches = [...xml.matchAll(/<image:title>(.*?)<\/image:title>/g)];

    return urls
      .filter(url => url.includes("helpwithvows.com") && !url.endsWith(".xml"))
      .map((url, i) => {
        const xmlTitle = (titleMatches[i] && titleMatches[i][1])
          || (imageTitleMatches[i] && imageTitleMatches[i][1]);
        const slugTitle = url
          .replace(/https?:\/\/[^/]+\//, "")
          .replace(/\/$/, "")
          .replace(/-/g, " ")
          .replace(/\b\w/g, c => c.toUpperCase());
        return { url, title: xmlTitle ? decodeHtmlEntities(xmlTitle) : slugTitle };
      });
  } catch (err) {
    log(`Sitemap error for ${url} (${err.message}) — skipping`, "warn");
    return [];
  }
}

// ── Public API ────────────────────────────────────────────────────
export async function fetchPublishedPosts(log) {
  log(`Fetching post sitemap...`);
  const posts = await fetchSitemap(POST_SITEMAP_URL, log);
  log(`Found ${posts.length} published posts`);
  return posts;
}

export async function fetchGlossaryTerms(log) {
  log(`Fetching glossary terms sitemap...`);
  const terms = await fetchSitemap(TERMS_SITEMAP_URL, log);
  log(`Found ${terms.length} glossary terms`);
  return terms;
}

// Score by keyword word overlap — higher = more relevant
function scoreItems(items, keyword) {
  const kwWords = new Set(keyword.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  return items
    .map(item => {
      const titleWords = item.title.toLowerCase().split(/\s+/);
      const overlap = titleWords.filter(w => kwWords.has(w)).length;
      return { ...item, score: overlap };
    })
    .sort((a, b) => b.score - a.score);
}

export function selectRelevantPosts(posts, keyword, maxLinks = 3) {
  if (!posts.length) return [];
  const scored = scoreItems(posts, keyword);
  const withOverlap = scored.filter(p => p.score > 0);
  return (withOverlap.length >= maxLinks ? withOverlap : scored).slice(0, maxLinks);
}

export function selectRelevantTerms(terms, keyword, maxLinks = 3) {
  if (!terms.length) return [];
  const scored = scoreItems(terms, keyword);
  const withOverlap = scored.filter(t => t.score > 0);
  return (withOverlap.length >= maxLinks ? withOverlap : scored).slice(0, maxLinks);
}

function decodeHtmlEntities(str) {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}
