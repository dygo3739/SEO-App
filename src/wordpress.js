// src/wordpress.js

import { PUBLISHING } from "../config/topics.js";

export async function publishPost(article, keyword, image, log) {
  const wpUrl = process.env.WP_URL;
  const wpUser = process.env.WP_USER;
  const wpPass = process.env.WP_APP_PASSWORD;
  if (!wpUrl || !wpUser || !wpPass) throw new Error("Missing WP_URL, WP_USER, or WP_APP_PASSWORD");

  const base = wpUrl.replace(/\/$/, "");
  const auth = "Basic " + Buffer.from(`${wpUser}:${wpPass}`).toString("base64");
  const headers = { Authorization: auth, "Content-Type": "application/json" };

  // ── 1. Download image from Unsplash ──────────────────────────────
  log(`Downloading hero image...`);
  const imgRes = await fetch(image.url);
  if (!imgRes.ok) throw new Error(`Failed to download image: HTTP ${imgRes.status}`);
  const imgBytes = Buffer.from(await imgRes.arrayBuffer());

  // ── 2. Upload to WordPress media library ──────────────────────────
  log(`Uploading image to WordPress media library...`);
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

  // Set alt text + Unsplash credit on the media item
  await fetch(`${base}/wp-json/wp/v2/media/${media.id}`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      alt_text: image.alt,
      caption: `Photo by <a href="${image.credit.profileUrl}">${image.credit.name}</a> on <a href="${image.credit.photoUrl}">Unsplash</a>`,
    }),
  }).catch(() => {});

  // ── 3. Validate meta description ─────────────────────────────────
  let metaDesc = article.excerpt || "";
  if (metaDesc.length > 155) metaDesc = metaDesc.slice(0, 152) + "...";
  if (metaDesc.length < 120) {
    log(`Meta description too short (${metaDesc.length} chars) — should be 120-155`, "warn");
  }
  log(`Meta description (${metaDesc.length} chars): "${metaDesc}"`);

  // ── 4. Publish the post ───────────────────────────────────────────
  log(`Publishing post to WordPress (category ID: ${PUBLISHING.categoryId}, status: ${PUBLISHING.postStatus})...`);

  const postRes = await fetch(`${base}/wp-json/wp/v2/posts`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      title:          article.title,
      content:        article.content,
      excerpt:        metaDesc,
      status:         PUBLISHING.postStatus,
      featured_media: media.id,
      categories:     [PUBLISHING.categoryId],  // ← assigns "Blog" category
    }),
  });

  if (!postRes.ok) {
    const err = await postRes.json().catch(() => ({}));
    throw new Error(`WordPress publish failed: ${err.message || postRes.statusText}`);
  }

  const post = await postRes.json();
  log(`Published: ${post.link} (post ID: ${post.id}, category: ${PUBLISHING.categoryId})`);

  // ── 5. Write Yoast SEO fields ─────────────────────────────────────
  log(`Writing Yoast SEO fields...`);
  log(`  Focus keyphrase : "${keyword}"`);
  log(`  Meta description: "${metaDesc}"`);

  const yoastRes = await fetch(`${base}/wp-json/wp/v2/posts/${post.id}`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      meta: {
        _yoast_wpseo_focuskw:   keyword,
        _yoast_wpseo_metadesc:  metaDesc,
        _yoast_wpseo_title:     article.seo_title || `${article.title} %%sep%% %%sitename%%`,
        _yoast_wpseo_canonical: post.link,
      },
    }),
  });

  if (!yoastRes.ok) {
    const err = await yoastRes.json().catch(() => ({}));
    log(`Yoast fields not written (${err.message || yoastRes.status})`, "warn");
    log(`  Fix: Yoast SEO → Settings → Integrations → enable REST API`, "warn");
  } else {
    const updated = await yoastRes.json();
    const meta = updated.meta || {};
    const savedKw = meta._yoast_wpseo_focuskw;
    const savedDesc = meta._yoast_wpseo_metadesc;
    if (savedKw && savedDesc) {
      log(`Yoast fields confirmed — keyphrase: "${savedKw}", desc: ${savedDesc.length} chars`);
    } else {
      log(`Yoast fields sent but not confirmed — enable REST API in Yoast Settings → Integrations`, "warn");
    }
  }

  return {
    postId:   post.id,
    postUrl:  post.link,
    mediaId:  media.id,
    mediaUrl: media.source_url,
  };
}
