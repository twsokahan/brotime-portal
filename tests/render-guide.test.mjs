import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderGuideMain } from '../src/render/guide.mjs';
import { guidePageUrl, shareFallbacks } from '../src/lib/share.mjs';
import { readyActivity, fixtureSite } from './fixtures/activities.mjs';

const REL = '../../../';

function withGuide() {
  return {
    ...readyActivity(),
    guide: {
      title: '第一次看球？看這張就夠',
      intro: '給沒看過球的朋友。',
      sections: [
        { heading: '一場怎麼打', items: ['一共九局。', '三出局換邊。'] },
        { heading: '帶什麼', items: ['雨衣 & 薄外套'] },
      ],
    },
  };
}

const render = (activity = withGuide()) => renderGuideMain({ activity, site: fixtureSite(), rel: REL });

test('the guide page shows its title, intro and every section as a heading with a list', () => {
  const html = render();
  assert.ok(html.includes('<h1>第一次看球？看這張就夠</h1>'));
  assert.ok(html.includes('<p class="guide-intro">給沒看過球的朋友。</p>'));
  assert.ok(html.includes('<h2>一場怎麼打</h2>\n<ul><li>一共九局。</li><li>三出局換邊。</li></ul>'));
  assert.ok(html.includes('<h2>帶什麼</h2>\n<ul><li>雨衣 &amp; 薄外套</li></ul>'));
});

test('the guide page says which activity it belongs to and can leave out the intro', () => {
  const activity = withGuide();
  delete activity.guide.intro;
  const html = render(activity);
  assert.ok(html.includes('<p class="guide-kicker">兄弟早午餐會・新手小抄</p>'));
  assert.ok(!html.includes('guide-intro'));
});

test('the guide page shares its own url on LINE, links back to the activity and loads no script', () => {
  const html = render();
  const { lineUrl } = shareFallbacks('第一次看球？看這張就夠', guidePageUrl(fixtureSite(), 'brunch'));
  assert.ok(html.includes(`<a href="${lineUrl}">分享到 LINE</a>`));
  assert.ok(html.includes('<a href="../../../a/brunch/">← 回到兄弟早午餐會</a>'));
  assert.ok(!html.includes('<script'));
});
