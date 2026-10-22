const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const DEFAULT_PRELOAD_TIMEOUT_MS = 8000;
const MAX_GROUP_CHARS_FOR_HALF_ROW = 6;

const twoDigits = (value) => String(value).padStart(2, '0');

export function timerText(step, startedAtMs, nowMs) {
  if (step.minutes === null) return { text: '照大家的步調', overtime: false };
  const remaining = step.minutes * 60 - Math.floor((nowMs - startedAtMs) / 1000);
  if (remaining >= 0) {
    return { text: `還剩 ${twoDigits(Math.floor(remaining / 60))}:${twoDigits(remaining % 60)}`, overtime: false };
  }
  const overMinutes = Math.ceil(-remaining / 60);
  return { text: `超過 ${overMinutes} 分鐘了，沒關係，聊開了就讓大家聊`, overtime: true };
}

export function progressText(index, total) {
  return `第 ${index + 1} 步，共 ${total} 步`;
}

export function preflightItems(activity) {
  return [...activity.preflight];
}

const sessionKey = (activityId) => `brotime:live:${activityId}`;

export function saveSession(storage, activityId, { index, startedAtMs, district }, nowMs) {
  try {
    storage.setItem(sessionKey(activityId), JSON.stringify({ index, startedAtMs, district, savedAtMs: nowMs }));
  } catch {
    // Private browsing or a full quota: live mode keeps working, it just cannot resume.
  }
}

function isSavedSession(value) {
  return (
    typeof value === 'object' &&
    value !== null &&
    Number.isInteger(value.index) &&
    value.index >= 0 &&
    Number.isFinite(value.startedAtMs) &&
    (typeof value.district === 'string' || value.district === null) &&
    Number.isFinite(value.savedAtMs)
  );
}

export function loadSession(storage, activityId, nowMs) {
  try {
    const saved = JSON.parse(storage.getItem(sessionKey(activityId)));
    if (!isSavedSession(saved) || nowMs - saved.savedAtMs > SESSION_MAX_AGE_MS) return null;
    return { index: saved.index, startedAtMs: saved.startedAtMs, district: saved.district };
  } catch {
    return null;
  }
}

export function clearSession(storage, activityId) {
  try {
    storage.removeItem(sessionKey(activityId));
  } catch {
    // Nothing to clear when storage is unavailable.
  }
}

function cardsShownIn(activity, step, key) {
  const cards = activity.cardSets[key].cards;
  return step.cardIds ? cards.filter((card) => step.cardIds.includes(card.id)) : cards;
}

export function imageUrlsFor(activity, steps) {
  const urls = new Set();
  for (const step of steps) {
    for (const key of step.cards ?? []) {
      for (const card of cardsShownIn(activity, step, key)) urls.add(`cards/${activity.id}/${card.id}.webp`);
    }
  }
  return [...urls];
}

export function storyCardBefore(activity, steps, index, picks) {
  for (let i = index - 1; i >= 0; i -= 1) {
    const key = steps[i].cards?.find((cardKey) => activity.cardSets[cardKey].kind === 'story');
    if (key === undefined) continue;
    const cards = cardsShownIn(activity, steps[i], key);
    return cards.find((card) => card.id === picks.get(`${i}:${key}`)) ?? cards[0] ?? null;
  }
  return null;
}

function loadsWithin(url, loadOne, timeoutMs) {
  let timer;
  const timedOut = new Promise((resolve) => {
    timer = setTimeout(() => resolve(false), timeoutMs);
  });
  const loaded = Promise.resolve()
    .then(() => loadOne(url))
    .then(
      () => true,
      () => false,
    );
  return Promise.race([loaded, timedOut]).finally(() => clearTimeout(timer));
}

export async function preload(urls, loadOne, timeoutMs = DEFAULT_PRELOAD_TIMEOUT_MS) {
  const loaded = await Promise.all(urls.map((url) => loadsWithin(url, loadOne, timeoutMs)));
  return { failed: urls.filter((_, i) => !loaded[i]) };
}

export function groupsOf(cards) {
  return [...new Set(cards.map((card) => card.group).filter(Boolean))];
}

export function groupsNeedFullRow(groups) {
  return groups.some((group) => [...group].length > MAX_GROUP_CHARS_FOR_HALF_ROW);
}

export function drawCard(cards, drawnIds, group, random = Math.random) {
  const deck = group === null ? cards : cards.filter((card) => card.group === group);
  const undrawn = deck.filter((card) => !drawnIds.includes(card.id));
  const deckIds = deck.map((card) => card.id);
  const startOver = undrawn.length === 0;
  const keptIds = startOver ? drawnIds.filter((id) => !deckIds.includes(id)) : drawnIds;
  const lastDrawnId = drawnIds.filter((id) => deckIds.includes(id)).pop();
  const restartDeck = deck.length > 1 ? deck.filter((card) => card.id !== lastDrawnId) : deck;
  const choices = startOver ? restartDeck : undrawn;
  const card = choices[Math.floor(random() * choices.length)];
  return { card, drawnIds: [...keptIds, card.id] };
}
