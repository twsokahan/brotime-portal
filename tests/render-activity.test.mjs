import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderActivityMain, renderPreparingMain } from '../src/render/activity.mjs';
import { readyActivity, preparingActivity, fixtureSite } from './fixtures/activities.mjs';

const REL = '../../';
const OFFLINE_HINT = '要去沒訊號的地方，出發前在有訊號處先按『開始活動』。';

const render = ({ activity = readyActivity(), site = fixtureSite(), preview = false } = {}) =>
  renderActivityMain({ activity, site, rel: REL, preview });

function templateContent(html, id) {
  const match = html.match(new RegExp(`<template id="${id}"[^>]*>([\\s\\S]*?)</template>`));
  assert.ok(match, `expected a <template id="${id}">`);
  return match[1];
}

function stepItem(html, title) {
  const at = html.indexOf(`>${title}<`);
  assert.ok(at >= 0, `expected a step titled ${title}`);
  return html.slice(html.lastIndexOf('<li', at), html.indexOf('</li>', at));
}

function activityData(html) {
  const match = html.match(/<script type="application\/json" id="activity-data">([\s\S]*?)<\/script>/);
  assert.ok(match, 'expected the activity-data script');
  return JSON.parse(match[1]);
}

const siteWithSurveys = (surveys) => ({ ...fixtureSite(), surveys });
const PARTICIPANT_SURVEY = { url: 'https://example.com/f', activityEntry: 'entry.1' };
const STAFF_SURVEY = { url: 'https://example.com/staff', activityEntry: 'entry.2' };
const BRUNCH_NAME = encodeURIComponent('兄弟早午餐會');

test('the activity page shows the prep lists, the flow and the start button', () => {
  const html = render();
  for (const text of ['企劃室提供', '你要做的', '60 分鐘這樣過', '開始活動 ▶', OFFLINE_HINT]) {
    assert.ok(html.includes(text), `expected ${text}`);
  }
});

test('the provided list comes before the flow', () => {
  const html = render();
  assert.ok(html.indexOf('企劃室提供') < html.indexOf('60 分鐘這樣過'));
});

test('a custom flow title replaces the 60-minute default', () => {
  const activity = readyActivity();
  activity.flowTitle = '半天這樣過';
  const html = render({ activity });
  assert.ok(html.includes('半天這樣過'));
  assert.ok(!html.includes('60 分鐘這樣過'));
});

test('the step using topic cards shows their thumbnails with the card titles as alt text', () => {
  const step = stepItem(render(), '邊吃邊聊');
  assert.ok(step.includes('src="../../cards/brunch/t02-thumb.webp"'));
  assert.ok(step.includes('alt="最近吃到最好吃的一餐是什麼？"'));
});

test('cardIds pick which thumbnails a step shows', () => {
  const activity = readyActivity();
  activity.steps[1].cardIds = ['t11'];
  const step = stepItem(render({ activity }), '邊吃邊聊');
  assert.ok(step.includes('cards/brunch/t11-thumb.webp'));
  assert.ok(!step.includes('cards/brunch/t02-thumb.webp'));
});

test('a story card thumbnail links to its own card page and has a QR template', () => {
  const html = render();
  const step = stepItem(html, '一起讀故事');
  assert.match(step, /<a href="cards\/s1\/"><img src="\.\.\/\.\.\/cards\/brunch\/s1-thumb\.webp"/);
  assert.ok(templateContent(html, 'qr-card-s1').includes('<svg'));
});

test('without a participant survey link the QR slot says the link is coming', () => {
  const slot = templateContent(render(), 'qr-participant');
  assert.ok(slot.includes('問卷連結準備中'));
  assert.ok(!slot.includes('<svg'));
});

test('with a participant survey the QR slot holds a QR code of the url with the activity name filled in', () => {
  const html = render({ site: siteWithSurveys({ participant: PARTICIPANT_SURVEY, staff: null }) });
  assert.ok(templateContent(html, 'qr-participant').includes('<svg'));
  assert.ok(
    html.includes(
      `<template id="qr-participant" data-url="https://example.com/f?usp=pp_url&amp;entry.1=${BRUNCH_NAME}">`,
    ),
  );
});

test("an activity's own participant survey wins over the site-wide one", () => {
  const activity = readyActivity();
  activity.surveys = { participant: { url: 'https://example.com/own', activityEntry: 'entry.9' } };
  const html = render({ activity, site: siteWithSurveys({ participant: PARTICIPANT_SURVEY, staff: null }) });
  assert.ok(html.includes(`data-url="https://example.com/own?usp=pp_url&amp;entry.9=${BRUNCH_NAME}"`));
});

test('without a staff survey link the staff slot says the link is coming', () => {
  const slot = templateContent(render(), 'staff-survey');
  assert.ok(slot.includes('工作人員問卷連結準備中'));
  assert.ok(!slot.includes('href='));
});

test('with a staff survey the staff slot links to it with the activity name filled in', () => {
  const html = render({ site: siteWithSurveys({ participant: null, staff: STAFF_SURVEY }) });
  const slot = templateContent(html, 'staff-survey');
  assert.ok(slot.includes(`<a href="https://example.com/staff?usp=pp_url&amp;entry.2=${BRUNCH_NAME}">填工作人員問卷</a>`));
  assert.ok(!slot.includes('準備中'));
});

test('an activity that may not go ahead in the rain says what to do', () => {
  const activity = readyActivity();
  activity.tags.rain = 'postpone';
  activity.rainNote = '延期一週';
  assert.ok(render({ activity }).includes('下雨怎麼辦：延期一週'));
  assert.ok(!render().includes('下雨怎麼辦'));
});

test('the preview banner appears only in preview', () => {
  assert.ok(render({ preview: true }).includes('預覽：這個活動還沒上線'));
  assert.ok(!render().includes('預覽：這個活動還沒上線'));
});

test('the collapsed sections count first-time tips and link the plan file', () => {
  const html = render();
  assert.ok(html.includes('第一次主持記得 3 件事'));
  assert.ok(html.includes('想多留 30 分鐘（選配）'));
  assert.ok(html.includes('<a href="../../files/brunch-plan.pdf">下載企劃案（PDF）</a>'));
  assert.ok(!html.includes('想印實體卡的話：'));
});

test('print files are offered as PDF downloads', () => {
  const activity = readyActivity();
  activity.printFiles = [{ label: '故事卡（A4）', file: 'files/brunch-cards-story.pdf' }];
  const html = render({ activity });
  assert.ok(html.includes('想印實體卡的話：'));
  assert.ok(html.includes('<a href="../../files/brunch-cards-story.pdf">故事卡（A4）（PDF）</a>'));
});

test('the live-mode data leaves out the reading-only sections and adds the base url', () => {
  const data = activityData(render());
  assert.equal(data.baseUrl, 'https://cades.github.io/brotime-portal/');
  assert.equal(data.id, 'brunch');
  assert.deepEqual(data.steps, readyActivity().steps);
  assert.ok(!('extra30' in data));
  assert.ok(!('firstTime' in data));
});

test('a closing script tag inside the data cannot end the data script early', () => {
  const activity = readyActivity();
  activity.steps[0].say = '</script><script>alert(1)</script>';
  const html = render({ activity });
  assert.equal(html.split('</script>').length - 1, 1);
  assert.equal(activityData(html).steps[0].say, '</script><script>alert(1)</script>');
});

test('inserted text is escaped', () => {
  const activity = readyActivity();
  activity.name = `A & B <i>"'`;
  const html = render({ activity });
  assert.ok(html.includes('A &amp; B &lt;i&gt;&quot;&#39;'));
  assert.ok(!html.includes('<i>'));
});

test('a preparing activity only says it is on the way and links back home', () => {
  const html = renderPreparingMain({ activity: preparingActivity(), rel: REL });
  assert.ok(html.includes('<h1>河濱夜跑・單車</h1>'));
  assert.ok(html.includes('下班後沿著河濱跑一段，邊跑邊聊'));
  assert.ok(html.includes('這個活動還在準備中，做好後會放在這裡。'));
  assert.ok(html.includes('<a href="../../">← 回到所有活動</a>'));
  assert.ok(!html.includes('開始活動'));
});
