import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recommend } from '../src/lib/recommend.mjs';
import { validateActivity } from '../src/lib/schema.mjs';
import { readyActivity, preparingActivity } from './fixtures/activities.mjs';

function tagged(id, order, tags) {
  const activity = readyActivity();
  Object.assign(activity, { id, name: id, order, planFile: `files/${id}-plan.pdf`, tags });
  if (tags.rain !== 'ok') activity.rainNote = '雨天改到會館';
  return activity;
}

function taggedPreparing() {
  const activity = preparingActivity();
  activity.tags = {
    kids: 'great',
    place: 'both',
    rain: 'ok',
    slots: ['flexible'],
    interests: ['eat', 'move', 'talk', 'play', 'craft'],
  };
  return activity;
}

function wall() {
  return [
    readyActivity(),
    taggedPreparing(),
    tagged('family-picnic', 3, { kids: 'great', place: 'both', rain: 'move', slots: ['weekend-day'], interests: ['eat', 'play'] }),
    tagged('pottery', 4, { kids: 'no', place: 'indoor', rain: 'ok', slots: ['weeknight'], interests: ['craft'] }),
    tagged('river-walk', 5, { kids: 'ok', place: 'outdoor', rain: 'postpone', slots: ['flexible'], interests: ['move', 'talk'] }),
  ];
}

const pickedIds = (result) => result.picks.map((pick) => pick.id);

test('the wall fixtures are valid activities', () => {
  for (const activity of wall()) assert.deepEqual(validateActivity(activity), []);
});

test('a preparing activity never shows up in picks', () => {
  const result = recommend(wall(), { kids: 'yes', slot: 'flexible', place: 'either', interest: 'play' });
  assert.equal(result.picks.length, 3);
  assert.ok(!pickedIds(result).includes('night-run'), JSON.stringify(result));
});

test('picks are ranked by score before order, and three picks need no note', () => {
  const result = recommend(wall(), { kids: 'yes', slot: 'flexible', place: 'either', interest: 'play' });
  assert.deepEqual(pickedIds(result), ['family-picnic', 'river-walk', 'brunch']);
  assert.equal(result.note, null);
});

test('kids yes leaves out activities that are not for kids', () => {
  const unsure = recommend(wall(), { kids: 'unsure', slot: 'flexible', place: 'either', interest: 'craft' });
  const yes = recommend(wall(), { kids: 'yes', slot: 'flexible', place: 'either', interest: 'craft' });
  assert.ok(pickedIds(unsure).includes('pottery'), JSON.stringify(unsure));
  assert.ok(!pickedIds(yes).includes('pottery'), JSON.stringify(yes));
});

test('an activity tagged flexible is kept for a weeknight', () => {
  const result = recommend(wall(), { kids: 'unsure', slot: 'weeknight', place: 'either', interest: 'none' });
  assert.deepEqual(pickedIds(result), ['pottery', 'river-walk']);
});

test('ties go to the smaller order', () => {
  const second = tagged('brunch-two', 6, readyActivity().tags);
  const result = recommend([second, readyActivity()], {
    kids: 'unsure',
    slot: 'weekend-day',
    place: 'indoor',
    interest: 'eat',
  });
  assert.deepEqual(pickedIds(result), ['brunch', 'brunch-two']);
});

test('reasons list kids, slot, place and interest in that order', () => {
  const activity = tagged('family-brunch', 7, {
    kids: 'great',
    place: 'indoor',
    rain: 'ok',
    slots: ['weekend-day'],
    interests: ['eat'],
  });
  const result = recommend([activity], { kids: 'yes', slot: 'weekend-day', place: 'indoor', interest: 'eat' });
  assert.deepEqual(result.picks, [
    { id: 'family-brunch', name: 'family-brunch', reasons: ['適合帶小孩', '週末白天', '室內', '喜歡吃'] },
  ]);
});

test('a place answer leaves out the opposite place and ranks an exact match above both', () => {
  const result = recommend(wall(), { kids: 'unsure', slot: 'flexible', place: 'outdoor', interest: 'none' });
  assert.deepEqual(
    result.picks.map(({ id, reasons }) => ({ id, reasons })),
    [
      { id: 'river-walk', reasons: ['時間彈性', '戶外'] },
      { id: 'family-picnic', reasons: ['室內戶外都可'] },
    ],
  );
});

test('neutral answers leave nothing out and give no reasons', () => {
  const result = recommend(wall(), { kids: 'no', slot: 'flexible', place: 'either', interest: 'none' });
  assert.deepEqual(
    result.picks.map(({ id, reasons }) => ({ id, reasons })),
    [
      { id: 'river-walk', reasons: ['時間彈性'] },
      { id: 'brunch', reasons: [] },
      { id: 'family-picnic', reasons: [] },
    ],
  );
});

test('two matches come with a note to loosen the answers', () => {
  const result = recommend(wall(), { kids: 'unsure', slot: 'weeknight', place: 'either', interest: 'none' });
  assert.equal(result.picks.length, 2);
  assert.equal(result.note, '符合的只有 2 種，可以放寬條件再試一次。');
});

test('when everything is left out there are no picks and a note to try other answers', () => {
  const result = recommend(wall(), { kids: 'yes', slot: 'weeknight', place: 'indoor', interest: 'craft' });
  assert.equal(result.picks.length, 0);
  assert.equal(result.note, '沒有剛好符合的，換個條件試試看。');
});
