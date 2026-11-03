import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { SIGNIN_STORAGE_KEY } from '../src/lib/signin.mjs';
import { SIGNIN_HEAD_SCRIPT } from '../src/render/signin.mjs';

function run(context) {
  const added = [];
  vm.runInNewContext(SIGNIN_HEAD_SCRIPT, {
    ...context,
    document: { documentElement: { classList: { add: (name) => added.push(name) } } },
  });
  return added;
}

const storing = (value) => ({ localStorage: { getItem: (key) => (key === SIGNIN_STORAGE_KEY ? value : null) } });
const RECORD = { email: 'hualien@gmail.com', session: 'token', scope: { level: 'district', label: '花蓮區', districts: ['花蓮區'] }, checkedAt: 1 };

test('without a record the page asks to sign in', () => {
  assert.deepEqual(run(storing(null)), ['signin-needed']);
});

test('a broken record, a record without a session, or storage that throws asks to sign in instead of breaking the page', () => {
  assert.deepEqual(run(storing('{not json')), ['signin-needed']);
  assert.deepEqual(run(storing(JSON.stringify({ email: 'hualien@gmail.com' }))), ['signin-needed']);
  assert.deepEqual(run({ localStorage: { getItem: () => { throw new Error('SecurityError'); } } }), ['signin-needed']);
  assert.deepEqual(run({}), ['signin-needed']);
});

test('a record with an email and a session lets the page show', () => {
  assert.deepEqual(run(storing(JSON.stringify(RECORD))), []);
});
