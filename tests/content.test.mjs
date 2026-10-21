import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { contentErrors, readContent } from '../scripts/build.mjs';

const CONTENT_DIR = fileURLToPath(new URL('../content/', import.meta.url));
const PUBLIC_DIR = fileURLToPath(new URL('../public/', import.meta.url));

test('the real content and public files pass validation', async () => {
  assert.deepEqual(contentErrors(await readContent(CONTENT_DIR), PUBLIC_DIR), []);
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
  '家族辦桌拜年',
  '農事體驗日',
  '清晨登山',
  '釣魚聊天會',
  '師傅手藝教室',
  '露營星空夜',
  '巷口泡茶會',
];

test("activity names match the survey forms' activity options character for character", async () => {
  const { activityFiles } = await readContent(CONTENT_DIR);
  const names = activityFiles
    .map(({ activity }) => activity)
    .sort((a, b) => a.order - b.order)
    .map((activity) => activity.name);
  assert.deepEqual(names, SURVEY_FORM_ACTIVITY_NAMES);
});
