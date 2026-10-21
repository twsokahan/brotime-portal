import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderCardMain } from '../src/render/card.mjs';
import { cardPageUrl, shareFallbacks } from '../src/lib/share.mjs';
import { readyActivity, fixtureSite } from './fixtures/activities.mjs';

const REL = '../../../../';

const storyCard = (activity) => activity.cardSets.story.cards[0];

function render(activity = readyActivity()) {
  return renderCardMain({ activity, card: storyCard(activity), site: fixtureSite(), rel: REL });
}

test('the story card page shows the card front, title, source and a LINE share link', () => {
  const html = render();
  assert.ok(html.includes('src="../../../../cards/brunch/s1.webp"'));
  assert.ok(html.includes('<h1>測試用故事卡</h1>'));
  assert.ok(html.includes('出處：《新・人間革命》第 16 卷〈羽翼〉'));
  assert.ok(html.includes('https://line.me/R/share?text='));
});

test('the LINE link shares the full card page url', () => {
  const { lineUrl } = shareFallbacks('測試用故事卡', cardPageUrl(fixtureSite(), 'brunch', 's1'));
  assert.ok(render().includes(`<a href="${lineUrl}">分享到 LINE</a>`));
});

test('each story paragraph becomes its own <p>', () => {
  const html = render();
  assert.equal(html.match(/<p[\s>]/g).length, 2);
  assert.ok(html.includes('<p>這是測試用的故事卡第一段，不是書裡的原文。</p>'));
  assert.ok(html.includes('<p>這是第二段，用來確認段落會分開顯示。</p>'));
});

test('the story card page links back to its activity and loads no script', () => {
  const html = render();
  assert.ok(html.includes('<a href="../../../../a/brunch/">← 回到兄弟早午餐會</a>'));
  assert.ok(!html.includes('<script'));
});

test('story text is escaped', () => {
  const activity = readyActivity();
  storyCard(activity).text = '<b>粗體</b> & 其他';
  const html = render(activity);
  assert.ok(html.includes('<p>&lt;b&gt;粗體&lt;/b&gt; &amp; 其他</p>'));
});

test('the sharing questions follow the source as a numbered list', () => {
  const html = render();
  assert.ok(
    html.includes(
      '<section class="story-questions">\n<h2>分享提問</h2>\n<ol>\n<li>這是測試用的第一個分享提問？</li>\n<li>這是測試用的第二個分享提問？</li>\n</ol>\n</section>',
    ),
    html,
  );
  assert.ok(html.indexOf('出處：') < html.indexOf('分享提問'));
});

test('sharing questions are escaped', () => {
  const activity = readyActivity();
  storyCard(activity).questions = ['<i>你</i> & 我？'];
  assert.ok(render(activity).includes('<li>&lt;i&gt;你&lt;/i&gt; &amp; 我？</li>'));
});
