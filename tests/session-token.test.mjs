import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { checkTokenInfo, makeSession, readSession, SESSION_MAX_AGE_MS } from '../apps-script/session-token.mjs';

const sign = (text) => createHmac('sha256', 'test-secret').update(text).digest('base64url');
const NOW = Date.parse('2027-01-15T00:00:00Z');
const INFO = {
  aud: 'client.apps.googleusercontent.com',
  email: 'Hualien@Gmail.com',
  email_verified: 'true',
  exp: String(NOW / 1000 + 600),
  iss: 'https://accounts.google.com',
};

test('a token issued to this site for a verified email gives the email in lower case', () => {
  assert.equal(checkTokenInfo(INFO, INFO.aud, NOW), 'hualien@gmail.com');
});

test('tokens for another site, unverified emails, expired or from another issuer are refused', () => {
  for (const change of [{ aud: 'other' }, { email_verified: 'false' }, { exp: String(NOW / 1000 - 1) }, { iss: 'evil.example' }]) {
    assert.equal(checkTokenInfo({ ...INFO, ...change }, INFO.aud, NOW), null, JSON.stringify(change));
  }
  assert.equal(checkTokenInfo(null, INFO.aud, NOW), null);
});

test('a session reads back as its email until it is a year old', () => {
  const token = makeSession('hualien@gmail.com', NOW, sign);
  assert.equal(readSession(token, NOW + 1000, sign), 'hualien@gmail.com');
  assert.equal(readSession(token, NOW + SESSION_MAX_AGE_MS, sign), null);
});

test('a changed email, time or signature and garbage are refused', () => {
  const [, time, signature] = makeSession('hualien@gmail.com', NOW, sign).split('.');
  assert.equal(readSession(`taitung%40gmail.com.${time}.${signature}`, NOW, sign), null);
  assert.equal(readSession(`hualien%40gmail.com.${NOW + 1}.${signature}`, NOW, sign), null);
  for (const garbage of ['', 'a.b', undefined, 'a.b.c.d']) assert.equal(readSession(garbage, NOW, sign), null);
});
