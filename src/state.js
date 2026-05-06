import fs from "fs";
import path from "path";

const STATE_FILE = path.resolve("state.json");
const DEFAULT_STATE = { topics: [], runs: [] };

export function loadState() {
  if (!fs.existsSync(STATE_FILE)) return structuredClone(DEFAULT_STATE);
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  } catch {
    return structuredClone(DEFAULT_STATE);
  }
}

export function saveState(state) {
  state.runs = (state.runs || []).slice(0, 100);
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

export function syncTopics(state, configTopics) {
  const existing = new Map(state.topics.map(t => [t.topic, t]));
  state.topics = configTopics.map(topic =>
    existing.get(topic) || { topic, uses: 0, lastKd: null, lastScore: null, lastRun: null }
  );
  return state;
}

export function pickTopic(state) {
  const available = state.topics.filter(t => !t.disabled);
  if (!available.length) return null;
  return [...available].sort((a, b) => (a.uses || 0) - (b.uses || 0))[0];
}

export function recordRun(state, run) {
  state.topics = state.topics.map(t =>
    t.topic === run.topic
      ? { ...t, uses: (t.uses || 0) + 1, lastKd: run.kd, lastScore: run.score, lastRun: run.startedAt }
      : t
  );
  state.runs = [run, ...(state.runs || [])];
  return state;
}
