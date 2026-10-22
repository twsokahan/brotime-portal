import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateActivity, validateSite, validateAll } from '../src/lib/schema.mjs';
import { readyActivity, preparingActivity, fixtureSite } from './fixtures/activities.mjs';

const allFilesExist = { fileExists: () => true };

function assertReports(errors, fragment) {
  assert.ok(
    errors.some((error) => error.includes(fragment)),
    `expected an error mentioning ${fragment}, got ${JSON.stringify(errors)}`,
  );
}

function cityWalkActivity() {
  const activity = readyActivity();
  activity.id = 'city-walk';
  activity.planFile = 'files/city-walk-plan.pdf';
  activity.cardSets.story.cards[0].id = 'P';
  return activity;
}

test('the ready and preparing fixtures are valid', () => {
  assert.deepEqual(validateActivity(readyActivity(), allFilesExist), []);
  assert.deepEqual(validateActivity(preparingActivity(), allFilesExist), []);
});

test('fixture factories return a fresh object on every call', () => {
  const first = readyActivity();
  first.steps[0].title = 'changed';
  first.cardSets.topic.cards.pop();
  assert.notEqual(readyActivity().steps[0].title, 'changed');
  assert.equal(readyActivity().cardSets.topic.cards.length, 3);
});

test('say longer than 45 characters is reported as "<id>: <path> <problem>"', () => {
  const activity = readyActivity();
  activity.steps[1].say = '一'.repeat(46);
  const errors = validateActivity(activity, allFilesExist);
  assert.ok(
    errors.some((error) => error.startsWith('brunch: steps[1].say 超過 45 字')),
    JSON.stringify(errors),
  );
});

test('say length counts code points, not UTF-16 units', () => {
  const activity = readyActivity();
  activity.steps[1].say = '𠮷'.repeat(45);
  assert.deepEqual(validateActivity(activity, allFilesExist), []);
});

test('a todo task longer than 20 characters is reported', () => {
  const activity = readyActivity();
  activity.todo[1].task = '一'.repeat(21);
  const errors = validateActivity(activity, allFilesExist);
  assert.ok(
    errors.some((error) => error.startsWith('brunch: todo[1].task 超過 20 字（21 字）')),
    JSON.stringify(errors),
  );
});

test('a todo task of 20 code points passes', () => {
  const activity = readyActivity();
  activity.todo[1].task = '𠮷'.repeat(20);
  assert.deepEqual(validateActivity(activity, allFilesExist), []);
});

test('a todo detail is optional but must be text when given', () => {
  const activity = readyActivity();
  activity.todo[0].detail = '坐得下 6–10 人、能待 90 分鐘';
  assert.deepEqual(validateActivity(activity, allFilesExist), []);
  activity.todo[0].detail = '';
  assertReports(validateActivity(activity, allFilesExist), 'todo[0].detail');
  activity.todo[0].detail = ['不是文字'];
  assertReports(validateActivity(activity, allFilesExist), 'todo[0].detail');
});

test('a step using an unknown card set is reported', () => {
  const activity = readyActivity();
  activity.steps[1].cards = ['nope'];
  assertReports(validateActivity(activity, allFilesExist), 'steps[1].cards');
});

test('cardIds must belong to the card sets of that step', () => {
  const activity = readyActivity();
  const topicStep = activity.steps.find((step) => step.cards?.includes('topic'));
  topicStep.cardIds = ['s1'];
  assertReports(validateActivity(activity, allFilesExist), '.cardIds[0]');
});

test('rain other than ok needs a rainNote', () => {
  const activity = readyActivity();
  activity.tags.rain = 'postpone';
  delete activity.rainNote;
  assertReports(validateActivity(activity, allFilesExist), 'rainNote');
});

test('tags.slots needs at least one slot', () => {
  const activity = readyActivity();
  activity.tags.slots = [];
  assertReports(validateActivity(activity, allFilesExist), 'tags.slots');
});

test('review status requires tags', () => {
  const activity = readyActivity();
  activity.status = 'review';
  delete activity.tags;
  assertReports(validateActivity(activity, allFilesExist), 'tags');
});

test('tags on a preparing activity are still validated', () => {
  const activity = preparingActivity();
  activity.tags = { kids: 'maybe', place: 'indoor', rain: 'ok', slots: ['weeknight'], interests: ['move'] };
  assertReports(validateActivity(activity, allFilesExist), 'tags.kids');
});

test('activity surveys need an https url and a form entry id', () => {
  const activity = readyActivity();
  activity.surveys = { participant: { url: 'http://x', activityEntry: 'entry.1' } };
  assertReports(validateActivity(activity, allFilesExist), 'surveys.participant.url');
  activity.surveys = { staff: { url: 'https://x', activityEntry: 'activity' } };
  assertReports(validateActivity(activity, allFilesExist), 'surveys.staff.activityEntry');
  activity.surveys = { report: { url: 'https://x' } };
  assertReports(validateActivity(activity, allFilesExist), 'surveys.report.activityEntry');
  activity.surveys = { participant: { url: 'https://x', activityEntry: 'entry.1' } };
  assert.deepEqual(validateActivity(activity, allFilesExist), []);
});

test('missing card images are reported with their path', () => {
  const errors = validateActivity(readyActivity(), { fileExists: () => false });
  assertReports(errors, 'cards/brunch/');
});

test('only story cards need an og image', () => {
  const missingOg = { fileExists: (relPath) => !relPath.endsWith('-og.jpg') };
  assert.deepEqual(validateActivity(readyActivity(), missingOg), [
    'brunch: cardSets.story.cards[0] 找不到圖檔 cards/brunch/s1-og.jpg',
  ]);
});

test('card images are not checked without fileExists or before review', () => {
  assert.deepEqual(validateActivity(readyActivity()), []);
  const preparing = preparingActivity();
  preparing.cardSets = readyActivity().cardSets;
  assert.deepEqual(validateActivity(preparing, { fileExists: () => false }), []);
});

const withPrintFile = (activity) => ({
  ...activity,
  printFiles: [{ label: '故事卡（A4）', file: 'files/brunch-cards-story.pdf' }],
});

test('missing plan and print PDFs are reported with their path', () => {
  const noPdfs = { fileExists: (relPath) => !relPath.endsWith('.pdf') };
  assert.deepEqual(validateActivity(withPrintFile(readyActivity()), noPdfs), [
    'brunch: planFile 找不到檔案 files/brunch-plan.pdf',
    'brunch: printFiles[0].file 找不到檔案 files/brunch-cards-story.pdf',
  ]);
});

test('PDFs that exist pass', () => {
  assert.deepEqual(validateActivity(withPrintFile(readyActivity()), allFilesExist), []);
});

test('PDFs are not checked without fileExists or before review', () => {
  assert.deepEqual(validateActivity(withPrintFile(readyActivity())), []);
  const preparing = withPrintFile({ ...preparingActivity(), planFile: 'files/night-run-plan.pdf' });
  assert.deepEqual(validateActivity(preparing, { fileExists: () => false }), []);
});

test('story cards need their text', () => {
  const activity = readyActivity();
  delete activity.cardSets.story.cards[0].text;
  assertReports(validateActivity(activity, allFilesExist), 'cardSets.story.cards[0].text');
});

test('story cards of a ready or review activity need their sharing questions', () => {
  const activity = readyActivity();
  delete activity.cardSets.story.cards[0].questions;
  assert.deepEqual(validateActivity(activity, allFilesExist), ['brunch: cardSets.story.cards[0].questions 必填']);
  activity.status = 'review';
  assert.deepEqual(validateActivity(activity, allFilesExist), ['brunch: cardSets.story.cards[0].questions 必填']);
});

test('story cards of a preparing activity may leave out the sharing questions', () => {
  const preparing = preparingActivity();
  preparing.cardSets = readyActivity().cardSets;
  delete preparing.cardSets.story.cards[0].questions;
  assert.deepEqual(validateActivity(preparing, allFilesExist), []);
});

test('sharing questions must be a non-empty list of text', () => {
  const activity = readyActivity();
  const card = activity.cardSets.story.cards[0];
  card.questions = [];
  assertReports(validateActivity(activity, allFilesExist), 'cardSets.story.cards[0].questions 至少要有 1 項');
  card.questions = ['第一題？', ' '];
  assertReports(validateActivity(activity, allFilesExist), 'cardSets.story.cards[0].questions[1]');
  card.questions = '第一題？';
  assertReports(validateActivity(activity, allFilesExist), 'cardSets.story.cards[0].questions 要是陣列');
});

test('a story card of a ready or review activity may show the note printed on its front instead of sharing questions', () => {
  const activity = readyActivity();
  const card = activity.cardSets.story.cards[0];
  delete card.questions;
  card.note = { label: '想一想', text: '這是測試用的卡片正面短文。' };
  assert.deepEqual(validateActivity(activity, allFilesExist), []);
  activity.status = 'review';
  assert.deepEqual(validateActivity(activity, allFilesExist), []);
});

test('a story card may carry both sharing questions and a note', () => {
  const activity = readyActivity();
  activity.cardSets.story.cards[0].note = { label: '想一想', text: '這是測試用的卡片正面短文。' };
  assert.deepEqual(validateActivity(activity, allFilesExist), []);
});

test('a note needs both its printed label and its text', () => {
  const activity = readyActivity();
  const card = activity.cardSets.story.cards[0];
  delete card.questions;
  card.note = { label: '想一想' };
  assertReports(validateActivity(activity, allFilesExist), 'cardSets.story.cards[0].note.text 必填');
  card.note = { label: ' ', text: '這是測試用的卡片正面短文。' };
  assertReports(validateActivity(activity, allFilesExist), 'cardSets.story.cards[0].note.label 要是有內容的文字');
  card.note = '想一想';
  assertReports(validateActivity(activity, allFilesExist), 'cardSets.story.cards[0].note 要是物件');
});

test('sharing questions are optional on topic cards but checked when given', () => {
  const activity = readyActivity();
  const topicCard = activity.cardSets.topic.cards[0];
  topicCard.questions = ['測試用的提問？'];
  assert.deepEqual(validateActivity(activity, allFilesExist), []);
  topicCard.questions = [''];
  assertReports(validateActivity(activity, allFilesExist), 'cardSets.topic.cards[0].questions[0]');
});

test('ready status requires preflight', () => {
  const activity = readyActivity();
  delete activity.preflight;
  assertReports(validateActivity(activity, allFilesExist), 'preflight');
});

test('validateSite accepts the site settings and rejects a baseUrl without trailing slash', () => {
  const site = {
    title: '兄弟時光',
    baseUrl: 'https://cades.github.io/brotime-portal/',
    surveys: { participant: null, staff: null },
  };
  assert.deepEqual(validateSite(site), []);
  assert.deepEqual(validateSite(fixtureSite()), []);
  assertReports(validateSite({ ...site, baseUrl: 'https://cades.github.io/brotime-portal' }), 'baseUrl');
});

test('validateSite accepts a survey with an https url and a form entry id', () => {
  const survey = { url: 'https://docs.google.com/forms/d/e/x/viewform', activityEntry: 'entry.313211030' };
  assert.deepEqual(validateSite({ ...fixtureSite(), surveys: { participant: survey, staff: null, report: null } }), []);
  assert.deepEqual(validateSite({ ...fixtureSite(), surveys: { participant: null, staff: null, report: survey } }), []);
});

test('validateSite checks the activity report form like the surveys', () => {
  const withReport = (report) => ({ ...fixtureSite(), surveys: { participant: null, staff: null, report } });
  assertReports(validateSite(withReport({ url: 'http://x/viewform', activityEntry: 'entry.1' })), 'surveys.report.url');
  assertReports(
    validateSite(withReport({ url: 'https://x/viewform', activityEntry: 'entry.' })),
    'surveys.report.activityEntry',
  );
});

test('validateSite rejects a survey without an https url or a form entry id', () => {
  const withParticipant = (participant) => ({ ...fixtureSite(), surveys: { participant, staff: null } });
  assertReports(
    validateSite(withParticipant({ url: 'http://x/viewform', activityEntry: 'entry.1' })),
    'surveys.participant.url',
  );
  assertReports(
    validateSite(withParticipant({ url: 'https://x/viewform', activityEntry: 'entry.abc' })),
    'surveys.participant.activityEntry',
  );
  assertReports(validateSite(withParticipant({ url: 'https://x/viewform' })), 'surveys.participant.activityEntry');
  assertReports(validateSite(withParticipant('https://x/viewform')), 'surveys.participant');
});

test('validateAll accepts the fixtures together', () => {
  const content = { activities: [readyActivity(), preparingActivity()], site: fixtureSite() };
  assert.deepEqual(validateAll(content, allFilesExist), []);
});

test('validateAll reports a repeated order', () => {
  const duplicate = preparingActivity();
  duplicate.order = readyActivity().order;
  const content = { activities: [readyActivity(), duplicate], site: fixtureSite() };
  assertReports(validateAll(content, allFilesExist), 'order');
});

test('validateAll reports a repeated id', () => {
  const content = { activities: [readyActivity(), { ...readyActivity(), order: 2 }], site: fixtureSite() };
  assertReports(validateAll(content, allFilesExist), 'id');
});

test('validateAll checks city-walk route story cards against the story set', () => {
  const site = fixtureSite();
  const routes = [
    { district: '台北西區', stop1: { storyCard: 'P' } },
    { district: '台北東區', stop1: { storyCard: null } },
    { district: '新竹區', stop1: { storyCard: 'Q' } },
  ];
  const errors = validateAll({ activities: [cityWalkActivity()], site, routes }, allFilesExist);
  assert.equal(errors.length, 2, JSON.stringify(errors));
  assertReports(errors, '台北東區');
  assertReports(errors, '新竹區');
  assert.ok(errors.every((error) => error.includes('stop1.storyCard')), JSON.stringify(errors));
});

test('validateAll skips route checks while city-walk is preparing', () => {
  const preparing = { ...preparingActivity(), id: 'city-walk' };
  const routes = [{ district: '台北東區', stop1: { storyCard: null } }];
  const errors = validateAll({ activities: [preparing], site: fixtureSite(), routes }, allFilesExist);
  assert.deepEqual(errors, []);
});
