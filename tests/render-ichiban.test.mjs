import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderIchibanMain } from '../src/render/ichiban.mjs';
import { readyActivity } from './fixtures/activities.mjs';

const REL = '../../../';
const GRADES = { A: 1, B: 2, C: 3, D: 4 };

const ichibanActivity = () => ({ ...readyActivity(), ichiban: { grades: { ...GRADES } } });

const render = (activity = ichibanActivity()) => renderIchibanMain({ activity, rel: REL });

function ichibanData(html) {
  const match = html.match(/<script type="application\/json" id="ichiban-data">([\s\S]*?)<\/script>/);
  assert.ok(match, 'expected the ichiban-data script');
  return JSON.parse(match[1]);
}

test('the ichiban page has a spot for the app, a line for browsers without scripts and a link back', () => {
  const html = render();
  assert.ok(html.includes('<div id="ichiban-app"></div>'));
  assert.match(html, /<noscript>.+<\/noscript>/);
  assert.ok(html.includes('<div class="back"><a href="../../../a/brunch/">← 回到兄弟早午餐會</a></div>'));
});

test('the page data carries the activity id, its name and the default counts', () => {
  assert.deepEqual(ichibanData(render()), { activityId: 'brunch', name: '兄弟早午餐會', defaults: GRADES });
});

test('the activity name is escaped in the back link and in the page data', () => {
  const activity = ichibanActivity();
  activity.name = '<b>兄弟</b> & 早午餐';
  const html = render(activity);
  assert.ok(html.includes('← 回到&lt;b&gt;兄弟&lt;/b&gt; &amp; 早午餐</a>'));
  assert.ok(!html.includes('<b>'));
  assert.equal(ichibanData(html).name, '<b>兄弟</b> & 早午餐');
});
