export const DEFAULT_GENERATION_ACTIVITY_FEED_LIMIT = 12;

function normalizeFeedLimit(limit) {
  return Number.isInteger(limit) && limit > 0 ? limit : DEFAULT_GENERATION_ACTIVITY_FEED_LIMIT;
}

function getActivityOrderAt(entry) {
  return String(entry?.orderAt || entry?.at || "");
}

export function sortGenerationActivityFeed(entries) {
  const source = Array.isArray(entries) ? entries : [];
  return [...source].sort((left, right) => getActivityOrderAt(right).localeCompare(getActivityOrderAt(left)));
}

export function upsertGenerationActivityEntry(feed, entry, limit = DEFAULT_GENERATION_ACTIVITY_FEED_LIMIT) {
  const source = Array.isArray(feed) ? feed : [];
  const key = String(entry?.key || "").trim();
  if (!key) {
    return sortGenerationActivityFeed(source).slice(0, normalizeFeedLimit(limit));
  }

  const existing = source.find((item) => String(item?.key || "").trim() === key);
  const nextEntry = {
    ...existing,
    ...entry,
    key,
    orderAt: String(existing?.orderAt || existing?.at || entry?.orderAt || entry?.at || ""),
  };
  const nextFeed = existing
    ? source.map((item) => (String(item?.key || "").trim() === key ? nextEntry : item))
    : [nextEntry, ...source];

  return sortGenerationActivityFeed(nextFeed).slice(0, normalizeFeedLimit(limit));
}
