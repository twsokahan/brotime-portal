import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, unsafeOutDirReason } from '../scripts/build.mjs';

const FIXTURES = fileURLToPath(new URL('./fixtures/', import.meta.url));
const CONTENT_DIR = path.join(FIXTURES, 'content');
const PUBLIC_DIR = path.join(FIXTURES, 'public');

const tempDirs = [];

async function tempDir() {
  const dir = await mkdtemp(path.join(tmpdir(), 'brotime-build-'));
  tempDirs.push(dir);
  return dir;
}

async function buildFixture(options = {}) {
  const outDir = await tempDir();
  await build({ contentDir: CONTENT_DIR, publicDir: PUBLIC_DIR, outDir, preview: false, ...options });
  return outDir;
}

async function copyOf(dir) {
  const copy = await tempDir();
  await cp(dir, copy, { recursive: true });
  return copy;
}

const read = (outDir, file) => readFile(path.join(outDir, file), 'utf8');

async function htmlFiles(outDir) {
  const entries = await readdir(outDir, { recursive: true });
  return entries.filter((file) => file.endsWith('.html'));
}

function routesData(html) {
  const match = html.match(/<script type="application\/json" id="routes-data">([\s\S]*?)<\/script>/);
  return match && JSON.parse(match[1]);
}

let production;
let preview;

before(async () => {
  production = await buildFixture();
  preview = await buildFixture({ preview: true });
});

after(() => Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true }))));

test('production shows a review activity as preparing and a ready one with its start button', async () => {
  assert.ok((await read(production, 'a/city-walk/index.html')).includes('這一段還在準備中'));
  assert.ok((await read(production, 'a/brunch/index.html')).includes('開始 ▶'));
});

test('preview shows a review activity as a ready page', async () => {
  assert.ok((await read(preview, 'a/city-walk/index.html')).includes('開始 ▶'));
});

test('no page carries a preview banner', async () => {
  for (const outDir of [production, preview]) {
    for (const file of await htmlFiles(outDir)) {
      assert.ok(!(await read(outDir, file)).includes('預覽：這個活動還沒上線'), file);
    }
  }
});

test('ready activity pages load the activity script and preparing ones load no script', async () => {
  assert.ok((await read(production, 'a/brunch/index.html')).includes('src="../../js/activity.js"'));
  assert.ok(!(await read(production, 'a/night-run/index.html')).includes('<script type="module"'));
  assert.ok(!(await read(production, 'a/city-walk/index.html')).includes('<script type="module"'));
});

test('the entry page loads the entry script and points og:url at the site', async () => {
  const html = await read(production, 'index.html');
  assert.ok(html.includes('src="js/entry.js"'));
  assert.ok(html.includes('<meta property="og:url" content="https://twsokahan.github.io/brotime-portal/">'));
});

test('the entry page shows a review activity as preparing in production and as ready in preview', async () => {
  const isCard = (html) => html.includes('<a class="act" data-id="city-walk"');
  const isPreparing = (html) => html.match(/<section class="preparing">.*?<\/section>/s)?.[0].includes('href="a/city-walk/"') ?? false;
  const [productionEntry, previewEntry] = await Promise.all([read(production, 'index.html'), read(preview, 'index.html')]);
  assert.ok(isPreparing(productionEntry) && !isCard(productionEntry));
  assert.ok(isCard(previewEntry) && !isPreparing(previewEntry));
});

test('the entry page description avoids the words 活動 and 辦', async () => {
  const html = await read(production, 'index.html');
  assert.ok(html.includes('<meta name="description" content="下個月，約兄弟做什麼？16 種過兄弟時光的方式，回答 4 題幫你挑。">'));
});

test('activity pages carry their own og:url', async () => {
  const html = await read(production, 'a/brunch/index.html');
  assert.ok(html.includes('<meta property="og:url" content="https://twsokahan.github.io/brotime-portal/a/brunch/">'));
});

test('no generated page links or loads anything from the site root', async () => {
  for (const outDir of [production, preview]) {
    for (const file of await htmlFiles(outDir)) {
      assert.doesNotMatch(await read(outDir, file), /(href|src)="\//, file);
    }
  }
});

test('the stylesheet starts with the palette and the browser modules are copied', async () => {
  assert.ok((await read(production, 'css/site.css')).includes('--paper:'));
  assert.ok(existsSync(path.join(production, 'js/lib/live.mjs')));
});

test('public files and .nojekyll are copied as they are', () => {
  assert.ok(existsSync(path.join(production, 'cards/brunch/s1.webp')));
  assert.ok(existsSync(path.join(production, '.nojekyll')));
});

test('production makes story card pages for ready activities with an og:image', async () => {
  const html = await read(production, 'a/brunch/cards/s1/index.html');
  assert.match(html, /<meta property="og:image" content="[^"]*-og\.jpg">/);
  assert.ok(html.includes('<meta property="og:url" content="https://twsokahan.github.io/brotime-portal/a/brunch/cards/s1/">'));
  assert.ok(html.includes('<title>測試用故事卡</title>'));
});

test('production makes no card pages for a review activity, preview does', () => {
  assert.ok(!existsSync(path.join(production, 'a/city-walk/cards')));
  assert.ok(existsSync(path.join(preview, 'a/city-walk/cards/A/index.html')));
});

test('route data is embedded only when the city-walk page renders as ready', async () => {
  assert.equal(routesData(await read(production, 'a/city-walk/index.html')), null);
  const routes = routesData(await read(preview, 'a/city-walk/index.html'));
  assert.deepEqual(
    routes.map((route) => route.district),
    ['測試區'],
  );
  assert.equal(routesData(await read(preview, 'a/brunch/index.html')), null);
});

test('build rejects when a card image is missing and names the missing file', async () => {
  const publicDir = await copyOf(PUBLIC_DIR);
  await rm(path.join(publicDir, 'cards/brunch/t05-thumb.webp'));
  await assert.rejects(buildFixture({ publicDir }), /cards\/brunch\/t05-thumb\.webp/);
});

test('build reports every validation error, one per line', async () => {
  const publicDir = await copyOf(PUBLIC_DIR);
  await rm(path.join(publicDir, 'cards/brunch/t05-thumb.webp'));
  await rm(path.join(publicDir, 'cards/city-walk/A-og.jpg'));
  await assert.rejects(buildFixture({ publicDir }), (error) => {
    const lines = error.message.split('\n');
    assert.ok(lines.some((line) => line.includes('cards/brunch/t05-thumb.webp')));
    assert.ok(lines.some((line) => line.includes('cards/city-walk/A-og.jpg')));
    return true;
  });
});

test('build rejects an activity whose file name is not its id', async () => {
  const contentDir = await copyOf(CONTENT_DIR);
  await rename(path.join(contentDir, 'activities/brunch.json'), path.join(contentDir, 'activities/brunch-copy.json'));
  await assert.rejects(buildFixture({ contentDir }), /brunch-copy\.json/);
});

test('build rejects malformed JSON and names the file', async () => {
  const contentDir = await copyOf(CONTENT_DIR);
  await writeFile(path.join(contentDir, 'activities/broken.json'), '{ "id": ');
  await assert.rejects(buildFixture({ contentDir }), /broken\.json/);
});

test('a failed build leaves the previous output in place', async () => {
  const outDir = await buildFixture();
  const publicDir = await copyOf(PUBLIC_DIR);
  await rm(path.join(publicDir, 'cards/brunch/s1-og.jpg'));
  await assert.rejects(build({ contentDir: CONTENT_DIR, publicDir, outDir, preview: false }));
  assert.ok(existsSync(path.join(outDir, 'index.html')));
});

test('build works without a public folder, activities or routes', async () => {
  const contentDir = await tempDir();
  await cp(path.join(CONTENT_DIR, 'site.json'), path.join(contentDir, 'site.json'));
  const outDir = await tempDir();
  const { pages } = await build({ contentDir, publicDir: path.join(contentDir, 'missing'), outDir, preview: false });
  assert.deepEqual(pages, ['index.html']);
});

test('build returns the pages it wrote', async () => {
  const outDir = await tempDir();
  const { pages } = await build({ contentDir: CONTENT_DIR, publicDir: PUBLIC_DIR, outDir, preview: false });
  assert.deepEqual(pages.toSorted(), [
    'a/brunch/cards/s1/index.html',
    'a/brunch/index.html',
    'a/city-walk/index.html',
    'a/night-run/index.html',
    'index.html',
  ]);
});

const PLACES = { repoRoot: '/work/brotime-portal', cwd: '/work/brotime-portal', home: '/Users/me' };

test('the output folder may not be the repo, the home folder, the filesystem root or above the working folder', () => {
  for (const outDir of ['/', '/work', '/work/brotime-portal', '/Users/me']) {
    assert.ok(unsafeOutDirReason(outDir, PLACES), outDir);
  }
});

test('an output folder inside the repo or elsewhere is allowed', () => {
  for (const outDir of ['/work/brotime-portal/dist', '/tmp/out', '/Users/me/site']) {
    assert.equal(unsafeOutDirReason(outDir, PLACES), null, outDir);
  }
});
