import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeRoute, streetViewUrl } from '../src/lib/city-walk.mjs';
import { pathLength, pointAlong } from '../src/lib/geo.mjs';
import { routeFlow } from '../src/lib/route-flow.mjs';
import { bookRows, minuteText, positionAt } from '../src/lib/route-book.mjs';

const readJson = (relative) => JSON.parse(readFileSync(new URL(relative, import.meta.url), 'utf8'));
const route = normalizeRoute(readJson('./fixtures/raw-route.json'), '北一圈');
const flow = routeFlow(readJson('../content/activities/city-walk.json').steps, route);

test('the book lists the stops and legs in walking order with their start minutes', () => {
  const rows = bookRows(route, flow);
  assert.deepEqual(
    rows.map((row) => [row.kind, row.minute]),
    [
      ['stop', 0],
      ['leg', 5],
      ['stop', 13],
      ['leg', 23],
      ['stop', 39],
      ['wrap', 49],
    ],
  );
  assert.equal(rows[0].title, `集合：${route.meetingPoint}`);
  assert.equal(rows[0].streetViewUrl, streetViewUrl(route.start));
  assert.equal(rows[1].title, '第一段　約 8 分・0.5 公里');
  assert.equal(rows[1].via, '從3號出口進台北植物園，沿園內步道走到臘葉館');
  assert.equal(rows[1].navUrl, route.legNavUrls[0]);
  assert.equal(rows[2].title, `停留點一：${route.stop1.place}`);
  assert.equal(rows[2].detail, '念故事卡 P，停 10 分');
  assert.equal(rows[3].title, '第二段　約 16 分・1.1 公里');
  assert.equal(rows[4].title, `終點：${route.end.place}`);
  assert.equal(rows[4].detail, '念故事卡 B、分享感動');
  assert.equal(rows[4].streetViewUrl, streetViewUrl(route.end));
  assert.equal(rows[5].title, '收尾，約第 54 分結束');
  assert.equal(rows[5].detail, route.returnText);
});

test('the dot waits at the meeting point, walks the legs and ends at the last stop', () => {
  assert.deepEqual(positionAt(route, flow, 0), { point: [route.start.lat, route.start.lon], leg: null });
  assert.deepEqual(positionAt(route, flow, 5), { point: route.legPaths[0][0], leg: 0 });
  assert.deepEqual(positionAt(route, flow, 9), {
    point: pointAlong(route.legPaths[0], pathLength(route.legPaths[0]) / 2),
    leg: 0,
  });
  assert.deepEqual(positionAt(route, flow, 13), { point: [route.stop1.lat, route.stop1.lon], leg: null });
  assert.deepEqual(positionAt(route, flow, 30), {
    point: pointAlong(route.legPaths[1], (pathLength(route.legPaths[1]) * 7) / 16),
    leg: 1,
  });
  assert.deepEqual(positionAt(route, flow, 50), { point: [route.end.lat, route.end.lon], leg: null });
  assert.deepEqual(positionAt(route, flow, 54), { point: [route.end.lat, route.end.lon], leg: null });
});

test('the slider line says where the group is and how long to the next stop', () => {
  const walked = Math.round(pathLength(route.legPaths[0]) / 2 / 10) * 10;
  assert.equal(minuteText(route, flow, 9), `第 9 分　第一段，走了約 ${walked} 公尺，再約 4 分到停留點一。`);
  assert.equal(minuteText(route, flow, 2), '第 2 分　在集合點等人到齊、說明路線。');
  assert.equal(minuteText(route, flow, 15), '第 15 分　在停留點一念故事卡 P。');
  assert.equal(minuteText(route, flow, 40), '第 40 分　在終點念故事卡 B、分享感動。');
  assert.equal(minuteText(route, flow, 50), '第 50 分　收尾，第 54 分結束。');
  assert.equal(minuteText(route, flow, 54), '第 54 分　結束。');
});

test('the second leg leads to the end', () => {
  assert.match(minuteText(route, flow, 30), /^第 30 分　第二段，走了約 \d+ 公尺，再約 9 分到終點。$/);
});
