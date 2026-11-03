import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, renderPages, unsafeOutDirReason } from '../scripts/build.mjs';
import { fixtureSite, readyActivity } from './fixtures/activities.mjs';

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

test('entry, ready and preparing pages send LINE visitors to the phone browser, story card pages do not', async () => {
  const leavesLine = (html) => html.includes('openExternalBrowser') && html.includes('<div class="line-notice">');
  assert.ok(leavesLine(await read(production, 'index.html')));
  assert.ok(leavesLine(await read(production, 'a/brunch/index.html')));
  assert.ok(leavesLine(await read(production, 'a/night-run/index.html')));
  assert.ok(leavesLine(await read(preview, 'a/city-walk/index.html')));
  const cardPage = await read(production, 'a/brunch/cards/s1/index.html');
  assert.ok(!cardPage.includes('openExternalBrowser'));
  assert.ok(!cardPage.includes('line-notice'));
});

test('the home page loads the home script and points og:url at the site', async () => {
  const html = await read(production, 'index.html');
  assert.ok(html.includes('src="js/home.js"'));
  assert.ok(html.includes('<meta property="og:url" content="https://twsokahan.github.io/brotime-portal/">'));
});

test('the all page loads the entry script, leaves LINE and carries its own og:url', async () => {
  const html = await read(production, 'all/index.html');
  assert.ok(html.includes('src="../js/entry.js"'));
  assert.ok(html.includes('<link rel="stylesheet" href="../css/site.css">'));
  assert.ok(html.includes('<meta property="og:url" content="https://twsokahan.github.io/brotime-portal/all/">'));
  assert.ok(html.includes('<title>全部 3 種｜兄弟時光</title>'));
  assert.ok(html.includes('class="line-notice"'));
});

test('the all page shows a review activity as preparing in production and as ready in preview', async () => {
  const isCard = (html) => html.includes('<a class="act" data-id="city-walk"');
  const isPreparing = (html) => html.match(/<section class="preparing">.*?<\/section>/s)?.[0].includes('href="../a/city-walk/"') ?? false;
  const [productionEntry, previewEntry] = await Promise.all([read(production, 'all/index.html'), read(preview, 'all/index.html')]);
  assert.ok(isPreparing(productionEntry) && !isCard(productionEntry));
  assert.ok(isCard(previewEntry) && !isPreparing(previewEntry));
});

test('the entry page description avoids the words 活動 and 辦', async () => {
  const html = await read(production, 'index.html');
  assert.ok(html.includes('<meta name="description" content="下個月，約兄弟做什麼？3 種過兄弟時光的方式，回答 4 題幫你挑。">'));
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
  assert.deepEqual(pages, ['index.html', 'all/index.html']);
});

test('with nothing ready the all page loads no script', async () => {
  const contentDir = await tempDir();
  await cp(path.join(CONTENT_DIR, 'site.json'), path.join(contentDir, 'site.json'));
  const outDir = await tempDir();
  await build({ contentDir, publicDir: path.join(contentDir, 'missing'), outDir, preview: false });
  assert.ok(!(await read(outDir, 'all/index.html')).includes('<script type="module"'));
});

test('build returns the pages it wrote', async () => {
  const outDir = await tempDir();
  const { pages } = await build({ contentDir: CONTENT_DIR, publicDir: PUBLIC_DIR, outDir, preview: false });
  assert.deepEqual(pages.toSorted(), [
    'a/brunch/cards/s1/index.html',
    'a/brunch/index.html',
    'a/city-walk/index.html',
    'a/night-run/index.html',
    'all/index.html',
    'index.html',
  ]);
});

const ICHIBAN_PAGE = 'a/brunch/ichiban/index.html';

const withIchiban = (status) => ({ ...readyActivity(), status, ichiban: { grades: { A: 1, B: 2, C: 3, D: 4 } } });

const pagesFor = (activity, preview) =>
  new Map(renderPages({ site: fixtureSite(), routes: undefined, activityFiles: [{ fileName: 'brunch.json', activity }] }, preview));

test('a ready activity with an ichiban setting gets an ichiban page that loads its script and leaves LINE', () => {
  const html = pagesFor(withIchiban('ready'), false).get(ICHIBAN_PAGE);
  assert.ok(html, `expected ${ICHIBAN_PAGE}`);
  assert.ok(html.includes('<script type="module" src="../../../js/ichiban.js"></script>'));
  assert.ok(html.includes('openExternalBrowser') && html.includes('<div class="line-notice">'));
  assert.ok(html.includes('<title>電子一番賞｜兄弟早午餐會</title>'));
  assert.ok(html.includes('<meta property="og:url" content="https://cades.github.io/brotime-portal/a/brunch/ichiban/">'));
});

test('a review activity with an ichiban setting gets the ichiban page in preview only', () => {
  assert.ok(pagesFor(withIchiban('review'), true).has(ICHIBAN_PAGE));
  assert.ok(!pagesFor(withIchiban('review'), false).has(ICHIBAN_PAGE));
});

test('a ready activity without an ichiban setting gets no ichiban page', () => {
  assert.ok(!pagesFor(readyActivity(), false).has(ICHIBAN_PAGE));
});

const GUIDE_PAGE = 'a/brunch/guide/index.html';

const withGuide = (status) => ({
  ...readyActivity(),
  status,
  guide: { title: '第一次看球？看這張就夠', sections: [{ heading: '一場怎麼打', items: ['一共九局。'] }] },
});

test('a ready activity with a guide gets a guide page that stays in LINE and loads no script', () => {
  const html = pagesFor(withGuide('ready'), false).get(GUIDE_PAGE);
  assert.ok(html, `expected ${GUIDE_PAGE}`);
  assert.ok(html.includes('<title>第一次看球？看這張就夠｜兄弟早午餐會</title>'));
  assert.ok(html.includes('<meta property="og:url" content="https://cades.github.io/brotime-portal/a/brunch/guide/">'));
  assert.ok(html.includes('<link rel="stylesheet" href="../../../css/site.css">'));
  assert.ok(!html.includes('openExternalBrowser') && !html.includes('<script'));
});

test('a guide page is made only for a ready activity with a guide', () => {
  assert.ok(pagesFor(withGuide('review'), true).has(GUIDE_PAGE));
  assert.ok(!pagesFor(withGuide('review'), false).has(GUIDE_PAGE));
  assert.ok(!pagesFor(readyActivity(), false).has(GUIDE_PAGE));
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

const SIGN_IN = { clientId: 'test.apps.googleusercontent.com', endpoint: 'https://script.google.com/macros/s/test/exec' };
const SIGN_IN_PIECES = ['class="signin"', 'id="signin-config"', 'js/signin.js', 'signin-needed'];

function pagesWithEverything(site) {
  const activity = { ...withIchiban('ready'), guide: withGuide('ready').guide };
  const activityFiles = [
    { fileName: 'brunch.json', activity },
    { fileName: 'night-run.json', activity: { ...readyActivity(), id: 'night-run', name: '河濱夜跑・單車', status: 'preparing' } },
  ];
  return new Map(renderPages({ site, routes: undefined, activityFiles }, false));
}

test('with signIn, entry, all, activity, preparing and ichiban pages carry the sign-in panel; card and guide pages do not', () => {
  const pages = pagesWithEverything({ ...fixtureSite(), signIn: SIGN_IN });
  for (const file of ['index.html', 'all/index.html', 'a/brunch/index.html', 'a/night-run/index.html', ICHIBAN_PAGE]) {
    const html = pages.get(file);
    assert.ok(html, `expected ${file}`);
    for (const piece of SIGN_IN_PIECES) assert.ok(html.includes(piece), `${file} lacks ${piece}`);
  }
  const open = [...pages.keys()].filter((file) => file.includes('/cards/') || file === GUIDE_PAGE);
  assert.ok(open.includes(GUIDE_PAGE) && open.length > 1, JSON.stringify(open));
  for (const file of open) assert.ok(!pages.get(file).includes('signin'), file);
});

test('without signIn no page mentions sign-in', () => {
  for (const [file, html] of pagesWithEverything(fixtureSite())) assert.ok(!html.includes('signin'), file);
});

test('with signIn the stats pages are built behind sign-in and the home page loads the wants script', () => {
  const pages = pagesWithEverything({ ...fixtureSite(), signIn: SIGN_IN });
  for (const [file, script] of [['stats/index.html', 'js/stats.js'], ['stats/session/index.html', 'js/stats-session.js']]) {
    const html = pages.get(file);
    assert.ok(html, `expected ${file}`);
    for (const piece of [...SIGN_IN_PIECES, script, 'id="activity-ids"']) assert.ok(html.includes(piece), `${file} lacks ${piece}`);
  }
  const home = pages.get('index.html');
  assert.ok(home.includes('js/district-wants.js') && home.includes('id="activity-ids"'));
});

test('without signIn there are no stats pages', () => {
  const pages = pagesWithEverything(fixtureSite());
  assert.ok(!pages.has('stats/index.html') && !pages.has('stats/session/index.html'));
  assert.ok(!pages.get('index.html').includes('district-wants'));
});

test('with signIn the hosts page is built behind sign-in; without it there is none', () => {
  const html = pagesWithEverything({ ...fixtureSite(), signIn: SIGN_IN }).get('hosts/index.html');
  assert.ok(html, 'expected hosts/index.html');
  for (const piece of [...SIGN_IN_PIECES, 'js/hosts.js']) assert.ok(html.includes(piece), `hosts page lacks ${piece}`);
  assert.ok(!pagesWithEverything(fixtureSite()).has('hosts/index.html'));
});
