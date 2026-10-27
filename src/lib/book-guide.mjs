export const GUIDE_HEADING = '翻書念故事';
export const SERIES = '《新・人間革命》';

const COUNT_WORDS = { 2: '兩', 3: '三', 4: '四' };

export const bookTitle = (guide) => `${guide.volume}〈${guide.chapter}〉`;

export const bringVolume = (guide) => `要帶${guide.volume}`;

export const guideRows = (guide) => [...guide.steps, { label: '多久', text: guide.duration, note: '' }];

function booksOf(cards) {
  const byVolume = new Map();
  for (const card of cards) {
    if (!byVolume.has(card.guide.volume)) byVolume.set(card.guide.volume, card.guide);
  }
  return { count: COUNT_WORDS[byVolume.size] ?? String(byVolume.size), titles: [...byVolume.values()].map(bookTitle) };
}

export function booksToBring(cards) {
  const { count, titles } = booksOf(cards);
  return titles.length === 1 ? `要帶${SERIES}${titles[0]}` : `要帶${count}本${SERIES}：${titles.join('、')}`;
}

export function booksPacked(cards) {
  const { count, titles } = booksOf(cards);
  return titles.length === 1 ? `${SERIES}${titles[0]}帶了` : `${count}本${SERIES}帶了：${titles.join('、')}`;
}
