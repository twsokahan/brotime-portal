import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isLastDayOfMonth, isShowing, pushWindow, seasonWindow, taipeiIsoDate } from '../src/lib/featured.mjs';

test('a push shows from the first day of the month before it starts until its last day', () => {
  assert.deepEqual(pushWindow({ from: '2027-02-06', to: '2027-02-20' }), { from: '2027-01-01', to: '2027-02-20' });
  assert.deepEqual(pushWindow({ from: '2027-10-01', to: '2027-10-31' }), { from: '2027-09-01', to: '2027-10-31' });
});

test('a push starting in January shows from December of the year before', () => {
  assert.deepEqual(pushWindow({ from: '2028-01-10', to: '2028-01-20' }), { from: '2027-12-01', to: '2028-01-20' });
});

test('a season shows while next month falls inside it', () => {
  assert.deepEqual(seasonWindow({ from: '2027-01-01', to: '2027-03-31' }), { from: '2026-12-01', to: '2027-02-28' });
  assert.deepEqual(seasonWindow({ from: '2027-10-01', to: '2027-12-31' }), { from: '2027-09-01', to: '2027-11-30' });
  assert.deepEqual(seasonWindow({ from: '2028-01-01', to: '2028-03-31' }), { from: '2027-12-01', to: '2028-02-29' });
});

test('a window includes both of its ends', () => {
  const window = { from: '2027-01-01', to: '2027-02-20' };
  assert.equal(isShowing(window, '2026-12-31'), false);
  assert.equal(isShowing(window, '2027-01-01'), true);
  assert.equal(isShowing(window, '2027-02-20'), true);
  assert.equal(isShowing(window, '2027-02-21'), false);
});

test('the last day of a month knows about leap years', () => {
  assert.equal(isLastDayOfMonth('2027-03-31'), true);
  assert.equal(isLastDayOfMonth('2027-02-28'), true);
  assert.equal(isLastDayOfMonth('2028-02-28'), false);
  assert.equal(isLastDayOfMonth('2028-02-29'), true);
  assert.equal(isLastDayOfMonth('2027-06-30'), true);
  assert.equal(isLastDayOfMonth('2027-06-29'), false);
});

test('the build date is the date in Taiwan, not in UTC', () => {
  assert.equal(taipeiIsoDate(new Date('2026-12-31T16:30:00Z')), '2027-01-01');
  assert.equal(taipeiIsoDate(new Date('2026-12-31T15:30:00Z')), '2026-12-31');
});

test('showFrom brings a push or a season forward without moving its end', () => {
  assert.deepEqual(pushWindow({ from: '2027-02-06', to: '2027-02-20', showFrom: '2026-12-15' }), {
    from: '2026-12-15',
    to: '2027-02-20',
  });
  assert.deepEqual(seasonWindow({ from: '2027-01-01', to: '2027-03-31', showFrom: '2026-11-01' }), {
    from: '2026-11-01',
    to: '2027-02-28',
  });
});
