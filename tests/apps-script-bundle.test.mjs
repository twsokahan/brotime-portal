import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { buildAppsScript } from '../scripts/build-apps-script.mjs';

test('the bundle has no import or export lines and defines the Apps Script entry points', async () => {
  const outDir = await mkdtemp(path.join(tmpdir(), 'apps-script-'));
  try {
    await buildAppsScript({ outDir });
    const code = await readFile(path.join(outDir, 'Code.js'), 'utf8');
    assert.doesNotMatch(code, /^\s*(import|export)\s/m);
    assert.doesNotMatch(code, /Object\.hasOwn\(|\?\?=/, 'Apps Script V8 may not have these; local tests cannot tell');
    const context = {};
    vm.runInNewContext(code, context);
    for (const name of ['doPost', 'checkSetup', 'createSupplementSheet', 'handleRequest']) {
      assert.equal(typeof context[name], 'function', name);
    }
    assert.ok((await readdir(outDir)).includes('appsscript.json'));
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

test('the web app runs as the deployer, on Taiwan time, and anyone can call it', async () => {
  const manifest = JSON.parse(await readFile(new URL('../apps-script/appsscript.json', import.meta.url), 'utf8'));
  assert.deepEqual(manifest.webapp, { executeAs: 'USER_DEPLOYING', access: 'ANYONE_ANONYMOUS' });
  assert.equal(manifest.timeZone, 'Asia/Taipei');
});

test('no spreadsheet id is written into the Apps Script source', async () => {
  const dir = new URL('../apps-script/', import.meta.url);
  for (const name of await readdir(dir)) {
    if (!/\.(mjs|js|json)$/.test(name)) continue;
    assert.doesNotMatch(await readFile(new URL(name, dir), 'utf8'), /[A-Za-z0-9_-]{40,}/, name);
  }
});
