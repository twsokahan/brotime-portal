import { el } from './dom.js';
import { activityHref, STATS_PATH, wantsCaption, wantsHeading, WANTS_NOT_ENOUGH_TEXT } from './lib/stats-view.mjs';
import { whenSignedIn } from './signin.js';
import { activityIds, loadStats } from './stats-data.js';

const block = document.querySelector('.district-wants');
const record = await whenSignedIn();
const level = record.scope?.level;

if (block && level && level !== 'none') {
  const stats = await loadStats(record.email);
  if (stats) show(stats.wants);
}

function wantsList(top) {
  const ids = activityIds();
  return el('ol', {}, top.map(({ name, count }) => {
    const href = activityHref(name, ids, '');
    return el('li', {}, [href ? el('a', { href, textContent: name }) : name, el('span', { className: 'count', textContent: `・${count} 人` })]);
  }));
}

function show(wants) {
  const children = [];
  if (wants && (level === 'district' || level === 'circle')) {
    children.push(el('h2', { textContent: wantsHeading(level) }));
    if (wants.enough && wants.top.length) children.push(wantsList(wants.top), el('p', { className: 'lead', textContent: wantsCaption(wants) }));
    else children.push(el('p', { className: 'lead', textContent: WANTS_NOT_ENOUGH_TEXT }));
  }
  children.push(el('p', { className: 'stats-link' }, [el('a', { href: STATS_PATH, textContent: '看每一場的回顧 →' })]));
  block.replaceChildren(...children);
  block.hidden = false;
}
