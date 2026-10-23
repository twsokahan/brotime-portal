import { bookRows, minuteText, positionAt } from './lib/route-book.mjs';
import { el, externalLink } from './dom.js';
import { createRouteMap, loadLeaflet } from './route-map.js';

const PLANNED_MINUTES = 60;
const ADJUST_NOTE = '路線是企劃室的建議，實地走過覺得不順，可以自己調整；事後的回報表會請你寫改了什麼、為什麼。';

let currentMap = null;
let renderCount = 0;

function lengthLine(route, flow) {
  const firstStop = flow.steps.find((step) => step.routeStop === 'stop1');
  return `全程約 ${(route.totalM / 1000).toFixed(1)} 公里・走路約 ${flow.walkMinutes} 分，中間停 ${firstStop.minutes} 分，整場大約 ${flow.totalMinutes} 分鐘`;
}

function rowView(row) {
  const classes = ['route-row', `route-row-${row.kind}`, row.kind === 'leg' ? `route-row-leg-${row.leg}` : ''];
  const item = el('li', { className: classes.join(' ').trim() }, [
    el('strong', { textContent: row.title }),
    row.via && el('span', { className: 'route-row-text', textContent: row.via }),
    row.detail && el('span', { className: 'route-row-text', textContent: row.detail }),
    row.streetViewUrl && externalLink('看街景', row.streetViewUrl, 'route-row-link'),
    row.navUrl && externalLink('在 Google 地圖看這一段', row.navUrl, 'route-row-link'),
  ]);
  item.dataset.minute = row.minute;
  return item;
}

function factsList(route) {
  const facts = [
    ['停車', route.parking],
    ['廁所', route.toilets],
    ['雨天備案', route.rainPlan],
    ['選配', route.optional],
  ];
  return el(
    'dl',
    { className: 'route-facts' },
    facts.flatMap(([label, value]) => [el('dt', { textContent: label }), el('dd', { textContent: value })]),
  );
}

function sliderView(total) {
  const slider = el('input', { className: 'route-slider', type: 'range', min: 0, max: total, step: 1, value: 0 });
  slider.setAttribute('aria-label', '第幾分鐘');
  const sixty = total > PLANNED_MINUTES && el('span', { className: 'route-sixty', textContent: String(PLANNED_MINUTES) });
  if (sixty) sixty.style.left = `${(PLANNED_MINUTES / total) * 100}%`;
  return { slider, wrap: el('div', { className: 'route-slider-wrap' }, [slider, sixty]) };
}

export function renderRouteBook(container, route, flow, { rel }) {
  currentMap?.remove();
  currentMap = null;
  const thisRender = ++renderCount;

  const mapBox = el('div', { className: 'route-map' });
  const { slider, wrap } = sliderView(flow.totalMinutes);
  const now = el('p', { className: 'route-now' });
  now.setAttribute('aria-live', 'polite');
  const rows = bookRows(route, flow).map(rowView);

  const update = () => {
    const minute = Number(slider.value);
    const { point, leg } = positionAt(route, flow, minute);
    currentMap?.moveDot(point);
    currentMap?.focusLeg(leg);
    now.textContent = minuteText(route, flow, minute);
    const current = rows.findLast((row) => Number(row.dataset.minute) <= minute);
    rows.forEach((row) => row.classList.toggle('is-now', row === current));
  };
  slider.addEventListener('input', update);
  rows.forEach((row) =>
    row.addEventListener('click', () => {
      slider.value = row.dataset.minute;
      update();
    }),
  );

  const children = [
    el('h3', { textContent: route.title }),
    el('p', { className: 'route-length', textContent: lengthLine(route, flow) }),
    flow.overtimeNote && el('p', { className: 'route-overtime', textContent: flow.overtimeNote }),
    mapBox,
    wrap,
    now,
    el('ol', { className: 'route-book' }, rows),
    factsList(route),
    el('p', { className: 'route-adjust', textContent: ADJUST_NOTE }),
  ];
  container.replaceChildren(...children.filter(Boolean));
  update();

  loadLeaflet(rel).then(
    (L) => {
      if (thisRender !== renderCount) return;
      currentMap = createRouteMap(mapBox, L, route);
      update();
    },
    () => {
      mapBox.hidden = true;
    },
  );
}
