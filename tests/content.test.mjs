import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { contentErrors, readContent, renderPages } from '../scripts/build.mjs';

const CONTENT_DIR = fileURLToPath(new URL('../content/', import.meta.url));
const PUBLIC_DIR = fileURLToPath(new URL('../public/', import.meta.url));
const BROWSER_SCRIPT_DIRS = ['../src/client/', '../src/lib/'].map((dir) => new URL(dir, import.meta.url));
const OLD_EVENT_WORDING = [
  '開始活動',
  '活動結束',
  '舉辦',
  '回到活動頁',
  '這個活動',
  '活動前',
  '活動後',
  '活動最後',
  '活動回報表',
  '主辦',
];

test('the real content and public files pass validation', async () => {
  assert.deepEqual(contentErrors(await readContent(CONTENT_DIR), PUBLIC_DIR), []);
});

async function browserScripts() {
  const perDir = await Promise.all(
    BROWSER_SCRIPT_DIRS.map(async (dir) => {
      const names = await readdir(dir);
      return Promise.all(names.map(async (name) => [name, await readFile(new URL(name, dir), 'utf8')]));
    }),
  );
  return perDir.flat();
}

test('no page of the preview build or its browser scripts uses the old 活動／舉辦 wording', async () => {
  const pages = renderPages(await readContent(CONTENT_DIR), true);
  for (const [file, text] of [...pages, ...(await browserScripts())]) {
    for (const phrase of OLD_EVENT_WORDING) assert.ok(!text.includes(phrase), `${file} still says ${phrase}`);
  }
});

const SURVEY_FORM_ACTIVITY_NAMES = [
  '兄弟早午餐會',
  '河濱夜跑・單車',
  '桌遊之夜',
  '爸爸帶娃日',
  '城市散步',
  '職場人生對話',
  '男人的廚房',
  '新春拜年團',
  '田園烤肉會',
  '新春唱題會',
  '農事體驗日',
  '清晨登山',
  '釣魚聊天會',
  '師傅手藝教室',
  '露營星空夜',
  '巷口泡茶會',
  '名畫小旅行',
  '去創美走走',
  '來去打球啦',
  '看球就一起',
];

test("activity names match the survey forms' activity options character for character", async () => {
  const { activityFiles } = await readContent(CONTENT_DIR);
  const names = activityFiles
    .map(({ activity }) => activity)
    .sort((a, b) => a.order - b.order)
    .map((activity) => activity.name);
  assert.deepEqual(names, SURVEY_FORM_ACTIVITY_NAMES);
});
