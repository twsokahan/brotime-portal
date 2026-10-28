export const GUIDE_HEADING = '翻書念故事';
export const BOOKS_HEADING = '要準備的書';
export const SERIES = '《新・人間革命》';

const COUNT_WORDS = { 2: '兩', 3: '三', 4: '四', 5: '五' };
const BORROW = '手邊沒有就跟區裡借。';
const STOP_ROLES = { stop1: '停留點一念', end: '終點念' };
const PENDING_STOP = '另一本是停留點一那區的故事卡所在的那一卷，依你選的區而定，選好區就會顯示在這裡。';

const countWord = (count) => COUNT_WORDS[count] ?? String(count);
const andList = (items) => (items.length <= 2 ? items.join('和') : `${items.slice(0, -1).join('、')}和${items.at(-1)}`);
const volumeNumber = (volume) => Number(/\d+/.exec(volume)?.[0] ?? 0);
const chapterText = (chapters) => chapters.map((chapter) => `〈${chapter}〉`).join('');
const idList = (cards) => cards.map((card) => card.id).join('、');

export const bookTitle = (guide) => `${guide.volume}〈${guide.chapter}〉`;

export const bringVolume = (guide) => `要帶${guide.volume}`;

export const guideRows = (guide) => [...guide.steps, { label: '多久', text: guide.duration, note: '' }];

export function volumeGroups(cards) {
  const groups = new Map();
  for (const card of cards) {
    const { volume, chapter } = card.guide;
    const group = groups.get(volume) ?? { volume, chapters: [], cardIds: [] };
    if (!group.chapters.includes(chapter)) group.chapters.push(chapter);
    group.cardIds.push(card.id);
    groups.set(volume, group);
  }
  return [...groups.values()];
}

const groupTitle = (group) => `${group.volume}${chapterText(group.chapters)}`;

function booksOf(cards) {
  const groups = volumeGroups(cards);
  return { count: countWord(groups.length), titles: groups.map(groupTitle) };
}

export function booksToBring(cards) {
  const { count, titles } = booksOf(cards);
  return titles.length === 1 ? `要帶${SERIES}${titles[0]}` : `要帶${count}本${SERIES}：${titles.join('、')}`;
}

export function booksPacked(cards) {
  const { count, titles } = booksOf(cards);
  return titles.length === 1 ? `${SERIES}${titles[0]}帶了` : `${count}本${SERIES}帶了：${titles.join('、')}`;
}

function slotCards(step, cardSets) {
  return (step.cards ?? []).flatMap((key) => {
    const set = cardSets[key];
    if (set.kind !== 'story') return [];
    return step.cardIds ? set.cards.filter((card) => step.cardIds.includes(card.id)) : set.cards;
  });
}

export function storySlots(steps, cardSets) {
  return steps.flatMap((step) => {
    if (step.routeStop === 'stop1' && !step.cards) return [{ stop: 'stop1', cards: [] }];
    const cards = slotCards(step, cardSets);
    return cards.length ? [{ stop: step.routeStop, cards }] : [];
  });
}

function bookRows(groups, slots) {
  const roleOf = (cardId) => STOP_ROLES[slots.find((slot) => slot.cards.some((card) => card.id === cardId))?.stop];
  return groups.map((group) => ({
    cards: group.cardIds.join('、'),
    volume: group.volume,
    chapters: chapterText(group.chapters),
    role: [...new Set(group.cardIds.map(roleOf).filter(Boolean))].join('、'),
  }));
}

function choiceHead(card, fixedCards, groups) {
  const ids = new Set([card.id, ...fixedCards.map((fixed) => fixed.id)]);
  const volumes = groups
    .filter((group) => group.cardIds.some((id) => ids.has(id)))
    .map((group) => group.volume)
    .sort((a, b) => volumeNumber(a) - volumeNumber(b));
  return `選 ${card.id}：${volumes.length === 1 ? `只帶${volumes[0]}` : `帶${andList(volumes)}`}`;
}

export function booksPlan(slots) {
  if (!slots.length) return null;
  const cards = slots.flatMap((slot) => slot.cards);
  const groups = volumeGroups(cards);
  const plan = { lead: null, heads: [], intro: null, rows: bookRows(groups, slots), pending: null, note: BORROW };

  if (slots.length === 1 && groups.length === 1) {
    const where =
      cards.length === 1 ? '故事卡在這一卷，當天帶這一本' : `故事卡 ${idList(cards)} 都在這一卷，帶這一本就夠`;
    return { ...plan, heads: [`要帶${groupTitle(groups[0])}`], rows: [], note: `${where}；${BORROW}` };
  }
  if (slots.length === 1) {
    return {
      ...plan,
      heads: ['當天只要帶一本'],
      intro: `故事卡分在這${countWord(groups.length)}卷：`,
      note: `事先挑好一張，就帶那一卷；${BORROW}`,
    };
  }

  const choice = slots.find((slot) => slot.cards.length > 1);
  if (choice) {
    const fixedCards = slots.filter((slot) => slot !== choice).flatMap((slot) => slot.cards);
    return {
      ...plan,
      lead: `一天念${countWord(slots.length)}張：${idList(choice.cards)} 挑一張，${idList(fixedCards)} 一定念。`,
      heads: choice.cards.map((card) => choiceHead(card, fixedCards, groups)),
    };
  }

  const pending = slots.some((slot) => !slot.cards.length);
  const count = groups.length + (pending ? 1 : 0);
  return {
    ...plan,
    heads: [count === 1 ? `要帶${groupTitle(groups[0])}` : `要帶${countWord(count)}本`],
    pending: pending ? PENDING_STOP : null,
  };
}
