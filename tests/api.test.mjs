import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { handleRequest } from '../apps-script/api.mjs';
import { makeSession } from '../apps-script/session-token.mjs';

const CLIENT_ID = 'client.apps.googleusercontent.com';
const NOW = Date.parse('2027-01-15T02:00:00Z');
const sign = (text) => createHmac('sha256', 'test-secret').update(text).digest('base64url');
const HUALIEN = { level: 'district', label: '花蓮區', districts: ['花蓮區'] };
const sessionFor = (email) => makeSession(email, NOW, sign);
const idToken = (email, aud = CLIENT_ID) => `${aud}|${email}`;

function fakeDeps({ allowlist = { 'hualien@gmail.com': HUALIEN } } = {}) {
  const calls = { stats: [] };
  const deps = {
    clientId: CLIENT_ID,
    now: () => NOW,
    sign,
    tokenInfo: (token) => {
      const [aud, email] = token.split('|');
      return { aud, email, email_verified: 'true', exp: String(NOW / 1000 + 600), iss: 'accounts.google.com' };
    },
    allowlist: () => allowlist,
    stats: (scope) => {
      calls.stats.push(scope);
      return { wants: null, sessions: [] };
    },
  };
  return { deps, calls };
}

test('signing in with a listed account returns a session that me accepts', () => {
  const { deps } = fakeDeps();
  const signedIn = handleRequest({ action: 'signIn', idToken: idToken('hualien@gmail.com') }, deps);
  assert.equal(signedIn.ok, true);
  assert.equal(signedIn.listed, true);
  assert.deepEqual(signedIn.scope, HUALIEN);
  assert.deepEqual(handleRequest({ action: 'me', session: signedIn.session }, deps), {
    ok: true, listed: true, email: 'hualien@gmail.com', scope: HUALIEN,
  });
});

test('a token for another site is refused', () => {
  const { deps } = fakeDeps();
  assert.deepEqual(handleRequest({ action: 'signIn', idToken: idToken('hualien@gmail.com', 'other') }, deps), { ok: false, error: 'bad-token' });
});

test('an unlisted account learns which email it used and gets no session', () => {
  const { deps } = fakeDeps();
  assert.deepEqual(handleRequest({ action: 'signIn', idToken: idToken('stranger@gmail.com') }, deps), {
    ok: true, listed: false, email: 'stranger@gmail.com',
  });
});

test('me reports a person taken off the lists', () => {
  const { deps } = fakeDeps({ allowlist: {} });
  const session = sessionFor('hualien@gmail.com');
  assert.deepEqual(handleRequest({ action: 'me', session }, deps), { ok: true, listed: false, email: 'hualien@gmail.com' });
  assert.deepEqual(handleRequest({ action: 'stats', session }, deps), { ok: false, error: 'not-listed' });
});

test("stats are passed the caller's scope", () => {
  const { deps, calls } = fakeDeps();
  assert.deepEqual(handleRequest({ action: 'stats', session: sessionFor('hualien@gmail.com') }, deps), { ok: true, wants: null, sessions: [] });
  assert.deepEqual(calls.stats, [HUALIEN]);
});

test('the host actions are gone', () => {
  const { deps } = fakeDeps();
  const session = sessionFor('hualien@gmail.com');
  for (const action of ['hosts', 'addHost', 'removeHost']) {
    assert.deepEqual(handleRequest({ action, session, district: '花蓮區', email: 'new@gmail.com' }, deps), { ok: false, error: 'bad-request' }, action);
  }
});

test('unknown actions and tampered sessions are refused', () => {
  const { deps } = fakeDeps();
  assert.deepEqual(handleRequest({ action: 'deleteEverything' }, deps), { ok: false, error: 'bad-request' });
  assert.deepEqual(handleRequest(null, deps), { ok: false, error: 'bad-request' });
  const tampered = sessionFor('hualien@gmail.com').replace('hualien', 'taitung');
  assert.deepEqual(handleRequest({ action: 'me', session: tampered }, deps), { ok: false, error: 'bad-session' });
});

test('a Gmail account signs in even when the list wrote its address with different dots', () => {
  const { deps } = fakeDeps({ allowlist: { 'hualien@gmail.com': HUALIEN } });
  const signedIn = handleRequest({ action: 'signIn', idToken: idToken('hua.lien@gmail.com') }, deps);
  assert.equal(signedIn.listed, true);
  assert.equal(signedIn.email, 'hua.lien@gmail.com');
  assert.equal(handleRequest({ action: 'me', session: signedIn.session }, deps).listed, true);
});
