export async function createPin(article, postUrl, image, log) {
  const token = process.env.PINTEREST_TOKEN;
  const boardId = process.env.PINTEREST_BOARD_ID;
  if (!token || !boardId) throw new Error("Missing PINTEREST_TOKEN or PINTEREST_BOARD_ID");

  log(`Creating Pinterest pin...`);
  const res = await fetch("https://api.pinterest.com/v5/pins", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      board_id: boardId,
      title: article.title,
      description: article.pinterest_description || article.excerpt,
      link: postUrl,
      media_source: { source_type: "image_url", url: image.url },
      alt_text: image.alt,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Pinterest pin failed: ${err.message || res.statusText}`);
  }

  const pin = await res.json();
  log(`Pin created (ID: ${pin.id})`);
  return { pinId: pin.id };
}
