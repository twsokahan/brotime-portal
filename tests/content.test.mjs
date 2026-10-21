import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { contentErrors, readContent } from '../scripts/build.mjs';

const CONTENT_DIR = fileURLToPath(new URL('../content/', import.meta.url));
const PUBLIC_DIR = fileURLToPath(new URL('../public/', import.meta.url));

test('the real content and public files pass validation', async () => {
  assert.deepEqual(contentErrors(await readContent(CONTENT_DIR), PUBLIC_DIR), []);
});
