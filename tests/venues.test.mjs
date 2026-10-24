import { test } from 'node:test';
import assert from 'node:assert/strict';
import { distanceText, nearestPlace, placeMapsUrl, placesByRegion, venueLabel, venueSteps } from '../src/lib/venues.mjs';

const spot = (name) => ({
  name,
  what: '咖啡店',
  hours: '每天 08:00–18:00',
  distance: '直線約 100 公尺',
  mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}`,
});

const place = (overrides = {}) => ({
  id: 'zhishan',
  name: '至善館',
  area: '台北士林',
  region: '北部',
  address: '台北市士林區至善路二段250號',
  transit: '捷運士林站轉公車',
  food: [spot('Slope Cafe'), spot('咖朵咖啡')],
  walks: [],
  cityWalks: [],
  ...overrides,
});

const steps = [
  { title: '會合', do: '分館門口集合。', say: '…', venueStop: 'meet' },
  { title: '看展', do: '各看各的。', say: '…' },
  { title: '亮出那件作品', do: '坐下來。', say: '…', venueStop: 'sit' },
];

test('a venue is named with its area when it has one', () => {
  assert.equal(venueLabel(place()), '至善館（台北士林）');
  assert.equal(venueLabel(place({ name: '高雄本館', area: undefined })), '高雄本館');
});

test('the maps link searches the venue address', () => {
  assert.equal(
    placeMapsUrl(place()),
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('台北市士林區至善路二段250號')}`,
  );
});

test('venues are grouped by region in the order the regions first appear', () => {
  const places = [
    place({ id: 'a', region: '北部' }),
    place({ id: 'b', region: '中部' }),
    place({ id: 'c', region: '北部' }),
  ];
  assert.deepEqual(
    placesByRegion(places).map(({ region, places: inRegion }) => [region, inRegion.map((p) => p.id)]),
    [
      ['北部', ['a', 'c']],
      ['中部', ['b']],
    ],
  );
});

test('without a chosen venue the steps stay as written', () => {
  assert.equal(venueSteps(steps, null), steps);
});

test('the meeting step starts with where the venue is and opens it on the map', () => {
  const [meet] = venueSteps(steps, place());
  assert.equal(meet.do, '地點：至善館，台北市士林區至善路二段250號。分館門口集合。');
  assert.equal(meet.mapsUrl, placeMapsUrl(place()));
  assert.equal(meet.mapsLabel, '在 Google 地圖打開至善館');
});

test('the sitting-down step lists the places to eat near the venue', () => {
  const sit = venueSteps(steps, place())[2];
  assert.equal(sit.do, '坐下來。');
  assert.deepEqual(sit.nearby, { title: '至善館附近吃飯喝咖啡', spots: place().food });
});

test('steps without a venue stop are left alone', () => {
  assert.deepEqual(venueSteps(steps, place())[1], steps[1]);
});

const TAICHUNG = { lat: 24.157647, lon: 120.648756 };
const XIUSHUI = { lat: 24.052925, lon: 120.512151 };
const KAOHSIUNG = { lat: 22.724156, lon: 120.319243 };

test('the nearest venue is picked by straight-line distance from where you are', () => {
  const places = [place({ id: 'xiushui', ...XIUSHUI }), place({ id: 'taichung', ...TAICHUNG }), place({ id: 'kaohsiung', ...KAOHSIUNG })];
  const nearTaichungCityHall = { lat: 24.1618, lon: 120.6469 };
  const { place: nearest, meters } = nearestPlace(places, nearTaichungCityHall);
  assert.equal(nearest.id, 'taichung');
  assert.ok(meters > 400 && meters < 600, `${meters} m`);
  assert.equal(nearestPlace(places, { lat: 22.63, lon: 120.3 }).place.id, 'kaohsiung');
});

test('distance reads in whole kilometres, or under 1 km when close', () => {
  assert.equal(distanceText(480), '直線不到 1 公里');
  assert.equal(distanceText(999), '直線約 1 公里');
  assert.equal(distanceText(8400), '直線約 8 公里');
  assert.equal(distanceText(123600), '直線約 124 公里');
});
