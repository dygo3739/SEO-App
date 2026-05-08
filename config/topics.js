// ─────────────────────────────────────────────────────────────────
//  config/topics.js
//  Edit this file to customise the pipeline for each project.
// ─────────────────────────────────────────────────────────────────

// Business context — used to guide keyword research and article tone
export const BUSINESS = {
  name: "HelpWithVows",
  type: "boutique wedding vow writing service",
  audience: "engaged couples planning their wedding",
  location: "United States",
  tone: "warm, romantic, heartfelt, and encouraging",
  niche: "personalized wedding vow writing, vow coaching, and ceremony wording",
};

// ── Publishing settings ───────────────────────────────────────────
export const PUBLISHING = {
  // WordPress category ID for "Blog".
  // To find yours: WordPress Admin → Posts → Categories → hover the category → check the ID in the URL
  // e.g. .../term.php?taxonomy=category&tag_ID=3  →  categoryId: 3
  categoryId: 8,

  // Post status: "publish" (live immediately) or "draft" (save as draft for review)
  postStatus: "publish",
};

// Site start date — controls which difficulty tier is active
export const SITE_START_DATE = "2025-01-01";

// Topic queue — picked in round-robin order (least-used first)
export const TOPICS = [
  "how to write wedding vows",
  "wedding vow examples",
  "personal wedding vows",
  "short wedding vows",
  "funny wedding vows",
  "traditional wedding vows",
  "non religious wedding vows",
  "wedding vows for him",
  "wedding vows for her",
  "how long should wedding vows be",
  "wedding vow renewal ideas",
  "unique wedding vows",
  "simple wedding vows",
  "emotional wedding vows",
  "writing your own wedding vows tips",
];

// Difficulty tiers — unlock automatically based on weeks since SITE_START_DATE
export const TIERS = [
  { id: 1, label: "Beginner",  weeksStart: 0,  kdMax: 25,  volMin: 0,    desc: "Long-tail, low competition" },
  { id: 2, label: "Growing",   weeksStart: 4,  kdMax: 45,  volMin: 100,  desc: "Moderate competition"       },
  { id: 3, label: "Competing", weeksStart: 13, kdMax: 65,  volMin: 500,  desc: "Real traffic potential"     },
  { id: 4, label: "Authority", weeksStart: 25, kdMax: 100, volMin: 1000, desc: "High-value, high authority" },
];
