import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isInLine, needsRecheck, RECHECK_AFTER_MS, recheckOutcome, recordFrom } from '../src/lib/signin.mjs';

const NOW = Date.parse('2027-01-15T02:00:00Z');
const SCOPE = { level: 'district', label: '花蓮區', districts: ['花蓮區'] };
const LINE_IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari Line/13.17.0';
const LINE_ANDROID =
  'Mozilla/5.0 (Linux; Android 13; Pixel 7 Build/TQ3A.230805.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/116.0.0.0 Mobile Safari/537.36 Line/13.16.1/IAB';
const SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

test('the record stays when the check cannot reach the server', () => {
  assert.equal(recheckOutcome(null), 'keep');
  assert.equal(recheckOutcome({ ok: false, error: 'server' }), 'keep');
});

test('a listed answer updates the record and an unlisted or invalid one signs out', () => {
  assert.equal(recheckOutcome({ ok: true, listed: true, email: 'hualien@gmail.com', scope: SCOPE }), 'update');
  assert.equal(recheckOutcome({ ok: true, listed: false, email: 'hualien@gmail.com' }), 'sign-out');
  assert.equal(recheckOutcome({ ok: false, error: 'bad-session' }), 'sign-out');
  assert.equal(recheckOutcome({ ok: false, error: 'not-listed' }), 'sign-out');
});

test('a record is checked again after a day', () => {
  assert.equal(needsRecheck({ checkedAt: NOW - RECHECK_AFTER_MS + 60_000 }, NOW), false);
  assert.equal(needsRecheck({ checkedAt: NOW - RECHECK_AFTER_MS }, NOW), true);
  assert.equal(needsRecheck({}, NOW), true);
});

test('the LINE browser is recognised on iPhone and Android but not Safari', () => {
  assert.equal(isInLine(LINE_IPHONE), true);
  assert.equal(isInLine(LINE_ANDROID), true);
  assert.equal(isInLine(SAFARI), false);
});

test('a record keeps the session it was given', () => {
  assert.deepEqual(recordFrom({ ok: true, listed: true, email: 'hualien@gmail.com', scope: SCOPE }, 'tok', NOW), {
    email: 'hualien@gmail.com', session: 'tok', scope: SCOPE, checkedAt: NOW,
  });
});
