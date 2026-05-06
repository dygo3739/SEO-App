import { selectBestKeyword } from "./tiers.js";

const BASE = "https://api.dataforseo.com/v3";

function authHeader() {
  const user = process.env.DATAFORSEO_USER;
  const pass = process.env.DATAFORSEO_PASS;
  if (!user || !pass) throw new Error("Missing DATAFORSEO_USER or DATAFORSEO_PASS env vars");
  return "Basic " + Buffer.from(`${user}:${pass}`).toString("base64");
}

async function post(endpoint, body) {
  const res = await fetch(`${BASE}${endpoint}`, {
    method: "POST",
    headers: { Authorization: authHeader(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`DataForSEO ${endpoint} HTTP ${res.status}`);
  const data = await res.json();
  if (data.status_code !== 20000) throw new Error(`DataForSEO error: ${data.status_message}`);
  return data;
}

export async function researchKeywords(topic, tier, log) {
  const variants = [
    topic,
    `best ${topic}`,
    `how to ${topic}`,
    `${topic} guide`,
    `${topic} tips`,
    `${topic} for beginners`,
  ];

  log(`Fetching volume for ${variants.length} keyword variants...`);
  const volData = await post("/keywords_data/google_ads/search_volume/live", [
    { keywords: variants, location_code: 2840, language_code: "en" },
  ]);
  const volResults = volData.tasks?.[0]?.result || [];

  log(`Fetching keyword difficulty...`);
  const kdData = await post("/dataforseo_labs/google/keyword_difficulty/live", [
    { keywords: variants, location_code: 2840, language_code: "en" },
  ]);
  const kdResults = kdData.tasks?.[0]?.result || [];
  const kdMap = Object.fromEntries(kdResults.map(r => [r.keyword, r.keyword_difficulty ?? 50]));

  const candidates = volResults.map(r => ({
    keyword: r.keyword,
    vol: r.search_volume || 0,
    kd: kdMap[r.keyword] ?? 50,
  }));

  log(`Candidates: ${candidates.map(c => `"${c.keyword}" vol=${c.vol} KD=${c.kd}`).join(", ")}`);

  const best = selectBestKeyword(candidates, tier);

  if (!best) {
    log(`No candidates passed Tier ${tier.id} filter (KD<=${tier.kdMax}, vol>=${tier.volMin}) - using topic directly`, "warn");
    return { keyword: topic, kd: null, vol: null, score: null };
  }

  log(`Selected: "${best.keyword}" - vol ${best.vol.toLocaleString()}, KD ${best.kd}, score ${best.score.toLocaleString()}`);
  return best;
}
