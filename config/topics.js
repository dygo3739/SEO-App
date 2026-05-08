// ─────────────────────────────────────────────────────────────────
//  config/topics.js
//  Edit this file to customise the pipeline for each project.
// ─────────────────────────────────────────────────────────────────

// Business context — used to guide keyword variants and article tone
export const BUSINESS = {
  name: "HelpWithVows",
  type: "boutique wedding vow writing service",
  audience: "engaged couples planning their wedding",
  location: "United States",
  tone: "warm, romantic, heartfelt, and encouraging",
  niche: "personalized wedding vow writing, vow coaching, and ceremony wording",
};

// Site start date — controls which difficulty tier is active
export const SITE_START_DATE = "2025-01-01";

// Topic queue — picked in round-robin order (least-used first)
// Keep topics broad — the pipeline finds the best keyword variant automatically
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
