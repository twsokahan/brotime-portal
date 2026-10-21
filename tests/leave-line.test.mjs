import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { LEAVE_LINE_SCRIPT } from '../src/render/leave-line.mjs';

const LINE_IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari Line/13.17.0';
const LINE_ANDROID =
  'Mozilla/5.0 (Linux; Android 13; Pixel 7 Build/TQ3A.230805.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/116.0.0.0 Mobile Safari/537.36 Line/13.16.1/IAB';
const SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

const CITY_WALK_PATH = '/a/city-walk/';
const DISTRICT_QUERY = 'd=%E5%8F%B0%E5%8C%97%E8%A5%BF%E5%8D%80';

function run({ userAgent, search = '', hash = '' }) {
  const calls = { replace: [], replaceState: [], classesAdded: [], classesRemoved: [], clickListeners: [] };
  const context = {
    navigator: { userAgent },
    location: { pathname: CITY_WALK_PATH, search, hash, replace: (url) => calls.replace.push(url) },
    history: { state: { step: 2 }, replaceState: (...args) => calls.replaceState.push(args) },
    document: {
      documentElement: {
        classList: {
          add: (name) => calls.classesAdded.push(name),
          remove: (name) => calls.classesRemoved.push(name),
        },
      },
      addEventListener: (type, listener) => {
        if (type === 'click') calls.clickListeners.push(listener);
      },
    },
  };
  vm.runInNewContext(LEAVE_LINE_SCRIPT, context);
  return calls;
}

test('inside LINE without the parameter, the page reloads with it and keeps the other parameters and the hash', () => {
  for (const userAgent of [LINE_IPHONE, LINE_ANDROID]) {
    const calls = run({ userAgent, search: `?${DISTRICT_QUERY}`, hash: '#route' });
    assert.deepEqual(calls.replace, [`${CITY_WALK_PATH}?${DISTRICT_QUERY}&openExternalBrowser=1#route`]);
    assert.deepEqual(calls.replaceState, []);
  }
});

test('inside LINE on a page without any query, the parameter becomes the whole query', () => {
  assert.deepEqual(run({ userAgent: LINE_IPHONE }).replace, [`${CITY_WALK_PATH}?openExternalBrowser=1`]);
});

test('inside LINE with the parameter, the page stays and shows the notice until its button is pressed', () => {
  const calls = run({ userAgent: LINE_ANDROID, search: `?${DISTRICT_QUERY}&openExternalBrowser=1` });
  assert.deepEqual(calls.replace, []);
  assert.deepEqual(calls.replaceState, []);
  assert.deepEqual(calls.classesAdded, ['from-line']);
  assert.equal(calls.clickListeners.length, 1);

  const clickOn = (selectorMatched) => calls.clickListeners[0]({ target: { closest: (selector) => selector === selectorMatched } });
  clickOn('.somewhere-else');
  assert.deepEqual(calls.classesRemoved, []);
  clickOn('.line-notice button');
  assert.deepEqual(calls.classesRemoved, ['from-line']);
});

test('outside LINE, the parameter is removed from the address and the other parameters and the hash stay', () => {
  const calls = run({ userAgent: SAFARI, search: `?openExternalBrowser=1&${DISTRICT_QUERY}`, hash: '#route' });
  assert.deepEqual(calls.replace, []);
  assert.deepEqual(calls.replaceState, [[{ step: 2 }, '', `${CITY_WALK_PATH}?${DISTRICT_QUERY}#route`]]);
  assert.deepEqual(calls.classesAdded, []);
});

test('outside LINE, removing the only parameter leaves no question mark', () => {
  const calls = run({ userAgent: SAFARI, search: '?openExternalBrowser=1' });
  assert.deepEqual(calls.replaceState, [[{ step: 2 }, '', CITY_WALK_PATH]]);
});

test('outside LINE without the parameter, nothing happens', () => {
  const calls = run({ userAgent: SAFARI, search: `?${DISTRICT_QUERY}`, hash: '#route' });
  assert.deepEqual(calls, { replace: [], replaceState: [], classesAdded: [], classesRemoved: [], clickListeners: [] });
});

test('a word that only ends in "line" is not taken for LINE', () => {
  const calls = run({ userAgent: `${SAFARI} Online/1.0` });
  assert.deepEqual(calls.replace, []);
});

test('when the browser objects are missing, the script does nothing and throws nothing', () => {
  assert.doesNotThrow(() => vm.runInNewContext(LEAVE_LINE_SCRIPT, {}));
});
