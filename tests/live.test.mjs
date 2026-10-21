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
  drawCard,
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
  assert.deepEqual(loadSession(storage, 'brunch', 5000 + 6 * HOUR), { index: 2, startedAtMs: 1000, district: '台北西區' });
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

test('a session older than six hours is dropped', () => {
  const storage = memoryStorage();
  saveSession(storage, 'brunch', { index: 2, startedAtMs: 1000, district: null }, 5000);
  assert.equal(loadSession(storage, 'brunch', 5000 + 6 * HOUR + SECOND), null);
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
