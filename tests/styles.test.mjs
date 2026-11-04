import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const css = await readFile(new URL('../src/styles/site.css', import.meta.url), 'utf8');

const rule = (selector) => {
  const match = css.match(new RegExp(`^${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\{([^}]*)\\}`, 'm'));
  assert.ok(match, `expected a ${selector} rule`);
  return match[1];
};

test('the start button stays at the bottom of the screen and the page leaves room for it', () => {
  assert.match(rule('.start'), /position: fixed;[\s\S]*bottom: 0;/);
  assert.match(rule('main:has(> .start)'), /padding-bottom:/);
});

test('flow thumbnails keep their own shape when a short card shares a row with tall ones', () => {
  assert.match(rule('.thumbs'), /align-items: flex-start;/);
});

test('pages behind sign-in hide their content until the panel lets them through', () => {
  assert.match(rule('html.signin-needed main'), /display: none;/);
  assert.match(rule('html.signin-needed .signin'), /display: block;/);
});

test('answer dots use the theme colours: deep, light and hollow', () => {
  assert.match(rule('.dot-0'), /background: var\(--step4\);/);
  assert.match(rule('.dot-1'), /background: var\(--dot-mid\);/);
  assert.match(rule('.dot-2'), /background: transparent;[\s\S]*border:/);
});

test('the sample review card is drawn with a dashed outline', () => {
  assert.match(rule('.review-card.is-sample'), /border-style: dashed;/);
});
