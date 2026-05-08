// src/import-glossary.js
// Reads glossary.json and posts each term to WordPress as a custom post type "terms".
// Run via: Actions → Glossary Import → Run workflow
// Safe to re-run — skips terms that already exist (checks by title).

import fs from "fs";
import path from "path";

const DRY_RUN = process.env.DRY_RUN === "true";
const GLOSSARY_FILE = path.resolve("glossary.json");

// ── WordPress helpers ─────────────────────────────────────────────
function getAuth() {
  const url  = process.env.WP_URL;
  const user = process.env.WP_USER;
  const pass = process.env.WP_APP_PASSWORD;
  if (!url || !user || !pass) throw new Error("Missing WP_URL, WP_USER, or WP_APP_PASSWORD");
  const base = url.replace(/\/$/, "");
  const auth = "Basic " + Buffer.from(`${user}:${pass}`).toString("base64");
  return { base, auth };
}

// Fetch all existing "terms" post slugs so we can skip duplicates
async function fetchExistingSlugs(base, auth) {
  const slugs = new Set();
  let page = 1;
  while (true) {
    const res = await fetch(
      `${base}/wp-json/wp/v2/terms?per_page=100&page=${page}&status=any&_fields=slug`,
      { headers: { Authorization: auth } }
    );
    if (!res.ok) break;
    const posts = await res.json();
    if (!posts.length) break;
    posts.forEach(p => slugs.add(p.slug));
    if (posts.length < 100) break;
    page++;
  }
  return slugs;
}

// Convert a term name to a WordPress slug
function toSlug(term) {
  return term.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// Convert plain text definition to simple HTML paragraphs
function toHtml(text) {
  return text
    .split(/\n\n+/)
    .map(p => `<p>${p.trim().replace(/\n/g, " ")}</p>`)
    .join("\n");
}

// Post a single term to WordPress
async function postTerm(base, auth, term, definition) {
  const content = toHtml(definition);

  const res = await fetch(`${base}/wp-json/wp/v2/terms`, {
    method: "POST",
    headers: { Authorization: auth, "Content-Type": "application/json" },
    body: JSON.stringify({
      title:   term,
      content: content,
      status:  "publish",
      slug:    toSlug(term),
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || res.statusText);
  }

  return await res.json();
}

// ── Main ──────────────────────────────────────────────────────────
async function main() {
  console.log(`\nHelpWithVows Glossary Import`);
  console.log(`Mode: ${DRY_RUN ? "DRY RUN (nothing will be posted)" : "LIVE"}\n`);

  // Load glossary
  if (!fs.existsSync(GLOSSARY_FILE)) {
    throw new Error(`glossary.json not found — make sure it is in the repo root`);
  }
  const terms = JSON.parse(fs.readFileSync(GLOSSARY_FILE, "utf8"));
  console.log(`Found ${terms.length} terms in glossary.json\n`);

  if (DRY_RUN) {
    console.log("Terms that would be posted:");
    terms.forEach((t, i) => console.log(`  ${i + 1}. ${t.term}`));
    console.log("\nRe-run with dry_run = false to post them.");
    return;
  }

  const { base, auth } = getAuth();

  // Fetch existing slugs to avoid duplicates
  console.log("Checking for existing terms...");
  const existingSlugs = await fetchExistingSlugs(base, auth);
  console.log(`Found ${existingSlugs.size} existing terms in WordPress\n`);

  // Import each term
  let posted = 0, skipped = 0, failed = 0;

  for (const { term, definition } of terms) {
    const slug = toSlug(term);

    if (existingSlugs.has(slug)) {
      console.log(`  SKIP  "${term}" — already exists`);
      skipped++;
      continue;
    }

    try {
      const post = await postTerm(base, auth, term, definition);
      console.log(`  POST  "${term}" → ${post.link}`);
      posted++;

      // Small delay to avoid hammering the WP REST API
      await new Promise(r => setTimeout(r, 300));
    } catch (err) {
      console.error(`  FAIL  "${term}" — ${err.message}`);
      failed++;
    }
  }

  // Summary
  console.log(`\n─────────────────────────────`);
  console.log(`Import complete`);
  console.log(`  Posted  : ${posted}`);
  console.log(`  Skipped : ${skipped} (already existed)`);
  console.log(`  Failed  : ${failed}`);
  console.log(`─────────────────────────────\n`);

  if (failed > 0) process.exit(1);
}

main().catch(err => {
  console.error(`\nImport failed: ${err.message}`);
  process.exit(1);
});
