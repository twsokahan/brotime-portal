import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activityIndexScript, renderSessionMain, renderStatsMain } from '../src/render/stats.mjs';
import { readyActivity } from './fixtures/activities.mjs';

test('the stats page has no host link and ends with the account footer', () => {
  const html = renderStatsMain({ rel: '../' });
  assert.ok(html.includes('<h1>每一場的回顧</h1>'));
  assert.ok(!html.includes('hosts'));
  assert.ok(html.trimEnd().endsWith('<footer class="account-foot" hidden></footer>'));
});

test('the session page starts with a way back to the review list and ends with the account footer', () => {
  const html = renderSessionMain({ rel: '../../' });
  assert.ok(html.startsWith('<p class="home-link"><a class="review-back" href="../../stats/">← 每一場的回顧</a></p>'));
  assert.ok(html.trimEnd().endsWith('<footer class="account-foot" hidden></footer>'));
});

test('the activity index carries each id and cover and cannot close the script tag', () => {
  const html = activityIndexScript([{ ...readyActivity(), id: 'city-walk', name: '城市散步' }, { id: 'odd', name: '</script>', cardSets: {} }]);
  assert.ok(html.startsWith('<script type="application/json" id="activity-index">'));
  assert.equal(html.match(/<\/script>/g).length, 1);
  const json = html.replace(/^<script[^>]*>/, '').replace(/<\/script>$/, '');
  assert.deepEqual(JSON.parse(json), {
    城市散步: { id: 'city-walk', cover: 'cards/city-walk/s1-thumb.webp' },
    '</script>': { id: 'odd', cover: null },
  });
});
