// src/pipeline.js

import { TOPICS } from "../config/topics.js";
import { loadState, saveState, syncTopics, pickTopic, recordRun } from "./state.js";
import { getActiveTier } from "./tiers.js";
import { researchKeywords } from "./keywords.js";
import { fetchPublishedPosts, fetchGlossaryTerms, selectRelevantPosts, selectRelevantTerms } from "./sitemap.js";
import { generateArticle } from "./article.js";
import { fetchHeroImage } from "./unsplash.js";
import { publishPost } from "./wordpress.js";
import { createPin } from "./pinterest.js";

function makeLogger() {
  const entries = [];
  function log(msg, type = "info") {
    const prefix = { info: "  ", success: "✓ ", warn: "⚠ ", error: "✗ " }[type] || "  ";
    console.log(`[${new Date().toISOString()}] ${prefix}${msg}`);
    entries.push({ msg, type, time: new Date().toISOString() });
  }
  return { log, entries };
}

async function main() {
  const { log, entries } = makeLogger();
  const startedAt = new Date().toISOString();
  let runRecord = { status: "error", startedAt, logs: entries };

  try {
    // 1. Load + sync state
    log("Loading state...");
    let state = loadState();
    state = syncTopics(state, TOPICS);

    // 2. Pick topic
    const topicOverride = process.env.TOPIC_OVERRIDE?.trim();
    const topicEntry = topicOverride
      ? { topic: topicOverride, uses: 0 }
      : pickTopic(state);
    if (!topicEntry) throw new Error("No topics available — add some to config/topics.js");

    const topic = topicEntry.topic;
    runRecord.topic = topic;
    log(`Topic: "${topic}" ${topicOverride ? "(manual override)" : `(used ${topicEntry.uses}x before)`}`);

    // 3. Active tier
    const tier = getActiveTier();
    runRecord.tierId = tier.id;
    log(`Active tier: ${tier.id} — ${tier.label} (KD<=${tier.kdMax}, vol>=${tier.volMin})`);

    // 4. Keyword research
    const kwResult = await researchKeywords(topic, tier, log);
    runRecord = { ...runRecord, keyword: kwResult.keyword, kd: kwResult.kd, vol: kwResult.vol, score: kwResult.score };

    // 5. Fetch posts + glossary terms for internal linking (run in parallel)
    log(`Fetching internal link sources...`);
    const [allPosts, allTerms] = await Promise.all([
      fetchPublishedPosts(log),
      fetchGlossaryTerms(log),
    ]);

    const relatedPosts  = selectRelevantPosts(allPosts, kwResult.keyword, 3);
    const relatedTerms  = selectRelevantTerms(allTerms, kwResult.keyword, 3);

    log(`Internal links selected:`);
    log(`  Posts (${relatedPosts.length}): ${relatedPosts.map(p => `"${p.title}"`).join(", ") || "none"}`);
    log(`  Terms (${relatedTerms.length}): ${relatedTerms.map(t => `"${t.title}"`).join(", ") || "none"}`);

    runRecord.internalPostLinks = relatedPosts.length;
    runRecord.internalTermLinks = relatedTerms.length;

    // 6. Generate article
    const article = await generateArticle(kwResult.keyword, kwResult.kd, kwResult.vol, relatedPosts, relatedTerms, log);
    runRecord.title = article.title;

    // 7. Fetch hero image from Unsplash
    const image = await fetchHeroImage(article.unsplash_query, log);
    runRecord.imageUrl = image.url;
    runRecord.imageCredit = image.credit.name;

    // 8. Publish to WordPress
    const { postId, postUrl, mediaId, mediaUrl } = await publishPost(article, kwResult.keyword, image, log);
    runRecord = { ...runRecord, postId, postUrl, mediaId, mediaUrl };

    // 9. Pinterest — optional, non-fatal
    const pinterestToken   = process.env.PINTEREST_TOKEN?.trim();
    const pinterestBoardId = process.env.PINTEREST_BOARD_ID?.trim();

    if (!pinterestToken || !pinterestBoardId) {
      log("Pinterest skipped — add PINTEREST_TOKEN + PINTEREST_BOARD_ID to GitHub Secrets once approved", "warn");
    } else {
      try {
        const { pinId } = await createPin(article, postUrl, image, log);
        runRecord.pinId = pinId;
      } catch (pinErr) {
        log(`Pinterest pin failed: ${pinErr.message}`, "warn");
        log("  Post is still published — Pinterest will retry next run", "warn");
        runRecord.pinError = pinErr.message;
      }
    }

    // 10. Save state
    runRecord.status = "success";
    runRecord.finishedAt = new Date().toISOString();
    state = recordRun(state, runRecord);
    saveState(state);

    log("\nPipeline complete!", "success");
    log(`   Keyword      : ${kwResult.keyword}`);
    log(`   Article      : ${article.title}`);
    log(`   Post links   : ${relatedPosts.length}`);
    log(`   Term links   : ${relatedTerms.length}`);
    log(`   Image        : ${image.url} (by ${image.credit.name})`);
    log(`   Post         : ${postUrl}`);
    log(`   Pin          : ${runRecord.pinId ?? "skipped"}`);

  } catch (err) {
    console.error(`\nPipeline failed: ${err.message}`);
    console.error(err.stack);
    try {
      const state = loadState();
      runRecord.status = "error";
      runRecord.error = err.message;
      runRecord.finishedAt = new Date().toISOString();
      recordRun(state, runRecord);
      saveState(state);
    } catch (saveErr) {
      console.error("Could not save failure state:", saveErr.message);
    }
    process.exit(1);
  }
}

main();
