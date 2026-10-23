import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { paletteCss } from '../src/lib/palette.mjs';
import { validateAll } from '../src/lib/schema.mjs';
import { cardPageUrl } from '../src/lib/share.mjs';
import { renderActivityMain, renderPreparingMain } from '../src/render/activity.mjs';
import { renderCardMain } from '../src/render/card.mjs';
import { renderEntryMain } from '../src/render/entry.mjs';
import { jsonForScript } from '../src/render/html.mjs';
import { renderIchibanMain } from '../src/render/ichiban.mjs';
import { page } from '../src/render/layout.mjs';

const REPO_ROOT = fileURLToPath(new URL('../', import.meta.url));
const LIB_DIR = path.join(REPO_ROOT, 'src/lib');
const CLIENT_DIR = path.join(REPO_ROOT, 'src/client');
const STYLESHEET = path.join(REPO_ROOT, 'src/styles/site.css');

const CITY_WALK_ID = 'city-walk';
const entryDescription = (count) => `下個月，約兄弟做什麼？${count} 種過兄弟時光的方式，回答 4 題幫你挑。`;
const ICHIBAN_DESCRIPTION = '填好 A～D 賞各幾份，手機傳下去，每人選一張登機證撕開。';
const ENTRY_REL = '';
const ACTIVITY_REL = '../../';
const ICHIBAN_REL = '../../../';
const CARD_REL = '../../../../';

async function readJson(file, { optional = false } = {}) {
  let text;
  try {
    text = await readFile(file, 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    if (optional) return { value: undefined };
    return { error: `${file}: 找不到檔案` };
  }
  try {
    return { value: JSON.parse(text) };
  } catch (error) {
    return { error: `${file}: 不是正確的 JSON（${error.message}）` };
  }
}

async function activityFileNames(activitiesDir) {
  if (!existsSync(activitiesDir)) return [];
  const names = await readdir(activitiesDir);
  return names.filter((name) => name.endsWith('.json')).sort();
}

export async function readContent(contentDir) {
  const activitiesDir = path.join(contentDir, 'activities');
  const fileNames = await activityFileNames(activitiesDir);
  const [site, routes, ...activities] = await Promise.all([
    readJson(path.join(contentDir, 'site.json')),
    readJson(path.join(contentDir, 'city-walk/routes.json'), { optional: true }),
    ...fileNames.map((fileName) => readJson(path.join(activitiesDir, fileName))),
  ]);
  const unreadable = [site, routes, ...activities].flatMap(({ error }) => (error ? [error] : []));
  if (unreadable.length) throw new Error(unreadable.join('\n'));
  return {
    site: site.value,
    routes: routes.value,
    activityFiles: fileNames.map((fileName, i) => ({ fileName, activity: activities[i].value })),
  };
}

function fileNameError({ fileName, activity }) {
  const expectedId = path.basename(fileName, '.json');
  if (activity?.id === expectedId) return [];
  return [`activities/${fileName}: id 是 ${activity?.id ?? '空的'}，要跟檔名 ${expectedId} 一樣`];
}

export function contentErrors({ site, routes, activityFiles }, publicDir) {
  const activities = activityFiles.map(({ activity }) => activity);
  const fileExists = (file) => existsSync(path.join(publicDir, file));
  return [...activityFiles.flatMap(fileNameError), ...validateAll({ activities, site, routes }, { fileExists })];
}

const shownStatus = (status, preview) => (status === 'review' ? (preview ? 'ready' : 'preparing') : status);

function isSameOrInside(dir, other) {
  const relative = path.relative(dir, other);
  const goesUp = relative === '..' || relative.startsWith(`..${path.sep}`);
  return !goesUp && !path.isAbsolute(relative);
}

export function unsafeOutDirReason(outDir, { repoRoot, cwd, home }) {
  if (outDir === path.parse(outDir).root) return '檔案系統的根目錄';
  if (outDir === home) return '家目錄';
  if (isSameOrInside(outDir, repoRoot)) return '專案資料夾或它的上層';
  if (isSameOrInside(outDir, cwd)) return '目前所在的資料夾或它的上層';
  return null;
}

function realPath(dir) {
  const resolved = path.resolve(dir);
  return existsSync(resolved) ? realpathSync(resolved) : resolved;
}

async function clearOutDir(outDir) {
  const target = realPath(outDir);
  const reason = unsafeOutDirReason(target, {
    repoRoot: realPath(REPO_ROOT),
    cwd: realPath(process.cwd()),
    home: realPath(homedir()),
  });
  if (reason) throw new Error(`不能把輸出資料夾設成 ${target}：這是${reason}，清空它會刪掉不該刪的檔案`);
  await rm(target, { recursive: true, force: true });
  await mkdir(target, { recursive: true });
}

async function copyIfPresent(from, to) {
  if (existsSync(from)) await cp(from, to, { recursive: true });
}

const storyCardsOf = (activity) =>
  Object.values(activity.cardSets)
    .filter((set) => set.kind === 'story')
    .flatMap((set) => set.cards);

const routesScript = (routes) =>
  `<script type="application/json" id="routes-data">${jsonForScript(routes ?? [])}</script>`;

function readyActivityPage({ activity, site, routes, ogUrl }) {
  const main = renderActivityMain({ activity, site, rel: ACTIVITY_REL });
  return page({
    title: activity.name,
    description: activity.tagline,
    rel: ACTIVITY_REL,
    main: activity.id === CITY_WALK_ID ? `${main}\n${routesScript(routes)}` : main,
    scripts: ['js/activity.js'],
    ogUrl,
    leaveLine: true,
  });
}

function preparingActivityPage({ activity, ogUrl }) {
  return page({
    title: activity.name,
    description: activity.tagline,
    rel: ACTIVITY_REL,
    main: renderPreparingMain({ activity, rel: ACTIVITY_REL }),
    scripts: [],
    ogUrl,
    leaveLine: true,
  });
}

function cardPage({ activity, card, site }) {
  return page({
    title: card.title,
    description: `出處：${card.source}`,
    rel: CARD_REL,
    main: renderCardMain({ activity, card, site, rel: CARD_REL }),
    scripts: [],
    ogUrl: cardPageUrl(site, activity.id, card.id),
    ogImage: `${site.baseUrl}cards/${activity.id}/${card.id}-og.jpg`,
  });
}

function ichibanPage({ activity, ogUrl }) {
  return page({
    title: `電子一番賞｜${activity.name}`,
    description: ICHIBAN_DESCRIPTION,
    rel: ICHIBAN_REL,
    main: renderIchibanMain({ activity, rel: ICHIBAN_REL }),
    scripts: ['js/ichiban.js'],
    ogUrl,
    leaveLine: true,
  });
}

export function renderPages({ site, routes, activityFiles }, preview) {
  const activities = activityFiles.map(({ activity }) => ({
    ...activity,
    status: shownStatus(activity.status, preview),
  }));
  const pages = [
    [
      'index.html',
      page({
        title: site.title,
        description: entryDescription(activities.length),
        rel: ENTRY_REL,
        main: renderEntryMain({ activities, rel: ENTRY_REL }),
        scripts: activities.some((activity) => activity.status === 'ready') ? ['js/entry.js'] : [],
        ogUrl: site.baseUrl,
        leaveLine: true,
      }),
    ],
  ];
  for (const activity of activities) {
    const dir = `a/${activity.id}`;
    const ogUrl = `${site.baseUrl}${dir}/`;
    if (activity.status !== 'ready') {
      pages.push([`${dir}/index.html`, preparingActivityPage({ activity, ogUrl })]);
      continue;
    }
    pages.push([`${dir}/index.html`, readyActivityPage({ activity, site, routes, ogUrl })]);
    for (const card of storyCardsOf(activity)) {
      pages.push([`${dir}/cards/${card.id}/index.html`, cardPage({ activity, card, site })]);
    }
    if (activity.ichiban) {
      pages.push([`${dir}/ichiban/index.html`, ichibanPage({ activity, ogUrl: `${ogUrl}ichiban/` })]);
    }
  }
  return pages;
}

async function writeOutput(outDir, file, contents) {
  const target = path.join(outDir, file);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, contents);
}

export async function build({ contentDir = 'content', publicDir = 'public', outDir = 'dist', preview = false } = {}) {
  const content = await readContent(contentDir);
  const errors = contentErrors(content, publicDir);
  if (errors.length) throw new Error(errors.join('\n'));
  const pages = renderPages(content, preview);

  await clearOutDir(outDir);
  await copyIfPresent(publicDir, outDir);
  await copyIfPresent(LIB_DIR, path.join(outDir, 'js/lib'));
  await copyIfPresent(CLIENT_DIR, path.join(outDir, 'js'));
  await writeOutput(outDir, 'css/site.css', `${paletteCss()}\n${await readFile(STYLESHEET, 'utf8')}`);
  await writeOutput(outDir, '.nojekyll', '');
  for (const [file, html] of pages) await writeOutput(outDir, file, html);

  return { pages: pages.map(([file]) => file) };
}

const CLI_OPTIONS = {
  preview: { type: 'boolean', default: false },
  out: { type: 'string' },
  content: { type: 'string', default: 'content' },
  public: { type: 'string', default: 'public' },
};

async function main() {
  try {
    const { values } = parseArgs({ options: CLI_OPTIONS });
    const outDir = values.out ?? (values.preview ? 'dist-preview' : 'dist');
    const { pages } = await build({ contentDir: values.content, publicDir: values.public, outDir, preview: values.preview });
    console.log(`已產生 ${pages.length} 頁到 ${outDir}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

if (import.meta.main) await main();
