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

test('a step after the story step may show its sharing questions', () => {
  const activity = readyActivity();
  activity.steps[3].showStoryQuestions = true;
  activity.steps[4].showStoryQuestions = true;
  assert.deepEqual(validateActivity(activity, allFilesExist), []);
});

test('showStoryQuestions needs a story step before it', () => {
  const activity = readyActivity();
  activity.steps[1].showStoryQuestions = true;
  assert.deepEqual(validateActivity(activity, allFilesExist), ['brunch: steps[1].showStoryQuestions 前面要有一步用到故事卡']);
  delete activity.steps[1].showStoryQuestions;
  activity.steps[2].showStoryQuestions = true;
  assert.deepEqual(validateActivity(activity, allFilesExist), ['brunch: steps[2].showStoryQuestions 前面要有一步用到故事卡']);
});

test('showStoryQuestions can only be true', () => {
  const activity = readyActivity();
  for (const value of [false, 'true', 1]) {
    activity.steps[3].showStoryQuestions = value;
    assert.deepEqual(validateActivity(activity, allFilesExist), ['brunch: steps[3].showStoryQuestions 只能是 true']);
  }
});

function withIchiban(grades = { A: 1, B: 2, C: 3, D: 4 }) {
  const activity = readyActivity();
  activity.ichiban = { grades };
  return activity;
}

test('an activity may offer the electronic ichiban kuji on one of its steps', () => {
  const activity = withIchiban();
  activity.steps[2].tool = 'ichiban';
  assert.deepEqual(validateActivity(activity, allFilesExist), []);
});

test('ichiban grades need exactly the grades A to D', () => {
  assert.deepEqual(validateActivity(withIchiban({ A: 1, B: 2, C: 3 }), allFilesExist), [
    'brunch: ichiban.grades 要剛好是 A、B、C、D 這 4 個等級',
  ]);
});

test('ichiban grade counts must be whole numbers', () => {
  assert.deepEqual(validateActivity(withIchiban({ A: 1, B: 2, C: 1.5, D: 4 }), allFilesExist), [
    'brunch: ichiban.grades 每一賞要是 0–99 的整數',
  ]);
});

test('ichiban grades need at least one ticket', () => {
  assert.deepEqual(validateActivity(withIchiban({ A: 0, B: 0, C: 0, D: 0 }), allFilesExist), [
    'brunch: ichiban.grades 加起來至少要有 1 張',
  ]);
});

test('ichiban grades may add up to at most 100 tickets', () => {
  assert.deepEqual(validateActivity(withIchiban({ A: 99, B: 2, C: 0, D: 0 }), allFilesExist), [
    'brunch: ichiban.grades 加起來不能超過 100 張',
  ]);
});

test('ichiban must be an object', () => {
  const activity = readyActivity();
  activity.ichiban = 'A1 B2 C3 D4';
  assert.deepEqual(validateActivity(activity, allFilesExist), ['brunch: ichiban 要是物件']);
});

test('a step can use the ichiban tool only when the activity has an ichiban setting', () => {
  const activity = readyActivity();
  activity.steps[2].tool = 'ichiban';
  assert.deepEqual(validateActivity(activity, allFilesExist), ['brunch: steps[2].tool 要先有 ichiban 設定']);
});

test('a step tool must be a known tool', () => {
  const activity = withIchiban();
  activity.steps[2].tool = 'quiz';
  assert.deepEqual(validateActivity(activity, allFilesExist), ['brunch: steps[2].tool 要是 ichiban 其中之一']);
});

test('a step may give what to read aloud as plain text', () => {
  const activity = readyActivity();
  activity.steps[4].readAloud = '謝謝大家今天一起來。';
  assert.deepEqual(validateActivity(activity, allFilesExist), []);
  activity.steps[4].readAloud = '';
  assert.deepEqual(validateActivity(activity, allFilesExist), ['brunch: steps[4].readAloud 要是有內容的文字']);
});

test('a step may give what to read aloud with a label and a source', () => {
  const activity = readyActivity();
  activity.steps[4].readAloud = { label: '收尾的話', text: '第一段。\n\n第二段。', source: '《新・人間革命》第11卷〈躍進〉' };
  assert.deepEqual(validateActivity(activity, allFilesExist), []);
  activity.steps[4].readAloud = { text: '只有要念的文字。' };
  assert.deepEqual(validateActivity(activity, allFilesExist), []);
});

test('what to read aloud needs its text', () => {
  const activity = readyActivity();
  activity.steps[4].readAloud = { label: '收尾的話' };
  assert.deepEqual(validateActivity(activity, allFilesExist), ['brunch: steps[4].readAloud.text 必填']);
  activity.steps[4].readAloud = { text: ' ' };
  assert.deepEqual(validateActivity(activity, allFilesExist), ['brunch: steps[4].readAloud.text 要是有內容的文字']);
});

test('the label and source of what to read aloud cannot be empty', () => {
  const activity = readyActivity();
  activity.steps[4].readAloud = { label: '', text: '要念的文字。', source: '' };
  assert.deepEqual(validateActivity(activity, allFilesExist), [
    'brunch: steps[4].readAloud.label 要是有內容的文字',
    'brunch: steps[4].readAloud.source 要是有內容的文字',
  ]);
});

test('what to read aloud only takes a label, text and source', () => {
  const activity = readyActivity();
  activity.steps[4].readAloud = { text: '要念的文字。', title: '收尾的話' };
  assert.deepEqual(validateActivity(activity, allFilesExist), ['brunch: steps[4].readAloud.title 只能有 label、text、source']);
  for (const value of [['要念的文字。'], 42]) {
    activity.steps[4].readAloud = value;
    assert.deepEqual(validateActivity(activity, allFilesExist), ['brunch: steps[4].readAloud 要是文字，或有 text 的物件']);
  }
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

test('a card may carry the answer that is revealed after the vote', () => {
  const activity = readyActivity();
  activity.cardSets.topic.kind = 'other';
  activity.cardSets.topic.cards[0].reveal = {
    lead: '這是測試用的揭曉引言——',
    text: '這是測試用的揭曉原文第一段。\n\n這是第二段。',
    source: '《新・人間革命》第 7 卷〈早春〉p.228-229',
  };
  assert.deepEqual(validateActivity(activity, allFilesExist), []);
});

test('a revealed answer needs its lead, its text and its source', () => {
  const activity = readyActivity();
  const card = activity.cardSets.topic.cards[0];
  card.reveal = { lead: '這是測試用的揭曉引言——', text: '這是測試用的揭曉原文。' };
  assertReports(validateActivity(activity, allFilesExist), 'cardSets.topic.cards[0].reveal.source 必填');
  card.reveal = { text: '這是測試用的揭曉原文。', source: '《新・人間革命》第 7 卷〈早春〉' };
  assertReports(validateActivity(activity, allFilesExist), 'cardSets.topic.cards[0].reveal.lead 必填');
  card.reveal = '這是測試用的揭曉原文。';
  assertReports(validateActivity(activity, allFilesExist), 'cardSets.topic.cards[0].reveal 要是物件');
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

const cityWalkRoute = (district, storyCard, overrides = {}) => ({
  id: district,
  district,
  stop1: { storyCard },
  legTexts: ['測試公園 → 測試館', '測試館 → 測試公園'],
  legPaths: [
    [
      [25, 121],
      [25, 121.001],
    ],
    [
      [25, 121.001],
      [25, 121],
    ],
  ],
  legNavUrls: ['https://www.google.com/maps/dir/?api=1&leg=1', 'https://www.google.com/maps/dir/?api=1&leg=2'],
  ...overrides,
});

const routeErrorsFor = (route) => validateAll({ activities: [cityWalkActivity()], site: fixtureSite(), routes: [route] }, allFilesExist);

test('validateAll checks city-walk route story cards against the story set', () => {
  const site = fixtureSite();
  const routes = [cityWalkRoute('台北西區', 'P'), cityWalkRoute('台北東區', null), cityWalkRoute('新竹區', 'Q')];
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

test('a complete city-walk route passes the route checks', () => {
  assert.deepEqual(routeErrorsFor(cityWalkRoute('台北東區', 'P')), []);
});

test('a city-walk route needs the road names of both legs', () => {
  const errors = routeErrorsFor(cityWalkRoute('台北東區', 'P', { legTexts: ['測試公園 → 測試館'] }));
  assert.equal(errors.length, 1, JSON.stringify(errors));
  assertReports(errors, 'routes[台北東區].legTexts');
});

test('a city-walk route needs a drawable path for both legs', () => {
  const errors = routeErrorsFor(cityWalkRoute('台北東區', 'P', { legPaths: [[[25, 121], [25, 121.001]], [[25, 121]]] }));
  assert.equal(errors.length, 1, JSON.stringify(errors));
  assertReports(errors, 'routes[台北東區].legPaths');
});

test('a city-walk route needs a Google Maps link for both legs', () => {
  const errors = routeErrorsFor(
    cityWalkRoute('台北東區', 'P', { legNavUrls: ['https://www.google.com/maps/dir/?api=1&leg=1', 'https://example.com/'] }),
  );
  assert.equal(errors.length, 1, JSON.stringify(errors));
  assertReports(errors, 'routes[台北東區].legNavUrls');
});

function datedActivity(availability) {
  return { ...readyActivity(), availability };
}

const OCTOBER_2027 = { from: '2027-10-01', to: '2027-10-31', label: '2027 年 10 月', note: '確切日期以學會公告為準' };

test('availability with dates, a label and an optional note is valid', () => {
  assert.deepEqual(validateActivity(datedActivity(OCTOBER_2027), allFilesExist), []);
  const { note, ...withoutNote } = OCTOBER_2027;
  assert.deepEqual(validateActivity(datedActivity(withoutNote), allFilesExist), []);
});

test('availability needs real YYYY-MM-DD dates in order and a label', () => {
  assertReports(validateActivity(datedActivity({ ...OCTOBER_2027, from: '2027/10/01' }), allFilesExist), 'availability.from');
  assertReports(validateActivity(datedActivity({ ...OCTOBER_2027, to: '2027-02-30' }), allFilesExist), 'availability.to');
  assertReports(
    validateActivity(datedActivity({ ...OCTOBER_2027, from: '2027-11-01' }), allFilesExist),
    'availability.to 不能早於 from',
  );
  assertReports(validateActivity(datedActivity({ ...OCTOBER_2027, label: '' }), allFilesExist), 'availability.label');
});

test('an extra30 item can link a city-walk route, and a custom extras title must be text', () => {
  const activity = readyActivity();
  activity.extra30 = ['一起吃頓飯。', { text: '多走一段城市散步。', cityWalkRoute: '台北西區' }];
  activity.extraTitle = '加碼推薦（選配）';
  assert.deepEqual(validateActivity(activity, allFilesExist), []);

  activity.extra30 = [{ text: '', cityWalkRoute: '台北西區' }, { cityWalkRoute: '台北西區' }, 3];
  activity.extraTitle = '';
  const errors = validateActivity(activity, allFilesExist);
  assertReports(errors, 'extra30[0].text');
  assertReports(errors, 'extra30[1].text');
  assertReports(errors, 'extra30[2]');
  assertReports(errors, 'extraTitle');
});

test('validateAll reports an extra30 route that is not a city-walk route', () => {
  const activity = { ...readyActivity(), id: 'trip', order: 2, planFile: 'files/trip-plan.pdf' };
  activity.extra30 = [
    { text: '多走一段。', cityWalkRoute: '台北西區' },
    { text: '再走一段。', cityWalkRoute: '火星區' },
  ];
  const routes = [cityWalkRoute('台北西區', 'P')];
  const errors = validateAll({ activities: [cityWalkActivity(), activity], site: fixtureSite(), routes }, allFilesExist);
  assert.deepEqual(errors, ['trip: extra30[1].cityWalkRoute 火星區 不在城市散步路線裡']);
});

test('order can go up to 18', () => {
  assert.deepEqual(validateActivity({ ...readyActivity(), order: 18 }, allFilesExist), []);
  assertReports(validateActivity({ ...readyActivity(), order: 19 }, allFilesExist), 'order');
});

const venueSpot = (overrides = {}) => ({
  name: 'Slope Cafe',
  what: '咖啡店',
  hours: '週二～日 09:00–17:00',
  distance: '直線約 151 公尺',
  mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Slope',
  ...overrides,
});

const venuePlace = (overrides = {}) => ({
  id: 'zhishan',
  name: '至善館',
  region: '北部',
  address: '台北市士林區至善路二段250號',
  transit: '捷運士林站轉公車',
  food: [venueSpot()],
  walks: [],
  cityWalks: [{ text: '士林官邸花園線。', cityWalkRoute: '台北西區' }],
  ...overrides,
});

function venueActivity(places = [venuePlace()]) {
  const activity = readyActivity();
  activity.venues = {
    title: '選分館',
    prompt: '先選分館',
    intro: ['週一休館。'],
    link: { text: '官網', url: 'https://www.sokaculture.org.tw/art-centers' },
    places,
  };
  activity.steps[0].venueStop = 'meet';
  activity.steps[1].venueStop = 'sit';
  return activity;
}

test('venues with places to eat, walks, city walks, notes and an area are valid', () => {
  assert.deepEqual(validateActivity(venueActivity(), allFilesExist), []);
  const place = venuePlace({ area: '台北士林', walks: [venueSpot({ why: '近' })], notes: ['停車沒查到。'] });
  assert.deepEqual(validateActivity(venueActivity([place]), allFilesExist), []);
});

test('venues need a title, prompt, intro, an https link and at least one place', () => {
  const activity = venueActivity([]);
  activity.venues.title = '';
  activity.venues.link.url = 'http://example.com/';
  delete activity.venues.intro;
  const errors = validateActivity(activity, allFilesExist);
  assertReports(errors, 'venues.title');
  assertReports(errors, 'venues.intro');
  assertReports(errors, 'venues.link.url 要是 https:// 開頭的網址');
  assertReports(errors, 'venues.places 至少要有 1 項');
});

test('each venue needs its address, transit and complete places to eat', () => {
  const place = venuePlace({ address: '', food: [venueSpot({ hours: '', mapsUrl: 'maps' })] });
  delete place.transit;
  const errors = validateActivity(venueActivity([place]), allFilesExist);
  assertReports(errors, 'venues.places[0].address');
  assertReports(errors, 'venues.places[0].transit');
  assertReports(errors, 'venues.places[0].food[0].hours');
  assertReports(errors, 'venues.places[0].food[0].mapsUrl 要是 https:// 開頭的網址');
});

test('venue ids are lowercase and not repeated', () => {
  const errors = validateActivity(venueActivity([venuePlace(), venuePlace({ id: 'zhishan' }), venuePlace({ id: '至善' })]), allFilesExist);
  assertReports(errors, 'venues.places[1].id zhishan 跟 venues.places[0] 重複');
  assertReports(errors, 'venues.places[2].id 只能用小寫英文、數字和 -');
});

test('a venue stop is meet or sit and needs venues', () => {
  const activity = venueActivity();
  activity.steps[0].venueStop = 'park';
  assertReports(validateActivity(activity, allFilesExist), 'steps[0].venueStop');
  const withoutVenues = readyActivity();
  withoutVenues.steps[0].venueStop = 'meet';
  assertReports(validateActivity(withoutVenues, allFilesExist), 'steps[0].venueStop 要先有 venues');
});

test('validateAll reports a venue city walk that is not a city-walk route', () => {
  const activity = { ...venueActivity(), id: 'art', order: 2, planFile: 'files/art-plan.pdf' };
  activity.venues.places[0].cityWalks.push({ text: '再走一段。', cityWalkRoute: '火星區' });
  const routes = [cityWalkRoute('台北西區', 'P')];
  const errors = validateAll({ activities: [cityWalkActivity(), activity], site: fixtureSite(), routes }, allFilesExist);
  assert.deepEqual(errors, ['art: venues.places[0].cityWalks[1].cityWalkRoute 火星區 不在城市散步路線裡']);
});

test('a card can be marked for kids with true only', () => {
  const activity = readyActivity();
  activity.cardSets.topic.cards[0].forKids = true;
  assert.deepEqual(validateActivity(activity, allFilesExist), []);
  activity.cardSets.topic.cards[0].forKids = 'yes';
  assertReports(validateActivity(activity, allFilesExist), 'cardSets.topic.cards[0].forKids 只能是 true');
});

test('a flow note must be text', () => {
  assert.deepEqual(validateActivity({ ...readyActivity(), flowNote: '先吃飯也可以。' }, allFilesExist), []);
  assertReports(validateActivity({ ...readyActivity(), flowNote: '' }, allFilesExist), 'flowNote');
});
