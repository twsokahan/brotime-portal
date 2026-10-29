import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderActivityMain } from '../src/render/activity.mjs';
import { readyActivity, fixtureSite } from './fixtures/activities.mjs';

const REL = '../../';

const spot = (name, extra = {}) => ({
  name,
  what: '咖啡店，約 $200–400',
  hours: '週二～日 09:00–17:00，週一休',
  distance: '直線約 151 公尺',
  mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Slope',
  ...extra,
});

const venues = () => ({
  title: '選分館',
  prompt: '先選離你們最近的分館',
  intro: ['分館週一休館。', '距離是直線距離。'],
  link: { text: '創價美術館官網', url: 'https://www.sokaculture.org.tw/art-centers' },
  places: [
    {
      id: 'zhishan',
      name: '至善館',
      area: '台北士林',
      region: '北部',
      address: '台北市士林區至善路二段250號',
      transit: '捷運士林站轉公車',
      food: [spot('Slope Cafe', { why: '離館最近' })],
      walks: [spot('至善園')],
      cityWalks: [{ text: '士林區「士林官邸花園線」：捷運士林站集合。', cityWalkRoute: '士林區' }],
    },
    {
      id: 'taichung',
      name: '台中館',
      region: '中部',
      address: '台中市西屯區大容東街90號3樓',
      transit: '捷運綠線水安宮站',
      food: [spot('目覺咖啡')],
      walks: [],
      cityWalks: [],
      notes: ['停車資訊沒查到。'],
    },
  ],
});

const render = (activity) => renderActivityMain({ activity, site: fixtureSite(), rel: REL });

function withVenues() {
  const activity = readyActivity();
  activity.venues = venues();
  return activity;
}

function panel(html, id) {
  const at = html.indexOf(`id="venue-${id}"`);
  assert.ok(at >= 0, `expected the ${id} panel`);
  return html.slice(at, html.indexOf('</div>', at));
}

test('an activity without venues has no venue picker', () => {
  assert.ok(!render(readyActivity()).includes('class="venues"'));
});

test('the venue picker sits between the head and the flow, menu first and the fine print last', () => {
  const html = render(withVenues());
  const at = html.indexOf('<section class="venues">');
  assert.ok(at > html.indexOf('</header>'));
  assert.ok(at < html.indexOf('<section class="flow">'));
  assert.ok(html.includes('<h2>選分館</h2>\n<select id="venue"'));
  assert.ok(
    html.includes(
      '<div class="venues-intro"><p>分館週一休館。</p><p>距離是直線距離。</p>' +
        '<p><a href="https://www.sokaculture.org.tw/art-centers">創價美術館官網</a></p></div>\n</section>',
    ),
  );
});

test('the menu groups venues by region and names them with their area', () => {
  assert.ok(
    render(withVenues()).includes(
      '<select id="venue" aria-label="選分館"><option value="" disabled selected>先選離你們最近的分館</option>' +
        '<optgroup label="北部"><option value="zhishan">至善館（台北士林）</option></optgroup>' +
        '<optgroup label="中部"><option value="taichung">台中館</option></optgroup></select>',
    ),
  );
});

test('every venue panel starts hidden until one is picked', () => {
  const html = render(withVenues());
  assert.ok(html.includes('<div class="venue box" id="venue-zhishan" data-venue="zhishan" hidden>'));
  assert.ok(html.includes('<div class="venue box" id="venue-taichung" data-venue="taichung" hidden>'));
});

test('a venue panel gives the address with a map link and how to get there', () => {
  const html = panel(render(withVenues()), 'zhishan');
  const mapUrl = `https://www.google.com/maps/search/?api=1&amp;query=${encodeURIComponent('台北市士林區至善路二段250號')}`;
  assert.ok(html.includes(`<p>台北市士林區至善路二段250號 <a href="${mapUrl}">地圖</a></p>`));
  assert.ok(html.includes('<p>交通：捷運士林站轉公車</p>'));
});

test('places to eat and walk show their distance, hours and why, each linked to the map', () => {
  const html = panel(render(withVenues()), 'zhishan');
  assert.ok(
    html.includes(
      '<h4>吃飯喝咖啡</h4><ul class="spots"><li><p class="spot-name"><a href="https://www.google.com/maps/search/?api=1&amp;query=Slope">Slope Cafe</a><span>直線約 151 公尺</span></p>' +
        '<p>咖啡店，約 $200–400</p><p>營業：週二～日 09:00–17:00，週一休</p><p>離館最近</p></li></ul>',
    ),
  );
  assert.ok(html.includes('<h4>順路走走</h4><ul class="spots"><li><p class="spot-name"><a href="https://www.google.com/maps/search/?api=1&amp;query=Slope">至善園</a>'));
});

test('a venue links its nearby city walks to the route page', () => {
  const html = panel(render(withVenues()), 'zhishan');
  const routeUrl = `../../a/city-walk/?d=${encodeURIComponent('士林區')}`;
  assert.ok(html.includes(`<h4>城市散步</h4><ul class="venue-notes"><li>士林區「士林官邸花園線」：捷運士林站集合。 <a href="${routeUrl}">看路線</a></li></ul>`));
});

test('a venue without walks or city walks says there is no city walk nearby and lists its notes', () => {
  const html = panel(render(withVenues()), 'taichung');
  assert.ok(!html.includes('順路走走'));
  assert.ok(html.includes('<h4>城市散步</h4><ul class="venue-notes"><li>開車 15 分鐘內沒有城市散步路線。</li></ul>'));
  assert.ok(html.includes('<h4>出發前留意</h4><ul class="venue-notes"><li>停車資訊沒查到。</li></ul>'));
  assert.ok(!panel(render(withVenues()), 'zhishan').includes('出發前留意'));
});

test('venue text is escaped', () => {
  const activity = withVenues();
  activity.venues.places[0].food[0].name = '<b>Cafe</b>';
  const html = render(activity);
  assert.ok(html.includes('&lt;b&gt;Cafe&lt;/b&gt;'));
  assert.ok(!html.includes('<b>Cafe</b>'));
});

test('the live-mode data keeps the venues for the meeting and sitting-down steps', () => {
  const html = render(withVenues());
  const data = JSON.parse(html.match(/<script type="application\/json" id="activity-data">([\s\S]*?)<\/script>/)[1]);
  assert.deepEqual(data.venues.places.map((place) => place.id), ['zhishan', 'taichung']);
});

test('a flow note sits under the flow title', () => {
  const activity = withVenues();
  activity.flowNote = '先吃飯再看展也可以。';
  assert.ok(render(activity).includes('<h2>60 分鐘這樣過</h2>\n<p class="flow-note">先吃飯再看展也可以。</p>'));
  assert.ok(!render(readyActivity()).includes('flow-note'));
});
