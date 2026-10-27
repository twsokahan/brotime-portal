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

test('the story card page shows the card front, title and a LINE share link', () => {
  const html = render();
  assert.ok(html.includes('src="../../../../cards/brunch/s1.webp"'));
  assert.ok(html.includes('<h1>測試用故事卡</h1>'));
  assert.ok(html.includes('https://line.me/R/share?text='));
});

test('the LINE link shares the full card page url', () => {
  const { lineUrl } = shareFallbacks('測試用故事卡', cardPageUrl(fixtureSite(), 'brunch', 's1'));
  assert.ok(render().includes(`<a href="${lineUrl}">分享到 LINE</a>`));
});

test('the story card page shows where to find the passage in the book instead of the passage', () => {
  const html = render();
  assert.ok(html.includes('<h2>翻書念故事</h2>'));
  assert.ok(html.includes('<p class="book-guide-series">《新・人間革命》</p>'));
  assert.ok(html.includes('<p class="book-guide-book">第16卷〈羽翼〉</p>'));
  assert.ok(html.includes('<p class="book-guide-page"><small>約第 </small>120<small> 頁</small></p>'));
  assert.ok(!html.includes('出處：'));
});

test('the book guide lists each reading step with its page, then how long it takes, then the tips', () => {
  const html = render();
  const rows = [
    '<div><dt>從</dt><dd>「測試用的開頭句」</dd></div>',
    '<div><dt>念到</dt><dd>「測試用的跳讀前一句」 <small>（約第 121 頁）</small></dd></div>',
    '<div><dt>跳到</dt><dd>「測試用的跳讀後一句」 <small>（約第 122 頁，接著念）</small></dd></div>',
    '<div><dt>再念到</dt><dd>「測試用的結尾句。」 <small>（約第 123 頁）</small></dd></div>',
    '<div><dt>多久</dt><dd>約 2 分鐘，中間跳一次</dd></div>',
  ];
  assert.ok(html.includes(`<dl class="book-guide-rows">\n${rows.join('\n')}\n</dl>`), html);
  assert.ok(
    html.includes('<ul class="book-guide-tips"><li>這是測試用的第一行提醒。</li><li>這是測試用的第二行提醒。</li></ul>'),
  );
});

test('the story card page links back to its activity and loads no script', () => {
  const html = render();
  assert.ok(html.includes('<a href="../../../../a/brunch/">← 回到兄弟早午餐會</a>'));
  assert.ok(!html.includes('<script'));
});

test('the book guide is escaped', () => {
  const activity = readyActivity();
  storyCard(activity).guide.steps[0].text = '「<b>粗體</b> & 其他」';
  storyCard(activity).guide.chapter = '<i>章</i>';
  const html = render(activity);
  assert.ok(html.includes('<dd>「&lt;b&gt;粗體&lt;/b&gt; &amp; 其他」</dd>'));
  assert.ok(html.includes('第16卷〈&lt;i&gt;章&lt;/i&gt;〉'));
});

test('the sharing questions come right after the title as a numbered list, before the book guide', () => {
  const html = render();
  assert.ok(
    html.includes(
      '<section class="story-questions">\n<h2>分享提問</h2>\n<ol>\n<li>這是測試用的第一個分享提問？</li>\n<li>這是測試用的第二個分享提問？</li>\n</ol>\n</section>',
    ),
    html,
  );
  assert.ok(html.indexOf('<h1>') < html.indexOf('分享提問'));
  assert.ok(html.indexOf('分享提問') < html.indexOf('翻書念故事'));
});

test('sharing questions are escaped', () => {
  const activity = readyActivity();
  storyCard(activity).questions = ['<i>你</i> & 我？'];
  assert.ok(render(activity).includes('<li>&lt;i&gt;你&lt;/i&gt; &amp; 我？</li>'));
});

test('a story card without sharing questions shows the note printed on its front under its own label', () => {
  const activity = readyActivity();
  delete storyCard(activity).questions;
  storyCard(activity).note = { label: '想一想', text: '這是測試用的卡片正面短文。' };
  const html = render(activity);
  assert.ok(
    html.includes('<section class="story-questions">\n<h2>想一想</h2>\n<p>這是測試用的卡片正面短文。</p>\n</section>'),
    html,
  );
  assert.ok(html.indexOf('想一想') < html.indexOf('翻書念故事'));
  assert.ok(!html.includes('分享提問'));
});

test('a card with both shows the sharing questions, then the note', () => {
  const activity = readyActivity();
  storyCard(activity).note = { label: '帶回家的一句', text: '這是測試用的卡片正面短文。' };
  const html = render(activity);
  assert.ok(html.indexOf('分享提問') < html.indexOf('<h2>帶回家的一句</h2>'), html);
});

test('the note is escaped', () => {
  const activity = readyActivity();
  delete storyCard(activity).questions;
  storyCard(activity).note = { label: '<b>想</b>', text: '「你」 & <i>我</i>' };
  const html = render(activity);
  assert.ok(html.includes('<h2>&lt;b&gt;想&lt;/b&gt;</h2>'));
  assert.ok(html.includes('<p>「你」 &amp; &lt;i&gt;我&lt;/i&gt;</p>'));
});
