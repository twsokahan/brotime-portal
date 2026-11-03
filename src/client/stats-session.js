import { el } from './dom.js';
import { activityHref, ANSWER_ROWS, choiceCounts, NOT_ENOUGH_TEXT, shortDate } from './lib/stats-view.mjs';
import { whenSignedIn } from './signin.js';
import { activityIds, loadStats, NO_STATS_TEXT, OFFLINE_TEXT } from './stats-data.js';

const ACTIVITY_REL = '../../';
const status = document.querySelector('.stats-status');
const article = document.querySelector('.session');
const record = await whenSignedIn();

if (record.scope?.level === 'none') {
  status.textContent = NO_STATS_TEXT;
} else {
  const stats = await loadStats(record.email);
  const id = new URLSearchParams(location.search).get('id');
  const session = stats?.sessions.find((candidate) => candidate.id === id);
  if (!stats) status.textContent = OFFLINE_TEXT;
  else if (!session) status.textContent = '找不到這一場，可能不在你看得到的區。';
  else {
    status.hidden = true;
    article.replaceChildren(...renderSession(session));
    article.hidden = false;
  }
}

function barRow(label, count, total) {
  const bar = el('span', { className: 'bar' });
  bar.style.width = `${total ? Math.round((count / total) * 100) : 0}%`;
  return el('li', {}, [
    el('span', { className: 'bar-label', textContent: label }),
    el('span', { className: 'bar-count', textContent: `${count} 人` }),
    el('span', { className: 'bar-track' }, [bar]),
  ]);
}

function renderSession(session) {
  const href = activityHref(session.activity, activityIds(), ACTIVITY_REL);
  const heading = el('h1', {}, [href ? el('a', { href, textContent: session.activity }) : session.activity]);
  const meta = el('p', { className: 'lead', textContent: `${shortDate(session.date)}・${session.district}・${session.responses} 份問卷` });
  if (!session.enough) return [heading, meta, el('p', { textContent: NOT_ENOUGH_TEXT })];
  const answers = ANSWER_ROWS.map(({ key, label, choices }) => el('section', { className: 'answer' }, [
    el('h2', { textContent: label }),
    el('ul', { className: 'bars' }, choiceCounts(session.answers[key] ?? {}, choices).map(({ choice, count }) => barRow(choice, count, session.responses))),
  ]));
  const next = el('section', { className: 'answer' }, [
    el('h2', { textContent: '下一次想參加哪一種' }),
    session.next.length
      ? el('ul', { className: 'bars' }, session.next.map(({ name, count }) => barRow(name, count, session.responses)))
      : el('p', { textContent: '沒有人勾。' }),
  ]);
  return [heading, meta, ...answers, next];
}
