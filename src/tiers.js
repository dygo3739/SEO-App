import { TIERS, SITE_START_DATE } from "../config/topics.js";

export function getActiveTier() {
  const siteStartMs = new Date(SITE_START_DATE).getTime();
  const weeksElapsed = (Date.now() - siteStartMs) / (1000 * 60 * 60 * 24 * 7);
  const eligible = TIERS.filter(t => weeksElapsed >= t.weeksStart);
  return eligible[eligible.length - 1];
}

export function scoreKeyword(volume, kd) {
  return Math.round((volume || 0) * (1 - (kd || 50) / 100));
}

export function selectBestKeyword(candidates, tier) {
  const passing = candidates
    .filter(c => c.kd <= tier.kdMax && c.vol >= tier.volMin)
    .map(c => ({ ...c, score: scoreKeyword(c.vol, c.kd) }))
    .sort((a, b) => b.score - a.score);
  return passing[0] || null;
}
