import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderActivityMain, renderPreparingMain } from '../src/render/activity.mjs';
import { readyActivity, preparingActivity, fixtureSite } from './fixtures/activities.mjs';

const REL = '../../';
const OFFLINE_HINT = '要去沒訊號的地方，出發前在有訊號處先按『開始』。';

const render = ({ activity = readyActivity(), site = fixtureSite() } = {}) =>
  renderActivityMain({ activity, site, rel: REL });

function templateContent(html, id) {
  const match = html.match(new RegExp(`<template id="${id}"[^>]*>([\\s\\S]*?)</template>`));
  assert.ok(match, `expected a <template id="${id}">`);
  return match[1];
}

function todoBox(html) {
  const at = html.indexOf('<div class="box todo">');
  assert.ok(at >= 0, 'expected the 你要做的 box');
  return html.slice(at, html.indexOf('</div>', at));
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
const REPORT_FORM = { url: 'https://example.com/report', activityEntry: 'entry.3' };
const BRUNCH_NAME = encodeURIComponent('兄弟早午餐會');

test('the activity page shows the todo list, the flow and the start button', () => {
  const html = render();
  for (const text of ['<h2>你要做的</h2>', '60 分鐘這樣過', '開始 ▶']) {
    assert.ok(html.includes(text), `expected ${text}`);
  }
});

test('the todo list comes after the flow and the start button, before the extras', () => {
  const html = render();
  const todo = html.indexOf('<section class="prepare">');
  assert.ok(html.indexOf('<section class="flow">') < todo);
  assert.ok(html.indexOf('<div class="start">') < todo);
  assert.ok(todo < html.indexOf('<section class="more">'));
});

test('the activity page leaves out what the planning office provides and the survey box', () => {
  const html = render();
  for (const text of ['企劃室提供', '<h2>要準備</h2>', '<h3>你要做的</h3>', '<h3>問卷']) {
    assert.ok(!html.includes(text), `expected no ${text}`);
  }
});

test('the offline hint under the start button shows only for activities not held indoors', () => {
  assert.ok(!render().includes(OFFLINE_HINT));
  const outdoors = readyActivity();
  outdoors.tags.place = 'outdoor';
  assert.ok(render({ activity: outdoors }).includes(OFFLINE_HINT));
  const either = readyActivity();
  either.tags.place = 'both';
  assert.ok(render({ activity: either }).includes(OFFLINE_HINT));
});

test('the activity page opens with a link back to the entry page', () => {
  assert.ok(render().startsWith(`<p class="home-link"><a href="${REL}">← 看其他兄弟時光</a></p>`));
});

test('a custom flow title replaces the 60-minute default', () => {
  const activity = readyActivity();
  activity.flowTitle = '半天這樣過';
  const html = render({ activity });
  assert.ok(html.includes('半天這樣過'));
  assert.ok(!html.includes('60 分鐘這樣過'));
});

function todoGroups(box) {
  return box
    .split('<h4>')
    .slice(1)
    .map((part) => ({ when: part.slice(0, part.indexOf('</h4>')), rows: part.split('<li>').slice(1) }));
}

test('the todo list shows each time once, with its tasks under it, in order of first appearance', () => {
  const activity = readyActivity();
  activity.todo = [
    { when: '3–4 週前', task: '選好店' },
    { when: '前一天', task: '發提醒訊息' },
    { when: '3–4 週前', task: '邀一位成員分享' },
  ];
  const groups = todoGroups(todoBox(render({ activity })));
  assert.deepEqual(
    groups.map(({ when }) => when),
    ['3–4 週前', '前一天'],
  );
  assert.equal(groups[0].rows.length, 2);
  assert.ok(groups[0].rows[0].includes('選好店'));
  assert.ok(groups[0].rows[1].includes('邀一位成員分享'));
  assert.equal(groups[1].rows.length, 1);
  assert.ok(groups[1].rows[0].includes('發提醒訊息'));
});

test('a todo task with details folds them under the task', () => {
  const activity = readyActivity();
  activity.todo = [{ when: '前一天', task: '備好<急救包>', detail: 'OK 繃 & 優碘' }];
  const [row] = todoGroups(todoBox(render({ activity })))[0].rows;
  assert.ok(row.includes('<details><summary>備好&lt;急救包&gt;</summary><p>OK 繃 &amp; 優碘</p></details>'), row);
});

test('a todo task without details is plain text', () => {
  const [row] = todoGroups(todoBox(render()))[1].rows;
  assert.ok(row.includes('提醒大家時間地點'));
  assert.ok(!row.includes('<details'));
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

test('a step shows every story card, even past three', () => {
  const activity = readyActivity();
  const [first] = activity.cardSets.story.cards;
  activity.cardSets.story.cards.push(...['s2', 's3', 's4'].map((id) => ({ ...first, id })));
  const step = stepItem(render({ activity }), '一起讀故事');
  for (const id of ['s1', 's2', 's3', 's4']) assert.ok(step.includes(`cards/brunch/${id}-thumb.webp`), id);
});

test('a step shows only the first three topic cards', () => {
  const activity = readyActivity();
  activity.cardSets.topic.cards.push({ id: 't12', title: '測試用的第四張話題卡？', group: '前菜' });
  const step = stepItem(render({ activity }), '邊吃邊聊');
  assert.ok(step.includes('cards/brunch/t11-thumb.webp'));
  assert.ok(!step.includes('cards/brunch/t12-thumb.webp'));
});

test('a story card thumbnail links to its own card page and has a QR template', () => {
  const html = render();
  const step = stepItem(html, '一起讀故事');
  assert.match(step, /<a class="story-thumb" href="cards\/s1\/"><img src="\.\.\/\.\.\/cards\/brunch\/s1-thumb\.webp"[^>]*><\/a>/);
  assert.ok(templateContent(html, 'qr-card-s1').includes('<svg'));
});

test('the books to prepare come right after the head, before the prep lists', () => {
  const html = render();
  const books = html.indexOf('<section class="books"');
  assert.ok(html.indexOf('</header>') < books && books < html.indexOf('<section class="prepare">'));
  const section = html.slice(books, html.indexOf('</section>', books));
  for (const text of ['<h2 id="books-title">要準備的《新・人間革命》</h2>', '要帶第16卷〈羽翼〉', '當天帶這一本就好。']) {
    assert.ok(section.includes(text), `expected ${text}`);
  }
});

test('the books section lists each volume with the cards in it', () => {
  const activity = readyActivity();
  const [first] = activity.cardSets.story.cards;
  const another = (id, volume, chapter) => ({ ...first, id, guide: { ...first.guide, volume, chapter } });
  activity.cardSets.story.cards = [first, another('s2', '第16卷', '羽翼'), another('s3', '第30卷（下）', '勝利歡呼')];
  const html = render({ activity });
  assert.ok(html.includes('<p class="books-head">當天只要帶一本</p>'));
  assert.ok(html.includes('<li><b>s1、s2</b> 在<strong>第16卷</strong>〈羽翼〉</li><li><b>s3</b> 在<strong>第30卷（下）</strong>〈勝利歡呼〉</li>'));
});

test('an activity without story cards has no books section', () => {
  const activity = readyActivity();
  delete activity.cardSets.story;
  activity.steps = activity.steps.map(({ cards, ...step }) => (cards?.includes('story') ? step : { ...step, cards }));
  assert.ok(!render({ activity }).includes('class="books"'));
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

test('with an activity report form the todo list ends with its own group for filling it in within a week', () => {
  const html = render({ site: siteWithSurveys({ participant: null, staff: null, report: REPORT_FORM }) });
  const groups = todoGroups(todoBox(html));
  const last = groups.at(-1);
  assert.equal(last.when, '結束後一週內');
  assert.equal(last.rows.length, 1);
  assert.ok(last.rows[0].includes(`<a href="https://example.com/report?usp=pp_url&amp;entry.3=${BRUNCH_NAME}">區負責人填線上回報表</a>`));
  assert.equal(groups.filter(({ when }) => when === '結束後一週內').length, 1);
});

test('without an activity report form the todo list has no report row', () => {
  assert.ok(!todoBox(render()).includes('結束後一週內'));
});

test('with an activity report form the end screen template links to it', () => {
  const html = render({ site: siteWithSurveys({ participant: null, staff: null, report: REPORT_FORM }) });
  assert.ok(
    templateContent(html, 'activity-report').includes(
      `<a href="https://example.com/report?usp=pp_url&amp;entry.3=${BRUNCH_NAME}">一週內填回報表</a>`,
    ),
  );
});

test('without an activity report form the end screen template is empty', () => {
  assert.equal(templateContent(render(), 'activity-report'), '');
});

test('an activity that may not go ahead in the rain says what to do', () => {
  const activity = readyActivity();
  activity.tags.rain = 'postpone';
  activity.rainNote = '延期一週';
  assert.ok(render({ activity }).includes('下雨怎麼辦：延期一週'));
  assert.ok(!render().includes('下雨怎麼辦'));
});

test('the collapsed sections count first-time tips and link the plan file', () => {
  const html = render();
  assert.ok(html.includes('第一次主持記得 3 件事'));
  assert.ok(html.includes('想多留 30 分鐘（選配）'));
  assert.ok(html.includes('<a href="../../files/brunch-plan.pdf">下載企劃案（PDF）</a>'));
  assert.ok(!html.includes('想印實體卡的話：'));
});

test('an activity with nothing to add for a longer stay leaves that section out', () => {
  const activity = readyActivity();
  activity.extra30 = [];
  const html = render({ activity });
  assert.ok(!html.includes('想多留 30 分鐘'));
  assert.ok(html.includes('第一次主持記得 3 件事'));
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

const ICHIBAN_LINK = '<a href="ichiban/">電子一番賞（不用刮刮卡也能抽）</a>';

test('an activity with an ichiban setting links to the electronic ichiban under the 你要做的 heading', () => {
  const activity = { ...readyActivity(), ichiban: { grades: { A: 1, B: 2, C: 3, D: 4 } } };
  const html = render({ activity });
  const link = html.indexOf(ICHIBAN_LINK);
  assert.ok(link >= 0, 'expected the ichiban link');
  assert.ok(html.indexOf('<h2>你要做的</h2>') < link);
  assert.ok(link < html.indexOf('<div class="box todo">'));
});

test('an activity without an ichiban setting has no ichiban link', () => {
  assert.ok(!render().includes('電子一番賞'));
});

test('an activity with a guide links to the guide page under the 你要做的 heading', () => {
  const guide = { title: '第一次看球？看這張就夠', sections: [{ heading: '一場怎麼打', items: ['一共九局。'] }] };
  const html = render({ activity: { ...readyActivity(), guide } });
  const link = html.indexOf('<a href="guide/">新手小抄：第一次看球？看這張就夠</a>');
  assert.ok(link >= 0, 'expected the guide link');
  assert.ok(html.indexOf('<h2>你要做的</h2>') < link);
  assert.ok(link < html.indexOf('<div class="box todo">'));
});

test('an activity without a guide has no guide link', () => {
  assert.ok(!render().includes('新手小抄'));
});

test('a preparing activity only says it is on the way and links back home', () => {
  const html = renderPreparingMain({ activity: preparingActivity(), rel: REL });
  assert.ok(html.includes('<h1>河濱夜跑・單車</h1>'));
  assert.ok(html.includes('下班後沿著河濱跑一段，邊跑邊聊'));
  assert.ok(html.includes('這一段還在準備中，做好後會放在這裡。'));
  assert.ok(html.includes('<a href="../../">← 看其他兄弟時光</a>'));
  assert.ok(!html.includes('id="start-live"'));
});

test('the duration fact and the first-time list carry hooks for route timings', () => {
  const html = render();
  const { duration } = readyActivity().facts;
  assert.ok(html.includes(`<li class="duration">${duration}</li>`), html.slice(0, 600));
  assert.ok(html.includes('<ol class="first-time">'));
});

test('a dated activity says when it is on right under its facts', () => {
  const activity = readyActivity();
  activity.availability = { from: '2027-10-01', to: '2027-10-31', label: '2027 年 10 月', note: '確切日期以學會公告為準' };
  const html = render({ activity });
  const head = html.slice(html.indexOf('<header class="activity-head">'), html.indexOf('</header>'));
  assert.ok(head.includes('<p class="availability">只限 2027 年 10 月：確切日期以學會公告為準</p>'), head);
  delete activity.availability.note;
  assert.ok(render({ activity }).includes('<p class="availability">只限 2027 年 10 月</p>'));
  assert.ok(!render().includes('class="availability"'));
});

test('extras can carry their own title and link a city-walk route', () => {
  const activity = readyActivity();
  activity.extraTitle = '加碼推薦（選配）';
  activity.extra30 = ['一起吃頓飯。', { text: '高雄北區：舊城護城河線，終點旁就是蓮池潭。', cityWalkRoute: '高雄北區' }];
  const html = render({ activity });
  assert.ok(html.includes('<summary>加碼推薦（選配）</summary>'));
  assert.ok(!html.includes('想多留 30 分鐘'));
  assert.ok(html.includes('<li>一起吃頓飯。</li>'));
  assert.ok(
    html.includes(
      `<li>高雄北區：舊城護城河線，終點旁就是蓮池潭。 <a href="../../a/city-walk/?d=${encodeURIComponent('高雄北區')}">看路線</a></li>`,
    ),
  );
});

test('the live-mode data leaves out the extras title too', () => {
  const activity = readyActivity();
  activity.extraTitle = '加碼推薦（選配）';
  assert.ok(!('extraTitle' in activityData(render({ activity }))));
});
