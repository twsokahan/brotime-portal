import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  activityCover,
  activityHref,
  ANSWER_ROWS,
  CARD_ROWS,
  choiceCounts,
  dayParts,
  districtsWithSessions,
  EMPTY_TEXT,
  personDots,
  reviewTitle,
  SAMPLE_SESSION,
  summaryLine,
  wantsCaption,
  wantsHeading,
} from '../src/lib/stats-view.mjs';

const INDEX = { 城市散步: { id: 'city-walk', cover: 'cards/city-walk/A-thumb.webp' }, 桌遊之夜: { id: 'board-games', cover: null } };

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
  assert.equal(activityHref('城市散步', INDEX, '../'), '../a/city-walk/');
  assert.equal(activityHref('巷口泡茶會', INDEX, '../'), null);
});

test('an activity shows its cover, an old name or an activity without one shows none', () => {
  assert.equal(activityCover('城市散步', INDEX, '../'), '../cards/city-walk/A-thumb.webp');
  assert.equal(activityCover('巷口泡茶會', INDEX, '../'), null);
  assert.equal(activityCover('桌遊之夜', INDEX, '../'), null);
});

test('the review is titled by the scope it covers', () => {
  assert.equal(reviewTitle({ level: 'district', label: '中和區' }), '中和區的回顧');
  assert.equal(reviewTitle({ level: 'district', label: '中和區、永和區' }), '中和區、永和區的回顧');
  assert.equal(reviewTitle({ level: 'circle', label: '新北一圈' }), '新北一圈的回顧');
  assert.equal(reviewTitle({ level: 'all', label: '全部' }), '全台的回顧');
});

test('a date splits into month/day and the weekday', () => {
  assert.deepEqual(dayParts('2026-11-14'), { day: '11/14', weekday: '週六' });
  assert.deepEqual(dayParts('2027-01-15'), { day: '1/15', weekday: '週五' });
});

test('each person who answered gets one dot, in the order of the choices', () => {
  const choices = ['有', '普通', '沒有'];
  assert.deepEqual(personDots({ 有: 1, 沒有: 2, 普通: 1 }, choices), [0, 1, 2, 2]);
  assert.deepEqual(personDots({ 有: 2 }, choices), [0, 0]);
  assert.deepEqual(personDots(undefined, choices), []);
});

test('the summary counts sessions and replies', () => {
  assert.equal(summaryLine([{ responses: 5 }, { responses: 7 }]), '共 2 場、12 份參加者問卷');
});

test('the district picker lists only districts that have sessions, in scope order', () => {
  const sessions = [{ district: '永和區' }, { district: '中和區' }, { district: '永和區' }];
  assert.deepEqual(districtsWithSessions(sessions, ['中和區', '板橋區', '永和區']), ['中和區', '永和區']);
});

test('a review card shows three of the questions with their survey choices', () => {
  assert.deepEqual(CARD_ROWS.map(({ key, label }) => [key, label]), [
    ['listened', '有人認真聽他說話'], ['closer', '跟人變熟了'], ['again', '下次還想來'],
  ]);
  assert.deepEqual(CARD_ROWS[2].choices, ['會', '看時間', '不會']);
});

test('the sample card is a kitchen session of five replies and the empty text says where replies come from', () => {
  assert.equal(SAMPLE_SESSION.activity, '男人的廚房');
  assert.equal(SAMPLE_SESSION.responses, 5);
  for (const { key, choices } of ANSWER_ROWS) assert.equal(personDots(SAMPLE_SESSION.answers[key], choices).length, 5, key);
  assert.equal(EMPTY_TEXT, '還沒有問卷回覆。主持人用當天模式帶完一場，最後一步請大家掃問卷 QR，填完的那一場就會出現在這裡。');
});

test('the four answer rows follow the survey questions and leave the keepsake sentence out', () => {
  assert.deepEqual(ANSWER_ROWS.map((row) => row.key), ['listened', 'closer', 'different', 'again']);
  assert.ok(!JSON.stringify(ANSWER_ROWS).includes('留在心裡'));
});
