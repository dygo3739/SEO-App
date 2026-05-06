export async function publishPost(article, keyword, image, log) {
  const wpUrl = process.env.WP_URL;
  const wpUser = process.env.WP_USER;
  const wpPass = process.env.WP_APP_PASSWORD;
  if (!wpUrl || !wpUser || !wpPass) throw new Error("Missing WP_URL, WP_USER, or WP_APP_PASSWORD");

  const base = wpUrl.replace(/\/$/, "");
  const auth = "Basic " + Buffer.from(`${wpUser}:${wpPass}`).toString("base64");
  const headers = { Authorization: auth, "Content-Type": "application/json" };

  log(`Downloading hero image...`);
  const imgRes = await fetch(image.url);
  if (!imgRes.ok) throw new Error(`Failed to download image: HTTP ${imgRes.status}`);
  const imgBytes = Buffer.from(await imgRes.arrayBuffer());

  log(`Uploading image to WordPress...`);
  const filename = `${keyword.replace(/\s+/g, "-").toLowerCase()}-hero.jpg`;
  const mediaRes = await fetch(`${base}/wp-json/wp/v2/media`, {
    method: "POST",
    headers: {
      Authorization: auth,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Type": "image/jpeg",
    },
    body: imgBytes,
  });

  if (!mediaRes.ok) {
    const err = await mediaRes.json().catch(() => ({}));
    throw new Error(`WordPress media upload failed: ${err.message || mediaRes.statusText}`);
  }

  const media = await mediaRes.json();
  log(`Image uploaded (ID: ${media.id})`);

  await fetch(`${base}/wp-json/wp/v2/media/${media.id}`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      alt_text: image.alt,
      caption: `Photo by <a href="${image.credit.profileUrl}">${image.credit.name}</a> on <a href="${image.credit.photoUrl}">Unsplash</a>`,
    }),
  }).catch(() => {});

  const heroHtml = `<figure class="wp-block-image size-large alignwide">
  <img src="${image.url}" alt="${image.alt}" />
  <figcaption>Photo by <a href="${image.credit.profileUrl}">${image.credit.name}</a> on <a href="${image.credit.photoUrl}">Unsplash</a></figcaption>
</figure>\n\n`;

  log(`Publishing post to WordPress...`);
  const postRes = await fetch(`${base}/wp-json/wp/v2/posts`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      title: article.title,
      content: heroHtml + article.content,
      excerpt: article.excerpt,
      status: "publish",
      featured_media: media.id,
    }),
  });

  if (!postRes.ok) {
    const err = await postRes.json().catch(() => ({}));
    throw new Error(`WordPress publish failed: ${err.message || postRes.statusText}`);
  }

  const post = await postRes.json();
  log(`Published: ${post.link}`);

  log(`Writing Yoast SEO fields...`);
  const yoastRes = await fetch(`${base}/wp-json/wp/v2/posts/${post.id}`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      meta: {
        _yoast_wpseo_focuskw: keyword,
        _yoast_wpseo_metadesc: article.excerpt,
        _yoast_wpseo_title: article.seo_title || `${article.title} %%sep%% %%sitename%%`,
        _yoast_wpseo_canonical: post.link,
      },
    }),
  });

  if (!yoastRes.ok) {
    log(`Yoast fields not written - enable REST API in Yoast Settings > Integrations`, "warn");
  } else {
    log(`Yoast fields written OK`);
  }

  return { postId: post.id, postUrl: post.link, mediaId: media.id, mediaUrl: media.source_url };
}
