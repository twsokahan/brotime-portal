import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

const MARKER = 'twsokahan-watermark';
const PUBLIC = new URL('../public/', import.meta.url);
const { enabled } = JSON.parse(readFileSync(new URL('../tools/watermark.json', import.meta.url), 'utf8'));
const skip = !enabled && 'tools/watermark.json 已關閉浮水印';

const filesUnder = (dir) => readdirSync(new URL(dir, PUBLIC), { recursive: true }).map((name) => `${dir}${name}`);
const unmarked = (paths) => paths.filter((path) => !readFileSync(new URL(path, PUBLIC)).includes(MARKER));

test('card images carry the watermark until the site goes public', { skip }, () => {
  const images = filesUnder('cards/').filter((path) => /\.(webp|jpg)$/.test(path));
  assert.ok(images.length > 0);
  assert.deepEqual(unmarked(images), [], '這些卡片圖沒有浮水印，請用 tools/cards.py 重產');
});

test('downloadable card PDFs carry the watermark until the site goes public', { skip }, () => {
  const pdfs = filesUnder('files/').filter((path) => path.endsWith('.pdf') && !path.endsWith('-plan.pdf'));
  assert.ok(pdfs.length > 0);
  assert.deepEqual(
    unmarked(pdfs),
    [],
    '這些卡片 PDF 沒有浮水印，請用 python3 ~/code/sokahan-propalsal-2026/plan-builder/watermark.py 來源 public/files/<檔名> 放進來',
  );
});
