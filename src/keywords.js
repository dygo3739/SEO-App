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

  try {
    log(`Fetching search volume for ${variants.length} keyword variants...`);
    const volData = await post("/keywords_data/google_ads/search_volume/live", [
      { keywords: variants, location_code: 2840, language_code: "en" },
    ]);
    const volResults = volData.tasks?.[0]?.result || [];

    // KD not available on all plans — default to 50 (mid-range) so scoring still works
    const candidates = volResults.map(r => ({
      keyword: r.keyword,
      vol: r.search_volume || 0,
      kd: 50,
    }));

    log(`Candidates: ${candidates.map(c => `"${c.keyword}" vol=${c.vol}`).join(", ")}`);

    // Sort by volume descending — pick highest volume that passes tier's volMin
    const passing = candidates
      .filter(c => c.vol >= tier.volMin)
      .sort((a, b) => b.vol - a.vol);

    if (!passing.length) {
      log(`No candidates met vol>=${tier.volMin} for Tier ${tier.id} - using topic directly`, "warn");
      return { keyword: topic, kd: null, vol: null, score: null };
    }

    const best = passing[0];
    log(`Selected: "${best.keyword}" - vol ${best.vol.toLocaleString()}`);
    return { keyword: best.keyword, kd: null, vol: best.vol, score: best.vol };

  } catch (err) {
    log(`DataForSEO skipped (${err.message}) - using topic as keyword`, "warn");
    log(`  Check DATAFORSEO_USER / DATAFORSEO_PASS in GitHub Secrets`, "warn");
    return { keyword: topic, kd: null, vol: null, score: null };
  }
}
