import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activityIdsScript, renderHostsMain, renderSessionMain, renderStatsMain } from '../src/render/stats.mjs';

test('the stats page links to adding a host and back home', () => {
  const html = renderStatsMain({ rel: '../' });
  assert.ok(html.includes('<h1>每一場的回顧</h1>'));
  assert.ok(html.includes('href="../hosts/"'));
  assert.ok(html.includes('href="../"'));
});

test('the session page links back to the stats list', () => {
  assert.ok(renderSessionMain({ rel: '../../' }).includes('href="../../stats/"'));
});

test('activity ids are embedded as name to id and cannot close the script tag', () => {
  const html = activityIdsScript([{ id: 'city-walk', name: '城市散步' }, { id: 'odd', name: '</script>' }]);
  assert.ok(html.startsWith('<script type="application/json" id="activity-ids">'));
  assert.equal(html.match(/<\/script>/g).length, 1);
  const json = html.replace(/^<script[^>]*>/, '').replace(/<\/script>$/, '');
  assert.deepEqual(JSON.parse(json), { 城市散步: 'city-walk', '</script>': 'odd' });
});

test('the hosts page has an email field, an optional name and a way back to the stats list', () => {
  const html = renderHostsMain({ rel: '../' });
  assert.ok(html.includes('<h1>加一位主持人</h1>'));
  assert.ok(html.includes('type="email" name="email"'));
  assert.ok(html.includes('name="name"'));
  assert.ok(html.includes('href="../stats/"'));
});
