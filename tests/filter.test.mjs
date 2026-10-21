import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyFilters, matchesFilters, countMatches } from '../src/lib/filter.mjs';
import { validateActivity } from '../src/lib/schema.mjs';
import { readyActivity, preparingActivity } from './fixtures/activities.mjs';

function tagged(id, order, tags) {
  const activity = readyActivity();
  Object.assign(activity, { id, name: id, order, planFile: `files/${id}-plan.pdf`, tags });
  if (tags.rain !== 'ok') activity.rainNote = '雨天改到會館';
  return activity;
}

function wall() {
  return [
    readyActivity(),
    preparingActivity(),
    tagged('hike', 3, { kids: 'great', place: 'outdoor', rain: 'postpone', slots: ['early-morning'], interests: ['move'] }),
    tagged('picnic', 4, { kids: 'great', place: 'both', rain: 'move', slots: ['weekend-day'], interests: ['eat', 'play'] }),
    tagged('workshop', 5, { kids: 'no', place: 'indoor', rain: 'ok', slots: ['weeknight'], interests: ['craft'] }),
  ];
}

const matchingIds = (filters) =>
  wall()
    .filter((activity) => matchesFilters(activity, filters))
    .map((activity) => activity.id);

test('the wall fixtures are valid activities', () => {
  for (const activity of wall()) assert.deepEqual(validateActivity(activity), []);
});

test('with empty filters every ready activity matches and the untagged preparing one does not', () => {
  assert.deepEqual(matchingIds(emptyFilters()), ['brunch', 'hike', 'picnic', 'workshop']);
});

test('indoor alone keeps indoor and both, drops outdoor', () => {
  assert.deepEqual(matchingIds({ ...emptyFilters(), indoor: true }), ['brunch', 'picnic', 'workshop']);
});

test('outdoor alone keeps outdoor and both', () => {
  assert.deepEqual(matchingIds({ ...emptyFilters(), outdoor: true }), ['hike', 'picnic']);
});

test('indoor and outdoor together do not restrict place', () => {
  assert.deepEqual(matchingIds({ ...emptyFilters(), indoor: true, outdoor: true }), matchingIds(emptyFilters()));
});

test('rainOk keeps ok and move, drops postpone', () => {
  assert.deepEqual(matchingIds({ ...emptyFilters(), rainOk: true }), ['brunch', 'picnic', 'workshop']);
});

test('kids keeps great and ok, drops no', () => {
  assert.deepEqual(matchingIds({ ...emptyFilters(), kids: true }), ['brunch', 'hike', 'picnic']);
});

test('slots and interests need at least one shared tag', () => {
  assert.deepEqual(matchingIds({ ...emptyFilters(), slots: ['weeknight', 'early-morning'] }), ['hike', 'workshop']);
  assert.deepEqual(matchingIds({ ...emptyFilters(), interests: ['eat', 'craft'] }), ['brunch', 'picnic', 'workshop']);
});

test('countMatches leaves out preparing activities even when they are tagged', () => {
  const activities = wall();
  const preparing = activities.find((activity) => activity.status === 'preparing');
  preparing.tags = readyActivity().tags;
  assert.equal(matchesFilters(preparing, emptyFilters()), true);
  assert.equal(countMatches(activities, emptyFilters()), 4);
  assert.equal(countMatches(activities, { ...emptyFilters(), outdoor: true }), 2);
});
