import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { districtLabel, normalizeRoute, walkingLink, routeSteps } from '../src/lib/city-walk.mjs';

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
});

test('the start and end steps lead to the next stop and back to the meeting point', () => {
  const route = normalizeRoute(rawRoute(), '北一圈');
  const filled = routeSteps(cityWalkSteps(), route);
  assert.equal(filled[0].do, '集合點：捷運小南門站3號出口');
  assert.equal(filled[0].mapsUrl, walkingLink(route.stop1));
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
