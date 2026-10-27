import { test } from 'node:test';
import assert from 'node:assert/strict';
import { booksPacked, booksToBring, bringVolume, guideRows } from '../src/lib/book-guide.mjs';

const card = (volume, chapter) => ({ guide: { volume, chapter } });

test('a card says which volume to bring', () => {
  assert.equal(bringVolume({ volume: '第30卷(下)', chapter: '勝利歡呼' }), '要帶第30卷(下)');
});

test('the reading steps end with how long the reading takes', () => {
  const guide = { steps: [{ label: '從', text: '「開頭」', note: '' }], duration: '約 1 分鐘，中間不跳' };
  assert.deepEqual(guideRows(guide), [
    { label: '從', text: '「開頭」', note: '' },
    { label: '多久', text: '約 1 分鐘，中間不跳', note: '' },
  ]);
});

test('two cards from different volumes need two books', () => {
  const cards = [card('第5卷', '歡喜'), card('第16卷', '心血')];
  assert.equal(booksToBring(cards), '要帶兩本《新・人間革命》：第5卷〈歡喜〉、第16卷〈心血〉');
  assert.equal(booksPacked(cards), '兩本《新・人間革命》帶了：第5卷〈歡喜〉、第16卷〈心血〉');
});

test('cards from the same volume need one book', () => {
  const cards = [card('第7卷', '早春'), card('第7卷', '早春')];
  assert.equal(booksToBring(cards), '要帶《新・人間革命》第7卷〈早春〉');
  assert.equal(booksPacked(cards), '《新・人間革命》第7卷〈早春〉帶了');
});
