import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activityHref, ANSWER_ROWS, choiceCounts, shortDate, wantsCaption, wantsHeading } from '../src/lib/stats-view.mjs';

test('dates read as month/day with the weekday', () => {
  assert.equal(shortDate('2027-01-15'), '1/15（五）');
  assert.equal(shortDate('2026-11-03'), '11/3（二）');
});

test('wants are captioned with how many sessions and replies they come from', () => {
  assert.equal(wantsCaption({ sessions: 3, responses: 12 }), '根據最近 3 場、共 12 份問卷');
  assert.equal(wantsHeading('district'), '你們區的人想約');
  assert.equal(wantsHeading('circle'), '你們圈的人想約');
});

test('choices keep the survey order and show zero for choices nobody picked', () => {
  assert.deepEqual(choiceCounts({ 有: 2 }, ['有', '普通', '沒有']), [
    { choice: '有', count: 2 }, { choice: '普通', count: 0 }, { choice: '沒有', count: 0 },
  ]);
});

test('an activity links to its page, an old name that no page has gets no link', () => {
  assert.equal(activityHref('城市散步', { 城市散步: 'city-walk' }, '../'), '../a/city-walk/');
  assert.equal(activityHref('巷口泡茶會', { 城市散步: 'city-walk' }, '../'), null);
});

test('the four answer rows follow the survey questions and leave the keepsake sentence out', () => {
  assert.deepEqual(ANSWER_ROWS.map((row) => row.key), ['listened', 'closer', 'different', 'again']);
  assert.ok(!JSON.stringify(ANSWER_ROWS).includes('留在心裡'));
});
