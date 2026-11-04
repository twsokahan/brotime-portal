import { el } from './dom.js';
import {
  activityHref,
  districtsWithSessions,
  EMPTY_TEXT,
  reviewTitle,
  SAMPLE_SESSION,
  summaryLine,
  wantsCaption,
  wantsHeading,
} from './lib/stats-view.mjs';
import { reviewCard } from './review-card.js';
import { whenSignedIn } from './signin.js';
import { activityIndex, loadStats, OFFLINE_TEXT } from './stats-data.js';

const ALL = '';
const REL = '../';
const EMPTY_LEAD = '參加者問卷的結果，一場一張卡。';
const heading = document.querySelector('.stats-head h1');
const lead = document.querySelector('.stats-head .lead');
const status = document.querySelector('.stats-status');
const picker = document.querySelector('.stats-district');
const select = picker.querySelector('select');
const wantsBlock = document.querySelector('.review-wants');
const cards = document.querySelector('.review-cards');
const empty = document.querySelector('.review-empty');
const record = await whenSignedIn();
const index = activityIndex();

const title = reviewTitle(record.scope);
document.title = document.title.replace(heading.textContent, title);
heading.textContent = title;

const stats = await loadStats(record.email);
if (stats) {
  status.hidden = true;
  show(stats);
} else {
  status.textContent = OFFLINE_TEXT;
}

function chosenDistrict() {
  return new URLSearchParams(location.search).get('d') ?? ALL;
}

function remember(district) {
  const url = new URL(location.href);
  if (district) url.searchParams.set('d', district);
  else url.searchParams.delete('d');
  history.replaceState(history.state, '', url);
}

function show({ sessions, wants }) {
  if (!sessions.length) {
    showEmpty();
    return;
  }
  showWants(wants);
  const districts = districtsWithSessions(sessions, record.scope.districts);
  if (districts.length > 1) {
    select.replaceChildren(
      el('option', { value: ALL, textContent: '全部' }),
      ...districts.map((district) => el('option', { value: district, textContent: district })),
    );
    select.value = districts.includes(chosenDistrict()) ? chosenDistrict() : ALL;
    picker.hidden = false;
    select.addEventListener('change', () => {
      remember(select.value);
      showCards(sessions, select.value);
    });
  }
  showCards(sessions, districts.length > 1 ? select.value : ALL);
}

function showWants(wants) {
  if (!wants?.top?.length) return;
  wantsBlock.replaceChildren(
    el('h2', { textContent: wantsHeading(record.scope.level) }),
    el(
      'ol',
      {},
      wants.top.map(({ name, count }) => {
        const href = activityHref(name, index, REL);
        return el('li', {}, [href ? el('a', { href, textContent: name }) : name, el('span', { className: 'count', textContent: `・${count} 人` })]);
      }),
    ),
    el('p', { className: 'lead', textContent: wantsCaption(wants) }),
  );
  wantsBlock.hidden = false;
}

function sessionHref(id, district) {
  const query = new URLSearchParams({ id });
  if (district) query.set('d', district);
  return `session/?${query}`;
}

function showCards(sessions, district) {
  const shown = district ? sessions.filter((session) => session.district === district) : sessions;
  const showDistrict = !district && record.scope.districts.length > 1;
  lead.textContent = summaryLine(shown);
  cards.replaceChildren(...shown.map((session) => reviewCard(session, { index, rel: REL, showDistrict, href: sessionHref(session.id, district) })));
}

function showEmpty() {
  lead.textContent = EMPTY_LEAD;
  empty.replaceChildren(el('p', { textContent: EMPTY_TEXT }), reviewCard(SAMPLE_SESSION, { index, rel: REL, sample: true }));
  empty.hidden = false;
}
