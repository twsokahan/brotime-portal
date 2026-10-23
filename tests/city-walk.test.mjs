import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  districtLabel,
  legNavUrl,
  normalizeRoute,
  routeOptionLabel,
  routeSteps,
  splitLegTexts,
  streetViewUrl,
  walkingLink,
} from '../src/lib/city-walk.mjs';

const rawRoute = () => JSON.parse(readFileSync(new URL('./fixtures/raw-route.json', import.meta.url), 'utf8'));

const cityWalkSteps = () => [
  { time: '0–10 分', minutes: 10, title: '集合', do: '', say: '人到齊就出發。', routeStop: 'start' },
  { time: '10–20 分', minutes: null, title: '走第一段', do: '慢慢走。', say: '邊走邊聊。', routeLeg: 0 },
  {
    time: '20–30 分',
    minutes: 10,
    title: '停留點一',
    do: '先念介紹詞，再念故事卡。',
    say: '我們在這裡念故事。',
    routeStop: 'stop1',
  },
  { time: '30–45 分', minutes: null, title: '走第二段', do: '慢慢走。', say: '邊走邊聊。', routeLeg: 1 },
  {
    time: '45–60 分',
    minutes: 15,
    title: '終點',
    do: '',
    say: '今天辛苦了。',
    routeStop: 'end',
    cards: ['story'],
    cardIds: ['Z'],
  },
];

test('normalizing a route keeps the internal review notes off the site', () => {
  const published = JSON.stringify(normalizeRoute(rawRoute(), '北一圈'));
  for (const internal of ['todo', 'flags', 'notes', 'confidence', '備註', 'legs', '低於1.8公里']) {
    assert.ok(!published.includes(internal), `published route should not contain ${internal}`);
  }
});

test('normalizing a route picks the story card, leg minutes and points', () => {
  const route = normalizeRoute(rawRoute(), '北一圈');
  assert.equal(route.stop1.storyCard, 'P');
  assert.deepEqual(route.legMinutes, [8, 16]);
  assert.equal(route.start.lat, 25.035327);
});

const withParking = (parking) => {
  const raw = rawRoute();
  raw.text.停車 = parking;
  return normalizeRoute(raw, '北一圈').parking;
};

test('the parking text tells the host to check scooter parking in person', () => {
  assert.equal(
    normalizeRoute(rawRoute(), '北一圈').parking,
    '和雲台北愛國西路停車場（走到集合點約230公尺）；新長越小南門停車場（約370公尺）；機車停哪裡，建議事先到現場看一下',
  );
});

test('the parking text tells the host to check car and scooter parking in person', () => {
  assert.equal(
    withParking('合同廳舍一帶的路邊與公有停車位；汽車、機車停車位需實地確認'),
    '合同廳舍一帶的路邊與公有停車位；汽車、機車停哪裡，建議事先到現場看一下',
  );
});

test('parking text without the planning-office reminder stays as it is', () => {
  assert.equal(withParking('會館地下停車場（約50公尺）'), '會館地下停車場（約50公尺）');
});

test('a walking link navigates to the point on foot', () => {
  assert.equal(
    walkingLink({ lat: 25.1, lon: 121.5 }),
    'https://www.google.com/maps/dir/?api=1&travelmode=walking&destination=25.1,121.5',
  );
});

test('the first stop reads the intro aloud with its story card and leads to the end', () => {
  const route = normalizeRoute(rawRoute(), '北一圈');
  const stop1 = routeSteps(cityWalkSteps(), route)[2];
  assert.equal(stop1.readAloud, route.stop1.intro);
  assert.deepEqual(stop1.cardIds, ['P']);
  assert.ok(stop1.mapsLabel.startsWith('走到下一站：'));
  assert.equal(stop1.mapsUrl, route.legNavUrls[1]);
});

test('the start and end steps lead to the next stop and back to the meeting point', () => {
  const route = normalizeRoute(rawRoute(), '北一圈');
  const filled = routeSteps(cityWalkSteps(), route);
  assert.equal(filled[0].do, '集合點：捷運小南門站3號出口');
  assert.equal(filled[0].mapsUrl, route.legNavUrls[0]);
  assert.equal(filled[4].do, `終點：${route.end.place}`);
  assert.deepEqual(filled[4].cardIds, ['Z']);
  assert.equal(filled[4].mapsLabel, '回到集合點：捷運小南門站3號出口');
  assert.equal(filled[4].mapsUrl, walkingLink(route.start));
});

test('a route stop shows its place first, then the step\'s own instructions', () => {
  const route = normalizeRoute(rawRoute(), '北一圈');
  const steps = cityWalkSteps();
  delete steps[4].do;
  const filled = routeSteps(steps, route);
  assert.equal(filled[2].do, `停在${route.stop1.place}。先念介紹詞，再念故事卡。`);
  assert.equal(filled[0].do, '集合點：捷運小南門站3號出口');
  assert.equal(filled[4].do, `終點：${route.end.place}`);
});

test('walking legs take their minutes from the route', () => {
  const filled = routeSteps(cityWalkSteps(), normalizeRoute(rawRoute(), '北一圈'));
  assert.equal(filled[1].minutes, 8);
  assert.equal(filled[3].minutes, 16);
});

test('filling route steps leaves the original steps untouched', () => {
  const steps = cityWalkSteps();
  routeSteps(steps, normalizeRoute(rawRoute(), '北一圈'));
  assert.deepEqual(steps, cityWalkSteps());
});

test('an island district reads as its place with its circle in brackets', () => {
  assert.equal(districtLabel('南二圈_澎湖'), '澎湖（南二圈）');
  assert.equal(districtLabel('基宜圈_馬祖'), '馬祖（基宜圈）');
  assert.equal(districtLabel('總合本部_金門'), '金門（總合本部）');
});

test('an ordinary district reads as its own name', () => {
  assert.equal(districtLabel('台北西區'), '台北西區');
});

test('normalizing a route keeps the review site id so a district can hold two routes', () => {
  assert.equal(normalizeRoute({ ...rawRoute(), id: '台北西區-2' }, '北一圈').id, '台北西區-2');
});

test('a route option reads as its district while the district has one route', () => {
  const routes = [
    { id: '台北西區', district: '台北西區', title: '台北西區：植物園小南門線' },
    { id: '南二圈_澎湖', district: '南二圈_澎湖', title: '澎湖（南二圈）：中央老街線' },
  ];
  assert.deepEqual(
    routes.map((route) => routeOptionLabel(route, routes)),
    ['台北西區', '澎湖（南二圈）'],
  );
});

test('a route option adds its line name when the district has two routes', () => {
  const routes = [
    { id: '基隆北區', district: '基隆北區', title: '基隆北區：梓桑古厝線' },
    { id: '基隆北區-2', district: '基隆北區', title: '基隆北區：三連棟線' },
  ];
  assert.deepEqual(
    routes.map((route) => routeOptionLabel(route, routes)),
    ['基隆北區・梓桑古厝線', '基隆北區・三連棟線'],
  );
});

test('route text splits into two legs with spaced arrows', () => {
  assert.deepEqual(splitLegTexts(rawRoute().text.路線), [
    '從3號出口進台北植物園，沿園內步道走到臘葉館',
    '臘葉館 → 荷花池 → 園內步道往西北 → 小南門',
  ]);
});

test('a trailing remark after the distance does not break the split', () => {
  const text =
    '第一段（約17分鐘）：南苗市場→中山路→羅福星像。第二段（約20分鐘）：羅福星像→園內步道→南苗三角公園。全程約2.6公里，含園內步道。';
  assert.deepEqual(splitLegTexts(text), ['南苗市場 → 中山路 → 羅福星像', '羅福星像 → 園內步道 → 南苗三角公園']);
});

test('route text without two legs cannot be split', () => {
  assert.equal(splitLegTexts('從公園走到車站。'), null);
});

test('a leg navigation link walks from one stop to the next through three points on the path', () => {
  assert.equal(
    legNavUrl({ lat: 25, lon: 121 }, [[25, 121], [25, 121.004]], { lat: 25, lon: 121.004 }),
    'https://www.google.com/maps/dir/?api=1&travelmode=walking&dir_action=navigate' +
      '&origin=25.000000,121.000000&destination=25.000000,121.004000' +
      '&waypoints=25.000000,121.001000%7C25.000000,121.002000%7C25.000000,121.003000',
  );
});

test('a street view link opens the panorama nearest the point', () => {
  assert.equal(
    streetViewUrl({ lat: 25.1, lon: 121.5 }),
    'https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=25.1,121.5',
  );
});

test('normalizing a route carries both legs for the map and navigation', () => {
  const route = normalizeRoute(rawRoute(), '北一圈');
  assert.equal(route.legPaths.length, 2);
  assert.equal(route.legPaths[0].length, 42);
  const [lat, lon] = route.legPaths[0][0];
  assert.ok(Math.abs(lat - 25.035325) <= 0.000005 && Math.abs(lon - 121.511042) <= 0.000005);
  assert.equal(lat, Number(lat.toFixed(5)));
  assert.deepEqual(route.legMeters, [537, 1130]);
  assert.deepEqual(route.legTexts, splitLegTexts(rawRoute().text.路線));
  assert.equal(route.legNavUrls[1], legNavUrl(route.stop1, rawRoute().legs[1].path, route.end));
  assert.equal(route.googleRouteUrl, undefined);
});

test('normalizing a route whose text has no two legs names the district', () => {
  const raw = rawRoute();
  raw.text.路線 = '從公園走到車站。';
  assert.throws(() => normalizeRoute(raw, '北一圈'), /台北西區/);
});
