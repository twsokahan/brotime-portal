import { el } from './dom.js';
import { shortDate } from './lib/stats-view.mjs';
import { whenSignedIn } from './signin.js';
import { loadStats, OFFLINE_TEXT } from './stats-data.js';

const ALL = '';
const status = document.querySelector('.stats-status');
const list = document.querySelector('.stats-list');
const picker = document.querySelector('.stats-district');
const select = picker.querySelector('select');
const record = await whenSignedIn();

const stats = await loadStats(record.email);
if (stats) show(stats.sessions, record.scope.districts);
else status.textContent = OFFLINE_TEXT;

function chosenDistrict() {
  return new URLSearchParams(location.search).get('d') ?? ALL;
}

function remember(district) {
  const url = new URL(location.href);
  if (district) url.searchParams.set('d', district);
  else url.searchParams.delete('d');
  history.replaceState(history.state, '', url);
}

function show(sessions, districts) {
  if (districts.length > 1) {
    select.replaceChildren(
      el('option', { value: ALL, textContent: '全部' }),
      ...districts.map((district) => el('option', { value: district, textContent: district })),
    );
    select.value = districts.includes(chosenDistrict()) ? chosenDistrict() : ALL;
    picker.hidden = false;
    select.addEventListener('change', () => {
      remember(select.value);
      renderList(sessions, select.value);
    });
  }
  renderList(sessions, districts.length > 1 ? select.value : ALL);
}

function renderList(sessions, district) {
  const shown = district ? sessions.filter((session) => session.district === district) : sessions;
  status.textContent = shown.length ? '' : '還沒有問卷回覆。參加者填了問卷，這裡就會出現。';
  status.hidden = shown.length > 0;
  list.replaceChildren(...shown.map((session) => el('li', {}, [
    el('a', { href: `session/?id=${encodeURIComponent(session.id)}`, textContent: `${shortDate(session.date)} ${session.activity}・${session.district}` }),
    el('small', { textContent: `${session.responses} 份問卷` }),
  ])));
}
