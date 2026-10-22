import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  GRADES,
  MAX_TICKETS,
  MAX_PER_GRADE,
  STALE_AFTER_MS,
  ticketTotal,
  countsProblem,
  shuffle,
  cryptoRandomInt,
  startRound,
  tearSeat,
  remainingByGrade,
  ticketsLeft,
  isStale,
  parseSaved,
  settingsFrom,
} from '../src/lib/ichiban.mjs';

const firstPick = () => 0;
const defaultCounts = () => ({ A: 1, B: 2, C: 3, D: 4 });
const emptyPrizes = () => ({ A: '', B: '', C: '', D: '' });

const tally = (seats) => Object.fromEntries(GRADES.map((grade) => [grade, seats.filter((seat) => seat === grade).length]));

const newRound = () =>
  startRound(
    { counts: defaultCounts(), prizes: { A: '  電動牙刷 ', B: '咖啡券', C: '', D: '   ' }, lastPrize: ' 年菜禮盒  ' },
    firstPick,
    1000,
  );

function tearAll(round, order, nowMs) {
  return order.reduce((current, seatIndex) => tearSeat(current, seatIndex, nowMs).round, round);
}

test('the fixed limits are the ones on the printed board', () => {
  assert.deepEqual(GRADES, ['A', 'B', 'C', 'D']);
  assert.equal(MAX_TICKETS, 100);
  assert.equal(MAX_PER_GRADE, 99);
  assert.equal(STALE_AFTER_MS, 86_400_000);
});

test('the ticket total adds up every grade', () => {
  assert.equal(ticketTotal({ A: 1, B: 2, C: 3, D: 4 }), 10);
});

test('counts are fine when every grade is a whole number and the total fits', () => {
  assert.equal(countsProblem({ A: 1, B: 2, C: 3, D: 4 }), null);
});

test('counts with no tickets at all are empty', () => {
  assert.equal(countsProblem({ A: 0, B: 0, C: 0, D: 0 }), 'empty');
});

test('counts over a hundred tickets are too many', () => {
  assert.equal(countsProblem({ A: 99, B: 2, C: 0, D: 0 }), 'too-many');
});

test('a grade that is not a whole number from 0 to 99 is a bad count', () => {
  for (const A of [-1, 100, 1.5, '1']) {
    assert.equal(countsProblem({ A, B: 2, C: 3, D: 4 }), 'bad-count', `A: ${JSON.stringify(A)}`);
  }
});

test('shuffling keeps the same tickets, is repeatable with a fixed pick and leaves the input alone', () => {
  const items = ['A', 'B', 'B', 'C'];
  const asked = [];
  const shuffled = shuffle(items, (n) => {
    asked.push(n);
    return 0;
  });
  assert.deepEqual(shuffled, ['B', 'B', 'C', 'A']);
  assert.deepEqual(shuffle(items, firstPick), shuffled);
  assert.deepEqual([...shuffled].sort(), [...items].sort());
  assert.deepEqual(asked, [4, 3, 2]);
  assert.deepEqual(items, ['A', 'B', 'B', 'C']);
  assert.notEqual(shuffled, items);
});

test('the crypto pick stays inside the range and reaches every value', () => {
  const seen = new Set();
  for (let i = 0; i < 300; i += 1) {
    const value = cryptoRandomInt(3);
    assert.ok([0, 1, 2].includes(value), `got ${value}`);
    seen.add(value);
  }
  assert.deepEqual([...seen].sort(), [0, 1, 2]);
});

test('a new round seats one ticket per prize, none torn, with trimmed prize names', () => {
  const round = newRound();
  assert.equal(round.version, 1);
  assert.deepEqual(round.counts, defaultCounts());
  assert.equal(round.seats.length, 10);
  assert.deepEqual(tally(round.seats), defaultCounts());
  assert.deepEqual(round.torn, Array(10).fill(false));
  assert.equal(round.updatedAt, 1000);
  assert.deepEqual(round.prizes, { A: '電動牙刷', B: '咖啡券', C: '', D: '' });
  assert.equal(round.lastPrize, '年菜禮盒');
});

test('tearing a seat reveals its grade and marks only that seat, without touching the old round', () => {
  const round = newRound();
  const before = structuredClone(round);
  const result = tearSeat(round, 0, 5000);
  assert.equal(result.grade, round.seats[0]);
  assert.equal(result.isLast, false);
  assert.deepEqual(result.round.torn, [true, ...Array(9).fill(false)]);
  assert.deepEqual(result.round.seats, round.seats);
  assert.equal(result.round.updatedAt, 5000);
  assert.deepEqual(round, before);
});

test('a seat cannot be torn twice or outside the row', () => {
  const round = newRound();
  const torn = tearSeat(round, 0, 5000).round;
  assert.equal(tearSeat(torn, 0, 6000), null);
  assert.equal(tearSeat(round, -1, 5000), null);
  assert.equal(tearSeat(round, 10, 5000), null);
});

test('tearing every seat counts down to the last one', () => {
  let round = newRound();
  const order = [3, 7, 0, 9, 1, 5, 2, 8, 4, 6];
  assert.equal(ticketsLeft(round), 10);
  assert.deepEqual(remainingByGrade(round), defaultCounts());
  order.forEach((seatIndex, i) => {
    const result = tearSeat(round, seatIndex, 2000 + i);
    assert.equal(result.isLast, i === order.length - 1, `tear ${i + 1}`);
    round = result.round;
    assert.equal(ticketsLeft(round), 10 - (i + 1));
    const remaining = remainingByGrade(round);
    for (const grade of GRADES) assert.ok(remaining[grade] >= 0, `${grade} after tear ${i + 1}`);
    assert.equal(ticketTotal(remaining), ticketsLeft(round));
  });
  assert.deepEqual(remainingByGrade(round), { A: 0, B: 0, C: 0, D: 0 });
  assert.equal(ticketsLeft(round), 0);
});

test('a saved round reads back the same, before and after some tears', () => {
  const round = newRound();
  assert.deepEqual(parseSaved(JSON.stringify(round)), round);
  const torn = tearAll(round, [2, 5, 8], 3000);
  assert.deepEqual(parseSaved(JSON.stringify(torn)), torn);
});

test('a saved round that is broken or does not add up is ignored', () => {
  const round = newRound();
  const swapped = [...round.seats];
  swapped[0] = swapped[0] === 'A' ? 'B' : 'A';
  for (const [label, text] of [
    ['not json', 'not json'],
    ['null', 'null'],
    ['version 2', JSON.stringify({ ...round, version: 2 })],
    ['a seat grade swapped', JSON.stringify({ ...round, seats: swapped })],
    ['torn one short', JSON.stringify({ ...round, torn: round.torn.slice(1) })],
    ['no tickets', JSON.stringify({ ...round, counts: { A: 0, B: 0, C: 0, D: 0 }, seats: [], torn: [] })],
  ]) {
    assert.equal(parseSaved(text), null, label);
  }
});

test('a round goes stale only after a full day without a tear', () => {
  const round = newRound();
  assert.equal(isStale(round, round.updatedAt + 86_400_000), false);
  assert.equal(isStale(round, round.updatedAt + 86_400_001), true);
});

test('settings come from the saved round, or from the defaults with blank prizes', () => {
  assert.deepEqual(settingsFrom(null, { A: 1, B: 2, C: 3, D: 4 }), {
    counts: { A: 1, B: 2, C: 3, D: 4 },
    prizes: emptyPrizes(),
    lastPrize: '',
  });
  const round = startRound(
    { counts: { A: 2, B: 0, C: 5, D: 1 }, prizes: { A: '保溫瓶', B: '', C: '襪子', D: '貼紙' }, lastPrize: '紅包' },
    firstPick,
    1000,
  );
  assert.deepEqual(settingsFrom(round, defaultCounts()), {
    counts: { A: 2, B: 0, C: 5, D: 1 },
    prizes: { A: '保溫瓶', B: '', C: '襪子', D: '貼紙' },
    lastPrize: '紅包',
  });
});
