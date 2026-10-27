import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  timerText,
  progressText,
  preflightItems,
  saveSession,
  loadSession,
  clearSession,
  imageUrlsFor,
  preload,
  groupsOf,
  groupsNeedFullRow,
  topicChoices,
  KIDS_CHOICE,
  drawCard,
  storyCardBefore,
  readAloudParts,
  followsStory,
  storyTopics,
} from '../src/lib/live.mjs';
import { readyActivity } from './fixtures/activities.mjs';

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

function memoryStorage() {
  const items = new Map();
  return {
    getItem: (key) => (items.has(key) ? items.get(key) : null),
    setItem: (key, value) => items.set(key, String(value)),
    removeItem: (key) => items.delete(key),
  };
}

function brokenStorage() {
  const fail = () => {
    throw new Error('storage is disabled');
  };
  return { getItem: fail, setItem: fail, removeItem: fail };
}

const topicCards = () => readyActivity().cardSets.topic.cards;

test('the timer counts down in minutes and seconds', () => {
  assert.deepEqual(timerText({ minutes: 20 }, 0, 5 * MINUTE + 28 * SECOND), { text: '還剩 14:32', overtime: false });
  assert.equal(timerText({ minutes: 10 }, 0, 0).text, '還剩 10:00');
  assert.equal(timerText({ minutes: 10 }, 0, 10 * MINUTE).text, '還剩 00:00');
});

test('the timer turns into a gentle note once the step runs over', () => {
  assert.deepEqual(timerText({ minutes: 10 }, 0, 11 * MINUTE + SECOND), {
    text: '超過 2 分鐘了，沒關係，聊開了就讓大家聊',
    overtime: true,
  });
  assert.deepEqual(timerText({ minutes: 10 }, 0, 10 * MINUTE + SECOND), {
    text: '超過 1 分鐘了，沒關係，聊開了就讓大家聊',
    overtime: true,
  });
});

test('a step without minutes is not timed', () => {
  assert.deepEqual(timerText({ minutes: null }, 0, 999), { text: '照大家的步調', overtime: false });
});

test('progress counts steps from one', () => {
  assert.equal(progressText(1, 5), '第 2 步，共 5 步');
});

test('preflight items are a copy of the activity preflight list', () => {
  const activity = readyActivity();
  const items = preflightItems(activity);
  assert.deepEqual(items, ['確認咖啡廳訂位', '手機有電，先連上網路']);
  items.push('多的');
  assert.equal(activity.preflight.length, 2);
});

test('a saved session comes back after a reload', () => {
  const storage = memoryStorage();
  saveSession(storage, 'brunch', { index: 2, startedAtMs: 1000, district: '台北西區' }, 5000);
  assert.deepEqual(loadSession(storage, 'brunch', 5000 + 24 * HOUR), { index: 2, startedAtMs: 1000, district: '台北西區' });
  assert.deepEqual(JSON.parse(storage.getItem('brotime:live:brunch')), {
    index: 2,
    startedAtMs: 1000,
    district: '台北西區',
    savedAtMs: 5000,
  });
});

test('a session saved without a district comes back with district null', () => {
  const storage = memoryStorage();
  saveSession(storage, 'brunch', { index: 0, startedAtMs: 1000, district: null }, 1000);
  assert.deepEqual(loadSession(storage, 'brunch', 2000), { index: 0, startedAtMs: 1000, district: null });
});

test('a session older than a day is dropped', () => {
  const storage = memoryStorage();
  saveSession(storage, 'brunch', { index: 2, startedAtMs: 1000, district: null }, 5000);
  assert.equal(loadSession(storage, 'brunch', 5000 + 24 * HOUR + SECOND), null);
});

test('sessions are kept per activity', () => {
  const storage = memoryStorage();
  saveSession(storage, 'brunch', { index: 2, startedAtMs: 1000, district: null }, 1000);
  assert.equal(loadSession(storage, 'night-run', 1000), null);
});

test('a missing or malformed session loads as null', () => {
  const storage = memoryStorage();
  assert.equal(loadSession(storage, 'brunch', 1000), null);
  const malformed = [
    '{not json',
    'null',
    '42',
    JSON.stringify({ index: 1, startedAtMs: 1000, district: null }),
    JSON.stringify({ index: 1.5, startedAtMs: 1000, district: null, savedAtMs: 1000 }),
    JSON.stringify({ index: -1, startedAtMs: 1000, district: null, savedAtMs: 1000 }),
    JSON.stringify({ index: '1', startedAtMs: 1000, district: null, savedAtMs: 1000 }),
    JSON.stringify({ index: 1, startedAtMs: '1000', district: null, savedAtMs: 1000 }),
    JSON.stringify({ index: 1, district: null, savedAtMs: 1000 }),
    JSON.stringify({ index: 1, startedAtMs: 1000, district: 3, savedAtMs: 1000 }),
    JSON.stringify({ index: 1, startedAtMs: 1000, savedAtMs: 1000 }),
    JSON.stringify({ index: 1, startedAtMs: 1000, district: null, savedAtMs: '1000' }),
  ];
  for (const value of malformed) {
    storage.setItem('brotime:live:brunch', value);
    assert.equal(loadSession(storage, 'brunch', 1000), null, value);
  }
});

test('storage that throws never breaks live mode', () => {
  const storage = brokenStorage();
  assert.doesNotThrow(() => saveSession(storage, 'brunch', { index: 1, startedAtMs: 0, district: null }, 0));
  assert.equal(loadSession(storage, 'brunch', 0), null);
  assert.doesNotThrow(() => clearSession(storage, 'brunch'));
});

test('a cleared session no longer loads', () => {
  const storage = memoryStorage();
  saveSession(storage, 'brunch', { index: 2, startedAtMs: 1000, district: null }, 1000);
  clearSession(storage, 'brunch');
  assert.equal(loadSession(storage, 'brunch', 1000), null);
});

test('image urls cover every card of the sets the steps use, once each, in order', () => {
  const activity = readyActivity();
  assert.deepEqual(imageUrlsFor(activity, [...activity.steps, activity.steps[1]]), [
    'cards/brunch/t02.webp',
    'cards/brunch/t05.webp',
    'cards/brunch/t11.webp',
    'cards/brunch/s1.webp',
  ]);
});

test('image urls only include the chosen cards when a step names them', () => {
  const activity = readyActivity();
  const step = { ...activity.steps[1], cardIds: ['t02'] };
  assert.deepEqual(imageUrlsFor(activity, [step]), ['cards/brunch/t02.webp']);
});

test('steps without cards need no images', () => {
  const activity = readyActivity();
  assert.deepEqual(imageUrlsFor(activity, [activity.steps[0]]), []);
});

function activityWithThreeStoryCards() {
  const activity = readyActivity();
  const [first] = activity.cardSets.story.cards;
  activity.cardSets.story.cards.push({ ...first, id: 's2', title: '第二張' }, { ...first, id: 's3', title: '第三張' });
  return activity;
}

test('the sharing step shows the first card of the story step before it when nothing was picked', () => {
  const activity = activityWithThreeStoryCards();
  assert.equal(storyCardBefore(activity, activity.steps, 3, new Map()).id, 's1');
  assert.equal(storyCardBefore(activity, activity.steps, 4, new Map()).id, 's1');
});

test('the sharing step shows the story card picked on the story step', () => {
  const activity = activityWithThreeStoryCards();
  const picks = new Map([['2:story', 's3']]);
  assert.equal(storyCardBefore(activity, activity.steps, 3, picks).id, 's3');
});

test('the sharing step falls back to the first card shown when the pick is unknown', () => {
  const activity = activityWithThreeStoryCards();
  activity.steps[2].cardIds = ['s2', 's3'];
  assert.equal(storyCardBefore(activity, activity.steps, 3, new Map()).id, 's2');
  assert.equal(storyCardBefore(activity, activity.steps, 3, new Map([['2:story', 's1']])).id, 's2');
  assert.equal(storyCardBefore(activity, activity.steps, 3, new Map([['2:story', 'gone']])).id, 's2');
});

test('the sharing step uses the nearest story step before it', () => {
  const activity = activityWithThreeStoryCards();
  const steps = [...activity.steps.slice(0, 4), { ...activity.steps[2], cardIds: ['s3'] }, activity.steps[3]];
  assert.equal(storyCardBefore(activity, steps, 5, new Map([['2:story', 's2']])).id, 's3');
  assert.equal(storyCardBefore(activity, steps, 3, new Map([['2:story', 's2']])).id, 's2');
});

test('there is no story card to share before the story step', () => {
  const activity = readyActivity();
  assert.equal(storyCardBefore(activity, activity.steps, 2, new Map()), null);
  assert.equal(storyCardBefore(activity, activity.steps, 0, new Map()), null);
});

test('plain read-aloud text keeps the default heading and stays one paragraph', () => {
  assert.deepEqual(readAloudParts('第一段。\n\n第二段。'), {
    label: '念這段：',
    paragraphs: ['第一段。\n\n第二段。'],
    source: null,
  });
});

test('read-aloud text with a label splits into paragraphs and keeps verse line breaks', () => {
  const readAloud = { label: '收尾的話', text: '第一段。\n\n詩的第一行\n詩的第二行', source: '《新・人間革命》第11卷〈躍進〉' };
  assert.deepEqual(readAloudParts(readAloud), {
    label: '收尾的話',
    paragraphs: ['第一段。', '詩的第一行\n詩的第二行'],
    source: '《新・人間革命》第11卷〈躍進〉',
  });
});

test('read-aloud text without a label or source falls back to the default heading and no source', () => {
  assert.deepEqual(readAloudParts({ text: '要念的文字。' }), { label: '念這段：', paragraphs: ['要念的文字。'], source: null });
});

test('preload reports urls that never load and still resolves', async () => {
  const result = await preload(['a', 'b'], (url) => (url === 'a' ? Promise.resolve() : new Promise(() => {})), 50);
  assert.deepEqual(result, { failed: ['b'] });
});

test('preload reports urls that fail to load', async () => {
  const result = await preload(
    ['a', 'b', 'c'],
    (url) => {
      if (url === 'b') return Promise.reject(new Error('offline'));
      if (url === 'c') throw new Error('offline');
      return Promise.resolve();
    },
    50,
  );
  assert.deepEqual(result, { failed: ['b', 'c'] });
});

test('preload leaves no timers behind once every url settles', async () => {
  const pendingTimers = () => process.getActiveResourcesInfo().filter((name) => name === 'Timeout').length;
  const before = pendingTimers();
  const result = await preload(['a', 'b'], () => Promise.resolve());
  assert.deepEqual(result, { failed: [] });
  assert.equal(pendingTimers(), before);
});

test('groups are listed once each in the order they appear', () => {
  assert.deepEqual(groupsOf(topicCards()), ['前菜', '主餐', '飯後咖啡']);
  assert.deepEqual(groupsOf([...topicCards(), { id: 't12', title: '再一題', group: '前菜' }]), ['前菜', '主餐', '飯後咖啡']);
  assert.deepEqual(groupsOf([{ id: 'x', title: '沒有分類' }]), []);
});

test('group buttons take a full row each once a group name is longer than six characters', () => {
  assert.equal(groupsNeedFullRow(['淺灘・暖身', '中層・近況', '深水・心裡話']), false);
  assert.equal(groupsNeedFullRow(['淡茶・生活的話', '濃茶・深一點的話']), true);
  assert.equal(groupsNeedFullRow([]), false);
});

test('drawing picks from the cards not drawn yet', () => {
  const drawnIds = [];
  const first = drawCard(topicCards(), drawnIds, null, () => 0);
  assert.equal(first.card.id, 't02');
  assert.deepEqual(first.drawnIds, ['t02']);
  assert.deepEqual(drawnIds, []);
  assert.equal(drawCard(topicCards(), ['t02', 't05'], null, () => 0).card.id, 't11');
  assert.equal(drawCard(topicCards(), [], null, () => 0.99).card.id, 't11');
});

test('drawing within a group only picks that group', () => {
  const result = drawCard(topicCards(), [], '主餐', () => 0);
  assert.equal(result.card.id, 't05');
  assert.deepEqual(result.drawnIds, ['t05']);
});

test('drawing starts the group over once every card in it has been drawn', () => {
  const result = drawCard(topicCards(), ['t02'], '前菜', () => 0);
  assert.equal(result.card.id, 't02');
  assert.deepEqual(result.drawnIds, ['t02']);
  assert.deepEqual(drawCard(topicCards(), ['t05', 't02'], '前菜', () => 0).drawnIds, ['t05', 't02']);
});

test('drawing without a group starts the whole deck over once it runs out', () => {
  const drawnIds = ['t02', 't05', 't11'];
  const result = drawCard(topicCards(), drawnIds, null, () => 0.5);
  assert.equal(result.card.id, 't05');
  assert.deepEqual(result.drawnIds, ['t05']);
  assert.deepEqual(drawnIds, ['t02', 't05', 't11']);
});

const RANDOM_VALUES = [0, 0.5, 0.999];

test('starting the whole deck over never repeats the card just drawn', () => {
  for (const drawnIds of [
    ['t02', 't05', 't11'],
    ['t11', 't02', 't05'],
  ]) {
    for (const value of RANDOM_VALUES) {
      const { card } = drawCard(topicCards(), drawnIds, null, () => value);
      assert.notEqual(card.id, drawnIds.at(-1), `random ${value} after ${drawnIds}`);
    }
  }
});

test('starting a group over skips the card of that group drawn last', () => {
  const cards = [
    { id: 'a', title: 'A', group: '前菜' },
    { id: 'b', title: 'B', group: '前菜' },
    { id: 'c', title: 'C', group: '主餐' },
  ];
  for (const value of RANDOM_VALUES) {
    const result = drawCard(cards, ['a', 'b', 'c'], '前菜', () => value);
    assert.equal(result.card.id, 'a');
    assert.deepEqual(result.drawnIds, ['c', 'a']);
  }
});

test('a group with one card keeps drawing that card', () => {
  for (const value of RANDOM_VALUES) {
    const result = drawCard(topicCards(), ['t02', 't05'], '前菜', () => value);
    assert.equal(result.card.id, 't02');
    assert.deepEqual(result.drawnIds, ['t05', 't02']);
  }
});

const kidsCards = () => [
  { id: 'k1', title: 'K1', group: '從作品聊起', forKids: true },
  { id: 'k2', title: 'K2', group: '從作品聊起' },
  { id: 'k3', title: 'K3', group: '聊到生活', forKids: true },
];

test('cards marked for kids add a 小朋友也能答 choice after the groups', () => {
  assert.equal(KIDS_CHOICE, '小朋友也能答');
  assert.deepEqual(topicChoices(kidsCards()), [null, '從作品聊起', '聊到生活', KIDS_CHOICE]);
  assert.deepEqual(topicChoices(topicCards()), [null, '前菜', '主餐', '飯後咖啡']);
});

test('drawing 小朋友也能答 only picks cards marked for kids, across groups', () => {
  for (const value of RANDOM_VALUES) {
    const { card } = drawCard(kidsCards(), [], KIDS_CHOICE, () => value);
    assert.ok(card.forKids, `random ${value} drew ${card.id}`);
  }
  assert.equal(drawCard(kidsCards(), ['k1'], KIDS_CHOICE, () => 0).card.id, 'k3');
});

test('drawing 小朋友也能答 starts over once every kids card has been drawn, keeping other draws', () => {
  const result = drawCard(kidsCards(), ['k2', 'k1', 'k3'], KIDS_CHOICE, () => 0);
  assert.equal(result.card.id, 'k1');
  assert.deepEqual(result.drawnIds, ['k2', 'k1']);
});

test('preflight items can end with route-specific reminders', () => {
  const activity = readyActivity();
  assert.deepEqual(preflightItems(activity, ['這條路線比較長']), ['確認咖啡廳訂位', '手機有電，先連上網路', '這條路線比較長']);
  assert.deepEqual(preflightItems(activity), ['確認咖啡廳訂位', '手機有電，先連上網路']);
});

const deepSet = {
  kind: 'topic',
  label: '深題',
  cards: [
    { id: 'A-1', title: 'A 第一題', storyCard: 'A', beforeStory: true },
    { id: 'A-2', title: 'A 第二題', storyCard: 'A' },
    { id: 'A-3', title: 'A 第三題', storyCard: 'A' },
    { id: 'B-1', title: 'B 第一題', storyCard: 'B', beforeStory: true },
    { id: 'B-2', title: 'B 第二題', storyCard: 'B' },
  ],
};

test('a topic set follows the story card when every card names one', () => {
  assert.equal(followsStory(deepSet), true);
  assert.equal(followsStory(readyActivity().cardSets.topic), false);
  assert.equal(followsStory(readyActivity().cardSets.story), false);
  assert.equal(followsStory({ ...deepSet, cards: [...deepSet.cards, { id: 't1', title: '沒有故事卡' }] }), false);
});

test('storyTopics splits the picked story card topics into before and after, in order', () => {
  assert.deepEqual(storyTopics([deepSet], 'A'), {
    label: '深題',
    before: [deepSet.cards[0]],
    after: [deepSet.cards[1], deepSet.cards[2]],
  });
  assert.deepEqual(
    storyTopics([deepSet], 'B').after.map((card) => card.id),
    ['B-2'],
  );
});

test('storyTopics is empty for a story card without topics or when no set follows the story', () => {
  assert.deepEqual(storyTopics([deepSet], 'C'), { label: '深題', before: [], after: [] });
  assert.equal(storyTopics([], 'A'), null);
});
