import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const css = await readFile(new URL('../src/styles/site.css', import.meta.url), 'utf8');

const rule = (selector) => {
  const match = css.match(new RegExp(`^${selector.replace(/\./g, '\\.')} \\{([^}]*)\\}`, 'm'));
  assert.ok(match, `expected a ${selector} rule`);
  return match[1];
};

test('flow thumbnails keep their own shape when a short card shares a row with tall ones', () => {
  assert.match(rule('.thumbs'), /align-items: flex-start;/);
});
