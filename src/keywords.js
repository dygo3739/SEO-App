import { selectBestKeyword } from "./tiers.js";
import { BUSINESS } from "../config/topics.js";

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

// Generate keyword variants tailored to the business niche and audience
function buildVariants(topic) {
  return [
    topic,
    `${topic} examples`,
    `${topic} ideas`,
    `${topic} tips`,
    `best ${topic}`,
    `how to write ${topic}`,
    `${topic} for wedding ceremony`,
    `${topic} that make you cry`,
  ].slice(0, 8);
}

export async function researchKeywords(topic, tier, log) {
  const variants = buildVariants(topic);

  try {
    log(`Fetching search volume for ${variants.length} variants (niche: ${BUSINESS.niche})...`);
    const volData = await post("/keywords_data/google_ads/search_volume/live", [
      { keywords: variants, location_code: 2840, language_code: "en" },
    ]);
    const volResults = volData.tasks?.[0]?.result || [];

    const candidates = volResults.map(r => ({
      keyword: r.keyword,
      vol: r.search_volume || 0,
      kd: 50,
    }));

    log(`Candidates: ${candidates.map(c => `"${c.keyword}" vol=${c.vol}`).join(", ")}`);

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
    return { keyword: topic, kd: null, vol: null, score: null };
  }
}
