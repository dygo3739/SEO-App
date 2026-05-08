// src/sitemap.js

const SITEMAP_URL = "https://helpwithvows.com/post-sitemap.xml";

export async function fetchPublishedPosts(log) {
  try {
    log(`Fetching sitemap from ${SITEMAP_URL}...`);
    const res = await fetch(SITEMAP_URL, {
      headers: { "User-Agent": "HelpWithVows-SEO-Bot/1.0" },
    });

    if (!res.ok) {
      log(`Sitemap fetch failed (HTTP ${res.status}) — skipping internal links`, "warn");
      return [];
    }

    const xml = await res.text();

    const urls = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map(m => m[1].trim());
    const titleMatches = [...xml.matchAll(/<news:title>(.*?)<\/news:title>/g)];
    const imageTitleMatches = [...xml.matchAll(/<image:title>(.*?)<\/image:title>/g)];

    const posts = urls
      .filter(url => url.includes("helpwithvows.com") && !url.endsWith("sitemap.xml"))
      .map((url, i) => {
        const xmlTitle = (titleMatches[i] && titleMatches[i][1])
          || (imageTitleMatches[i] && imageTitleMatches[i][1]);

        const slugTitle = url
          .replace(/https?:\/\/[^/]+\//, "")
          .replace(/\/$/, "")
          .replace(/-/g, " ")
          .replace(/\b\w/g, c => c.toUpperCase());

        return {
          url,
          title: xmlTitle ? decodeHtmlEntities(xmlTitle) : slugTitle,
        };
      });

    log(`Found ${posts.length} published posts for internal linking`);
    if (posts.length > 0) {
      log(`  Sample: "${posts[0].title}" → ${posts[0].url}`);
    }

    return posts;

  } catch (err) {
    log(`Sitemap error (${err.message}) — skipping internal links`, "warn");
    return [];
  }
}

export function selectRelevantPosts(posts, keyword, maxLinks = 3) {
  if (!posts.length) return [];

  const kwWords = new Set(keyword.toLowerCase().split(/\s+/).filter(w => w.length > 3));

  const scored = posts.map(post => {
    const titleWords = post.title.toLowerCase().split(/\s+/);
    const overlap = titleWords.filter(w => kwWords.has(w)).length;
    return { ...post, score: overlap };
  });

  const sorted = scored.sort((a, b) => b.score - a.score);
  const withOverlap = sorted.filter(p => p.score > 0);
  const candidates = withOverlap.length >= maxLinks ? withOverlap : sorted;
  return candidates.slice(0, maxLinks);
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
