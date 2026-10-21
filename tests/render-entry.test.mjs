import { test } from 'node:test';
import assert from 'node:assert/strict';
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
  return page({ title: '兄弟時光', description: '下個月辦什麼？', rel: '', main: '<p>內容</p>', scripts: [], ...overrides });
}

test('the wall has one card per activity and a badge on each preparing card', () => {
  const html = renderEntryMain({ activities: sixteenActivities(), rel: '' });
  assert.equal(occurrences(html, 'class="act'), 16);
  assert.equal(occurrences(html, '準備中'), 13);
  assert.equal(occurrences(html, 'class="act is-preparing"'), 13);
});

test('the match count starts at the number of ready activities', () => {
  const html = renderEntryMain({ activities: sixteenActivities(), rel: '' });
  assert.ok(html.includes('<p id="match-count">符合的有 3 個</p>'));
});

test('cards follow the activity order and link to the activity page', () => {
  const html = renderEntryMain({ activities: sixteenActivities().reverse(), rel: '' });
  const ids = [...html.matchAll(/<a class="act[^"]*" data-id="([^"]+)"/g)].map(([, id]) => id);
  assert.deepEqual(ids, sixteenActivities().map(({ id }) => id));
  assert.ok(html.includes('<a class="act" data-id="brunch-1" href="a/brunch-1/">'));
});

test('only ready cards show the rain label', () => {
  const html = renderEntryMain({ activities: sixteenActivities(), rel: '' });
  assert.equal(occurrences(html, '<span class="tag rain">下雨也能辦</span>'), READY_COUNT);
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

test('og:image is present only when an image is given', () => {
  assert.ok(layout({ ogImage: 'https://x/y.jpg' }).includes('property="og:image" content="https://x/y.jpg"'));
  assert.ok(!layout().includes('og:image'));
});

test('og:title is escaped', () => {
  assert.ok(layout({ title: '"兄弟" & <時光>' }).includes('property="og:title" content="&quot;兄弟&quot; &amp; &lt;時光&gt;"'));
});
