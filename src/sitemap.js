// src/sitemap.js
// Fetches the live post sitemap and returns a list of published posts.
// Used to give Claude real internal links to weave into each article.

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

    // Parse <url> entries — each has <loc> and optionally <news:title> or <image:title>
    const urls = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map(m => m[1].trim());

    // Try to extract titles from the XML (Yoast sitemap includes these)
    const titleMatches = [...xml.matchAll(/<news:title>(.*?)<\/news:title>/g)];
    const imageTitleMatches = [...xml.matchAll(/<image:title>(.*?)<\/image:title>/g)];

    const posts = urls
      .filter(url => url.includes("helpwithvows.com") && !url.endsWith("/post-sitemap.xml"))
      .map((url, i) => {
        // Try to get a title from XML, fall back to deriving from the URL slug
        const xmlTitle = titleMatches[i]?.1 || imageTitleMatches[i]?.1;
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

// Pick the most relevant posts for a given keyword (simple word overlap scoring)
export function selectRelevantPosts(posts, keyword, maxLinks = 3) {
  if (!posts.length) return [];

  const kwWords = new Set(keyword.toLowerCase().split(/\s+/).filter(w => w.length > 3));

  const scored = posts.map(post => {
    const titleWords = post.title.toLowerCase().split(/\s+/);
    const overlap = titleWords.filter(w => kwWords.has(w)).length;
    return { ...post, score: overlap };
  });

  // Return top matches, excluding any with zero overlap if there are better options
  const sorted = scored.sort((a, b) => b.score - a.score);
  const withOverlap = sorted.filter(p => p.score > 0);

  // If we have enough with real overlap use those, otherwise fall back to top posts
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
