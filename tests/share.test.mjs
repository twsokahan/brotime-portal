import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cardPageUrl, shareFallbacks } from '../src/lib/share.mjs';
import { fixtureSite } from './fixtures/activities.mjs';

test('a card page url is built from the site base url', () => {
  assert.equal(cardPageUrl(fixtureSite(), 'brunch', 's1'), 'https://cades.github.io/brotime-portal/a/brunch/cards/s1/');
});

test('without a share sheet, the card can still go to LINE or be copied', () => {
  const copyText = '戶田大學與市谷食堂 https://x/a/';
  assert.deepEqual(shareFallbacks('戶田大學與市谷食堂', 'https://x/a/'), {
    lineUrl: 'https://line.me/R/share?text=' + encodeURIComponent(copyText),
    copyText,
  });
});
