import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { NONE_SCOPE } from '../apps-script/allowlist.mjs';
import { handleRequest } from '../apps-script/api.mjs';
import { makeSession } from '../apps-script/session-token.mjs';

const CLIENT_ID = 'client.apps.googleusercontent.com';
const NOW = Date.parse('2027-01-15T02:00:00Z');
const sign = (text) => createHmac('sha256', 'test-secret').update(text).digest('base64url');
const HUALIEN = { level: 'district', label: '花蓮區', districts: ['花蓮區'] };
const sessionFor = (email) => makeSession(email, NOW, sign);
const idToken = (email, aud = CLIENT_ID) => `${aud}|${email}`;

function fakeDeps({ allowlist = { 'hualien@gmail.com': HUALIEN, 'host@gmail.com': NONE_SCOPE }, supplementRows = [] } = {}) {
  const calls = { added: [], removed: [], stats: [] };
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
    supplement: {
      list: () => supplementRows,
      add: (row) => calls.added.push(row),
      remove: (email, district) => {
        calls.removed.push([email, district]);
        return true;
      },
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

test("stats are forbidden to the supplement list and passed the caller's scope otherwise", () => {
  const { deps, calls } = fakeDeps();
  assert.deepEqual(handleRequest({ action: 'stats', session: sessionFor('host@gmail.com') }, deps), { ok: false, error: 'forbidden' });
  assert.deepEqual(handleRequest({ action: 'stats', session: sessionFor('hualien@gmail.com') }, deps), { ok: true, wants: null, sessions: [] });
  assert.deepEqual(calls.stats, [HUALIEN]);
});

test("adding a host stays inside the caller's districts and records who and when", () => {
  const { deps, calls } = fakeDeps();
  const session = sessionFor('hualien@gmail.com');
  assert.deepEqual(handleRequest({ action: 'addHost', session, district: '台東區', email: 'new@gmail.com' }, deps), { ok: false, error: 'forbidden' });
  assert.deepEqual(handleRequest({ action: 'addHost', session, district: '花蓮區', email: 'New＠Gmail.com', name: ' 小明 ' }, deps), { ok: true, added: true });
  assert.deepEqual(calls.added, [{ email: 'new@gmail.com', name: '小明', district: '花蓮區', addedBy: 'hualien@gmail.com', addedOn: '2027-01-15' }]);
});

test('adding someone already listed or something that is not an email changes nothing', () => {
  const { deps, calls } = fakeDeps();
  const session = sessionFor('hualien@gmail.com');
  assert.deepEqual(handleRequest({ action: 'addHost', session, district: '花蓮區', email: 'host@gmail.com' }, deps), {
    ok: true, added: false, reason: 'already-listed',
  });
  assert.deepEqual(handleRequest({ action: 'addHost', session, district: '花蓮區', email: '王小明' }, deps), { ok: false, error: 'bad-email' });
  assert.deepEqual(calls.added, []);
});

test('hosts list only that district, newest first, without who added them', () => {
  const supplementRows = [
    { email: 'a@gmail.com', name: '阿明', district: '花蓮區', addedBy: 'x@gmail.com', addedOn: '2027-01-01' },
    { email: 'b@gmail.com', name: '', district: '台東區', addedBy: 'y@gmail.com', addedOn: '2027-01-05' },
    { email: 'c@gmail.com', name: '', district: '花蓮區', addedBy: 'x@gmail.com', addedOn: '2027-01-10' },
  ];
  const { deps } = fakeDeps({ supplementRows });
  assert.deepEqual(handleRequest({ action: 'hosts', session: sessionFor('hualien@gmail.com'), district: '花蓮區' }, deps), {
    ok: true,
    hosts: [{ email: 'c@gmail.com', name: '', addedOn: '2027-01-10' }, { email: 'a@gmail.com', name: '阿明', addedOn: '2027-01-01' }],
  });
});

test('removing a host from another district is forbidden', () => {
  const { deps, calls } = fakeDeps();
  const request = { action: 'removeHost', session: sessionFor('hualien@gmail.com'), district: '台東區', email: 'b@gmail.com' };
  assert.deepEqual(handleRequest(request, deps), { ok: false, error: 'forbidden' });
  assert.deepEqual(handleRequest({ ...request, district: '花蓮區' }, deps), { ok: true, removed: true });
  assert.deepEqual(calls.removed, [['b@gmail.com', '花蓮區']]);
});

test('unknown actions and tampered sessions are refused', () => {
  const { deps } = fakeDeps();
  assert.deepEqual(handleRequest({ action: 'deleteEverything' }, deps), { ok: false, error: 'bad-request' });
  assert.deepEqual(handleRequest(null, deps), { ok: false, error: 'bad-request' });
  const tampered = sessionFor('hualien@gmail.com').replace('hualien', 'taitung');
  assert.deepEqual(handleRequest({ action: 'me', session: tampered }, deps), { ok: false, error: 'bad-session' });
});
