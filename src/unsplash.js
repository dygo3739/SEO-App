export async function fetchHeroImage(query, log) {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey) throw new Error("Missing UNSPLASH_ACCESS_KEY env var");

  log(`Fetching Unsplash image for: "${query}"...`);

  const url = new URL("https://api.unsplash.com/search/photos");
  url.searchParams.set("query", query);
  url.searchParams.set("per_page", "5");
  url.searchParams.set("orientation", "landscape");
  url.searchParams.set("content_filter", "high");

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Client-ID ${accessKey}`, "Accept-Version": "v1" },
  });

  if (!res.ok) throw new Error(`Unsplash API HTTP ${res.status}: ${await res.text()}`);

  const data = await res.json();
  const photos = data.results || [];
  if (photos.length === 0) throw new Error(`No Unsplash photos found for: "${query}"`);

  const best = photos.sort((a, b) => (b.likes || 0) - (a.likes || 0))[0];

  await fetch(best.links.download_location, {
    headers: { Authorization: `Client-ID ${accessKey}`, "Accept-Version": "v1" },
  }).catch(() => {});

  const image = {
    url: best.urls.regular,
    alt: best.alt_description || best.description || query,
    credit: {
      name: best.user.name,
      username: best.user.username,
      profileUrl: `https://unsplash.com/@${best.user.username}?utm_source=seo_autopilot&utm_medium=referral`,
      photoUrl: `${best.links.html}?utm_source=seo_autopilot&utm_medium=referral`,
    },
    width: best.width,
    height: best.height,
  };

  log(`Image: "${image.alt}" by ${image.credit.name}`);
  return image;
}
