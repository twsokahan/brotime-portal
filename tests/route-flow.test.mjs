import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeRoute } from '../src/lib/city-walk.mjs';
import { routeFlow, routeWording } from '../src/lib/route-flow.mjs';

const readJson = (relative) => JSON.parse(readFileSync(new URL(relative, import.meta.url), 'utf8'));
const steps = () => readJson('../content/activities/city-walk.json').steps;
const routeWith = (legMinutes) => ({ ...normalizeRoute(readJson('./fixtures/raw-route.json'), '北一圈'), legMinutes });

test('step times add up the route legs', () => {
  assert.deepEqual(
    routeFlow(steps(), routeWith([16, 18])).steps.map((step) => step.time),
    ['0–5 分', '5–21 分', '21–31 分', '31–49 分', '49–59 分', '59–64 分'],
  );
  assert.deepEqual(
    routeFlow(steps(), routeWith([18, 25])).steps.map((step) => step.time),
    ['0–5 分', '5–23 分', '23–33 分', '33–58 分', '58–68 分', '68–73 分'],
  );
});

test('a route past 60 minutes says its real length', () => {
  const flow = routeFlow(steps(), routeWith([16, 18]));
  assert.equal(flow.totalMinutes, 64);
  assert.equal(flow.flowTitle, '64 分鐘這樣過');
  assert.equal(flow.duration, '約 64 分鐘');
  assert.equal(flow.steps[0].say, '今天就是一起散散步、輕鬆聊天，大約 64 分鐘結束；要先離開的不用客氣。');
  assert.equal(flow.overtimeNote, '這條路線照流程走大約 64 分鐘。想 60 分鐘結束，可以把停留點一縮短 4 分。');
});

test('a route too long to fix by shortening the first stop says how much is left over', () => {
  assert.equal(
    routeFlow(steps(), routeWith([18, 25])).overtimeNote,
    '這條路線照流程走大約 73 分鐘。想 60 分鐘結束，可以把停留點一縮短 5 分，還是會超過 8 分鐘。',
  );
});

test('no step of a long route still promises 60 minutes', () => {
  const flow = routeFlow(steps(), routeWith([18, 25]));
  for (const step of flow.steps) assert.ok(!`${step.say}${step.do}`.includes('60 分鐘'), step.title);
});

test('the walking time in the opening step follows the route', () => {
  assert.ok(routeFlow(steps(), routeWith([16, 18])).steps[0].do.includes('走約 34 分鐘，中間停兩個地方'));
});

test('a route of exactly 60 minutes keeps the 60-minute wording', () => {
  const flow = routeFlow(steps(), routeWith([15, 15]));
  assert.equal(flow.totalMinutes, 60);
  assert.equal(flow.flowTitle, null);
  assert.equal(flow.duration, null);
  assert.equal(flow.overtimeNote, null);
  assert.equal(flow.steps[0].say, steps()[0].say);
});

test('a short route ends early but keeps the 60-minute wording', () => {
  const flow = routeFlow(steps(), routeWith([8, 16]));
  assert.equal(flow.steps.at(-1).time, '49–54 分');
  assert.equal(flow.flowTitle, null);
  assert.ok(flow.steps.at(-1).do.includes('60 分鐘準時宣布'));
});

test('the first-time tip about announcing the end follows the route length', () => {
  const tip = '60 分鐘準時宣布「正式程序到此結束」';
  assert.equal(routeWording(tip, { totalMinutes: 64, walkMinutes: 34 }), '約 64 分鐘準時宣布「正式程序到此結束」');
  assert.equal(routeWording(tip, { totalMinutes: 54, walkMinutes: 24 }), tip);
});
