import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';

const SPEC_DIR = new URL('../tools/cards/', import.meta.url);

const readJson = (url) => JSON.parse(readFileSync(url, 'utf8'));

function readSpecs() {
  if (!existsSync(SPEC_DIR)) return [];
  return readdirSync(SPEC_DIR)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => ({ name, spec: readJson(new URL(name, SPEC_DIR)) }));
}

const specCards = ({ name, spec }) =>
  Object.entries(spec.sets).flatMap(([setKey, set]) =>
    set.cards.map((card) => ({ card, where: `${name} sets.${setKey} ${card.id}` })),
  );

const activityCardIds = (activityId) => {
  const activity = readJson(new URL(`../content/activities/${activityId}.json`, import.meta.url));
  return new Set(Object.values(activity.cardSets ?? {}).flatMap((set) => set.cards.map((card) => card.id)));
};

test('there is at least one card spec in tools/cards', () => {
  assert.ok(readSpecs().length > 0, 'tools/cards/ 裡至少要有一份 <activity>.json');
});

test('every card box is four page proportions with x0 < x1 and y0 < y1', () => {
  for (const { card, where } of readSpecs().flatMap(specCards)) {
    assert.equal(card.box.length, 4, `${where}: box 要有四個值`);
    assert.ok(
      card.box.every((value) => typeof value === 'number' && value >= 0 && value <= 1),
      `${where}: box 的值要在 0 到 1 之間`,
    );
    const [x0, y0, x1, y1] = card.box;
    assert.ok(x0 < x1 && y0 < y1, `${where}: box 要是 x0 < x1、y0 < y1`);
  }
});

test('every card in a spec is in the card sets of its activity', () => {
  for (const entry of readSpecs()) {
    const ids = activityCardIds(entry.spec.activity);
    for (const { card, where } of specCards(entry)) {
      assert.ok(ids.has(card.id), `${where}: 不在 content/activities/${entry.spec.activity}.json 的 cardSets 裡`);
    }
  }
});
