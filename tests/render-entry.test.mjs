import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { page } from '../src/render/layout.mjs';
import { renderEntryMain } from '../src/render/entry.mjs';
import { readyActivity, preparingActivity } from './fixtures/activities.mjs';

const READY_COUNT = 3;

function sixteenActivities() {
  return Array.from({ length: 16 }, (_, index) => {
    const base = index < READY_COUNT ? readyActivity() : preparingActivity();
    return { ...base, id: `${base.id}-${index + 1}`, order: index + 1 };
  });
}

const occurrences = (text, needle) => text.split(needle).length - 1;

function activitiesData(html) {
  const [, json] = html.match(/<script type="application\/json" id="activities-data">(.*?)<\/script>/s);
  return JSON.parse(json);
}

function layout(overrides = {}) {
  return page({ title: '兄弟時光', description: '下個月，約兄弟做什麼？', rel: '', main: '<p>內容</p>', scripts: [], ...overrides });
}

const wallIds = (html) => [...html.matchAll(/<a class="act[^"]*" data-id="([^"]+)"/g)].map(([, id]) => id);

function preparingSection(html) {
  return html.match(/<section class="preparing">.*?<\/section>/s)?.[0] ?? '';
}

test('ready activities are image cards and preparing ones are names in one list at the bottom', () => {
  const html = renderEntryMain({ activities: sixteenActivities(), rel: '' });
  assert.equal(occurrences(html, 'class="act"'), READY_COUNT);
  assert.equal(occurrences(html, '準備中'), 1);
  const preparing = preparingSection(html);
  assert.equal(occurrences(preparing, '<a href="a/night-run-'), 16 - READY_COUNT);
  assert.ok(preparing.includes('<a href="a/night-run-4/">河濱夜跑・單車</a>'));
  assert.ok(html.indexOf('<section class="wall">') < html.indexOf('<section class="preparing">'));
});

test('the match line starts at the number of ready activities', () => {
  const html = renderEntryMain({ activities: sixteenActivities(), rel: '' });
  assert.ok(html.includes('<p id="match-count">符合的有 3 種</p>'));
});

test('cards follow the activity order and link to the activity page', () => {
  const html = renderEntryMain({ activities: sixteenActivities().reverse(), rel: '' });
  assert.deepEqual(wallIds(html), ['brunch-1', 'brunch-2', 'brunch-3']);
  assert.ok(html.includes('<a class="act" data-id="brunch-1" href="a/brunch-1/">'));
  const preparingIds = [...preparingSection(html).matchAll(/href="a\/([^/]+)\/"/g)].map(([, id]) => id);
  assert.deepEqual(preparingIds, sixteenActivities().slice(READY_COUNT).map(({ id }) => id));
});

test('a card shows the first story card as a decorative cover, its name and its interests', () => {
  const html = renderEntryMain({ activities: sixteenActivities(), rel: '' });
  assert.ok(html.includes('<img src="cards/brunch-1/s1-thumb.webp" alt="" loading="lazy">'));
  assert.ok(html.includes('<h2>兄弟早午餐會</h2>'));
  assert.ok(html.includes('<p class="interests">吃・聊</p>'));
});

test('the cover is the story set\'s first thumbs card when thumbs is set', () => {
  const activity = readyActivity();
  activity.cardSets.story.cards.push({ ...activity.cardSets.story.cards[0], id: 's2' });
  activity.cardSets.story.thumbs = ['s2'];
  const html = renderEntryMain({ activities: [activity], rel: '' });
  assert.ok(html.includes('src="cards/brunch/s2-thumb.webp"'));
});

test('with nothing ready the wall is a friendly line instead of an empty grid', () => {
  const activities = sixteenActivities().map((activity) => ({ ...activity, status: 'preparing' }));
  const html = renderEntryMain({ activities, rel: '' });
  assert.ok(!html.includes('<section class="wall">'));
  assert.ok(html.includes('<p class="wall-empty">每一種都還在準備，做好就會出現在這裡。</p>'));
  assert.equal(occurrences(preparingSection(html), '<a href='), 16);
});

test('with nothing ready there is nothing to pick from, so the quiz and filter buttons are left out', () => {
  const activities = sixteenActivities().map((activity) => ({ ...activity, status: 'preparing' }));
  const html = renderEntryMain({ activities, rel: '' });
  assert.ok(html.includes('<h1>下個月，<span>約兄弟做什麼？</span></h1>'));
  for (const part of ['class="entry-actions"', 'id="open-quiz"', 'id="toggle-filters"', 'id="filters"']) {
    assert.ok(!html.includes(part), `expected no ${part}`);
  }
  assert.ok(html.includes('<p class="wall-empty">'));
  assert.ok(html.includes('<section class="preparing">'));
});

test('filters sit in a folded panel behind one button', () => {
  const html = renderEntryMain({ activities: sixteenActivities(), rel: '' });
  assert.ok(html.includes('<button id="toggle-filters" type="button" aria-expanded="false" aria-controls="filters">'));
  assert.ok(html.includes('<section id="filters" class="filters" hidden>'));
  assert.equal(occurrences(html, 'aria-pressed="false"'), 3 + 4 + 5 + 1);
});

test('the entry page and its quiz avoid the words 活動 and 辦', async () => {
  const html = renderEntryMain({ activities: sixteenActivities(), rel: '' });
  assert.doesNotMatch(html, /活動|辦/, 'entry page');
  const script = await readFile(new URL('../src/client/entry.js', import.meta.url), 'utf8');
  assert.doesNotMatch(script, /活動|辦/, 'src/client/entry.js');
});

test('activities-data holds only id, name, status, order and tags', () => {
  const data = activitiesData(renderEntryMain({ activities: sixteenActivities(), rel: '' }));
  assert.equal(data.length, 16);
  for (const activity of data) {
    assert.deepEqual(Object.keys(activity).sort(), ['id', 'name', 'order', 'status', 'tags']);
  }
});

test('activity text is escaped on the wall', () => {
  const activity = readyActivity();
  activity.name = '<b>早午餐</b> & 聊天';
  const html = renderEntryMain({ activities: [activity], rel: '' });
  assert.ok(html.includes('&lt;b&gt;早午餐&lt;/b&gt; &amp; 聊天'));
  assert.ok(!html.includes('<b>早午餐</b>'));
});

test('the layout uses the page language, relative stylesheet and module scripts', () => {
  const html = layout({ rel: '../../', scripts: ['js/activity.js'] });
  assert.ok(html.includes('lang="zh-Hant-TW"'));
  assert.ok(html.includes('href="../../css/site.css"'));
  assert.ok(html.includes('<script type="module" src="../../js/activity.js"></script>'));
});

const LINE_NOTICE_TEXT = '用手機瀏覽器開比較順：點右上角「⋯」，選「用預設瀏覽器開啟」。';

test('with leaveLine, the head starts with the LINE script and the body starts with the hidden notice', () => {
  const html = layout({ leaveLine: true });
  const head = html.match(/<head>([\s\S]*?)<\/head>/)[1];
  assert.ok(head.indexOf('openExternalBrowser') < head.indexOf('<link'), 'script runs before any stylesheet or font');
  assert.ok(head.includes('<script>(function leaveLine'));
  assert.ok(html.includes(`<body>\n<div class="line-notice">\n<p>${LINE_NOTICE_TEXT}</p>\n<button type="button">知道了</button>\n</div>\n<main>`));
});

test('without leaveLine, the page has no LINE script or notice', () => {
  const html = layout();
  assert.ok(!html.includes('openExternalBrowser'));
  assert.ok(!html.includes('line-notice'));
});

test('og:image is present only when an image is given', () => {
  assert.ok(layout({ ogImage: 'https://x/y.jpg' }).includes('property="og:image" content="https://x/y.jpg"'));
  assert.ok(!layout().includes('og:image'));
});

test('og:title is escaped', () => {
  assert.ok(layout({ title: '"兄弟" & <時光>' }).includes('property="og:title" content="&quot;兄弟&quot; &amp; &lt;時光&gt;"'));
});

test('the lead counts every way to spend the time, ready or not', () => {
  const html = renderEntryMain({ activities: sixteenActivities().slice(0, 5), rel: '' });
  assert.ok(html.includes('<p class="lead">5 種過兄弟時光的方式，回答 4 題幫你挑，或往下自己逛。</p>'));
});

test('a dated card says when it is on, and the quiz data carries its dates', () => {
  const activities = sixteenActivities();
  activities[0].availability = { from: '2027-10-01', to: '2027-10-31', label: '2027 年 10 月' };
  const html = renderEntryMain({ activities, rel: '' });
  const card = html.slice(html.indexOf(`data-id="${activities[0].id}"`), html.indexOf('</a>', html.indexOf(`data-id="${activities[0].id}"`)));
  assert.ok(card.includes('<span class="badge">限 2027 年 10 月</span>'), card);
  assert.equal(occurrences(html, 'class="badge"'), 1);
  const [dated] = activitiesData(html);
  assert.deepEqual(dated.availability, activities[0].availability);
});
