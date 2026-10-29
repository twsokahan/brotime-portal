import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  booksPacked,
  booksPlan,
  booksToBring,
  bringVolume,
  guideRows,
  readingSlots,
  volumeGroups,
} from '../src/lib/book-guide.mjs';

const card = (volume, chapter, id = 'A') => ({ id, guide: { volume, chapter } });
const storySet = (...cards) => ({ kind: 'story', cards });
const slot = (...cards) => ({ cards });

test('a card says which volume to bring', () => {
  assert.equal(bringVolume({ volume: '第30卷(下)', chapter: '勝利歡呼' }), '要帶第30卷(下)');
});

test('the reading steps end with how long the reading takes', () => {
  const guide = { steps: [{ label: '從', text: '「開頭」', note: '' }], duration: '約 1 分鐘，中間不跳' };
  assert.deepEqual(guideRows(guide), [
    { label: '從', text: '「開頭」', note: '' },
    { label: '多久', text: '約 1 分鐘，中間不跳', note: '' },
  ]);
});

test('two cards from different volumes need two books', () => {
  const cards = [card('第5卷', '歡喜'), card('第16卷', '心血')];
  assert.equal(booksToBring(cards), '要帶兩本《新・人間革命》：第5卷〈歡喜〉、第16卷〈心血〉');
  assert.equal(booksPacked(cards), '兩本《新・人間革命》帶了：第5卷〈歡喜〉、第16卷〈心血〉');
});

test('cards from the same volume need one book', () => {
  const cards = [card('第7卷', '早春'), card('第7卷', '早春')];
  assert.equal(booksToBring(cards), '要帶《新・人間革命》第7卷〈早春〉');
  assert.equal(booksPacked(cards), '《新・人間革命》第7卷〈早春〉帶了');
});

test('cards of one volume merge in card order and keep every chapter once', () => {
  const cards = [card('第26卷', '厚田', 'A'), card('第2卷', '磨練', 'B'), card('第2卷', '勇舞', 'C'), card('第2卷', '磨練', 'D')];
  assert.deepEqual(volumeGroups(cards), [
    { volume: '第26卷', chapters: ['厚田'], cardIds: ['A'] },
    { volume: '第2卷', chapters: ['磨練', '勇舞'], cardIds: ['B', 'C', 'D'] },
  ]);
  assert.equal(booksToBring(cards), '要帶兩本《新・人間革命》：第26卷〈厚田〉、第2卷〈磨練〉〈勇舞〉');
});

test('each step with story cards is one reading, limited to the cards it names', () => {
  const cardSets = {
    story: storySet(card('第18卷', '前進', 'A'), card('第7卷', '萌芽', 'B'), card('第18卷', '飛躍', 'C')),
    topic: { kind: 'topic', cards: [{ id: 't01' }] },
  };
  const steps = [{ cards: ['story'], cardIds: ['A', 'B'] }, { cards: ['topic'] }, { cards: ['story'], cardIds: ['C'] }];
  assert.deepEqual(
    readingSlots(steps, cardSets).map((s) => s.cards.map((c) => c.id)),
    [['A', 'B'], ['C']],
  );
});

test('a city-walk stop without its card yet is a reading still to be decided', () => {
  const cardSets = { story: storySet(card('第16卷', '心血', 'B')) };
  const steps = [{ routeStop: 'stop1' }, { routeStop: 'end', cards: ['story'], cardIds: ['B'] }];
  assert.deepEqual(readingSlots(steps, cardSets), [
    { stop: 'stop1', cards: [] },
    { stop: 'end', cards: [cardSets.story.cards[0]] },
  ]);
});

test('without story cards there is no book to prepare', () => {
  assert.equal(booksPlan(readingSlots([{ cards: ['box'] }], { box: { kind: 'box', cards: [{ id: 'x' }] } })), null);
});

test('a single story card names its book outright', () => {
  assert.deepEqual(booksPlan([slot(card('第16卷', '舉翼', 's1'))]), {
    lead: null,
    heads: ['要帶第16卷〈舉翼〉'],
    intro: null,
    rows: [],
    pending: null,
    note: '當天帶這一本就好。',
  });
});

test('cards that all sit in one volume need just that book', () => {
  const plan = booksPlan([slot(card('第7卷', '早春', 'A'), card('第7卷', '早春', 'B'))]);
  assert.deepEqual(plan.heads, ['要帶第7卷〈早春〉']);
  assert.deepEqual(plan.rows, []);
  assert.equal(plan.note, '故事卡 A、B 都出自這一卷，帶這一本就夠。');
});

test('picking one of several cards lists every volume with its cards merged', () => {
  const plan = booksPlan([slot(card('第18卷', '師恩', 'A'), card('第18卷', '師恩', 'B'), card('第19卷', '長虹之舞', 'C'))]);
  assert.deepEqual(plan.heads, ['當天只要帶一本']);
  assert.equal(plan.intro, '故事卡分在這兩卷：');
  assert.deepEqual(plan.rows, [
    { cards: 'A、B', link: '在', volume: '第18卷', chapters: '〈師恩〉', role: '' },
    { cards: 'C', link: '在', volume: '第19卷', chapters: '〈長虹之舞〉', role: '' },
  ]);
  assert.equal(plan.note, '事先挑好一張，就帶那一卷。');
});

test('before a district is chosen, city walk names the end book and leaves the other open', () => {
  const plan = booksPlan([{ stop: 'stop1', cards: [] }, { stop: 'end', cards: [card('第16卷', '心血', 'B')] }]);
  assert.deepEqual(plan.heads, ['要帶兩本']);
  assert.deepEqual(plan.rows, [{ cards: 'B', link: '在', volume: '第16卷', chapters: '〈心血〉', role: '終點念' }]);
  assert.equal(plan.pending, '另一本是停留點一那區的故事卡所在的那一卷，依你選的區而定，選好區就會顯示在這裡。');
});

test('after a district is chosen, city walk names both books', () => {
  const plan = booksPlan([
    { stop: 'stop1', cards: [card('第26卷', '厚田', 'K')] },
    { stop: 'end', cards: [card('第16卷', '心血', 'B')] },
  ]);
  assert.deepEqual(plan.heads, ['要帶兩本']);
  assert.deepEqual(plan.rows, [
    { cards: 'K', link: '在', volume: '第26卷', chapters: '〈厚田〉', role: '停留點一念' },
    { cards: 'B', link: '在', volume: '第16卷', chapters: '〈心血〉', role: '終點念' },
  ]);
  assert.equal(plan.pending, null);
});

test('when one reading is picked and another is fixed, each pick says which books it needs', () => {
  const plan = booksPlan([
    slot(card('第18卷', '前進', 'A'), card('第7卷', '萌芽', 'B')),
    slot(card('第18卷', '飛躍', 'C')),
  ]);
  assert.equal(plan.lead, '一天念兩張：A、B 挑一張，C 一定念。');
  assert.deepEqual(plan.heads, ['選 A：只帶第18卷', '選 B：帶第7卷和第18卷']);
  assert.deepEqual(plan.rows, [
    { cards: 'A、C', link: '在', volume: '第18卷', chapters: '〈前進〉〈飛躍〉', role: '' },
    { cards: 'B', link: '在', volume: '第7卷', chapters: '〈萌芽〉', role: '' },
  ]);
  assert.equal(plan.note, null);
});

const revealCard = (no, title, volume, chapter) => ({
  id: `s${no}`,
  title: `第 ${no} 題：${title}`,
  reveal: { lead: '測試用的引言——', guide: { volume, chapter } },
});

test('cards revealed from the book are one reading that needs every volume', () => {
  const cardSets = {
    scene: { kind: 'other', cards: [revealCard(1, '晚上', '第4卷', '綠葉'), revealCard(2, '兄弟', '第30卷（上）', '大山')] },
    rules: { kind: 'other', cards: [{ id: 'rules', title: '玩法' }] },
  };
  assert.deepEqual(readingSlots([{ cards: ['scene', 'rules'] }], cardSets), [
    {
      stop: 'reveal',
      all: true,
      cards: [
        { id: '第 1 題', guide: { volume: '第4卷', chapter: '綠葉' } },
        { id: '第 2 題', guide: { volume: '第30卷（上）', chapter: '大山' } },
      ],
    },
  ]);
});

test('when every revealed answer has to be read, the host brings all the volumes', () => {
  const cards = [
    { id: '第 1 題', guide: { volume: '第4卷', chapter: '綠葉' } },
    { id: '第 2 題', guide: { volume: '第30卷（上）', chapter: '大山' } },
    { id: '第 3 題', guide: { volume: '第20卷', chapter: '友誼之路' } },
    { id: '第 4 題', guide: { volume: '第7卷', chapter: '早春' } },
    { id: '第 5 題', guide: { volume: '第12卷', chapter: '新綠' } },
  ];
  const plan = booksPlan([{ stop: 'reveal', all: true, cards }]);
  assert.deepEqual(plan.heads, ['要帶五本']);
  assert.deepEqual(plan.rows.slice(0, 2), [
    { cards: '第 1 題', link: '', volume: '第4卷', chapters: '〈綠葉〉', role: '' },
    { cards: '第 2 題', link: '', volume: '第30卷（上）', chapters: '〈大山〉', role: '' },
  ]);
  assert.equal(plan.rows.length, 5);
  assert.equal(plan.note, '桌長帶這 5 卷書，投完票翻到那一段念給大家聽。');
});
