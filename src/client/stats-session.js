import { el } from './dom.js';
import { activityCover, activityHref, ANSWER_ROWS, choiceCounts, dayParts, reviewTitle } from './lib/stats-view.mjs';
import { dotRow } from './review-card.js';
import { whenSignedIn } from './signin.js';
import { activityIndex, loadStats, OFFLINE_TEXT } from './stats-data.js';

const REL = '../../';
const status = document.querySelector('.stats-status');
const article = document.querySelector('.session');
const back = document.querySelector('.review-back');
const params = new URLSearchParams(location.search);
const record = await whenSignedIn();
const index = activityIndex();

back.textContent = `← ${reviewTitle(record.scope)}`;
if (params.get('d')) back.href = `${back.getAttribute('href')}?${new URLSearchParams({ d: params.get('d') })}`;

const stats = await loadStats(record.email);
const session = stats?.sessions.find((candidate) => candidate.id === params.get('id'));
if (!stats) status.textContent = OFFLINE_TEXT;
else if (!session) status.textContent = '找不到這一場，可能不在你看得到的區。';
else {
  status.hidden = true;
  article.replaceChildren(...renderSession(session));
  article.hidden = false;
}

function activityName(name) {
  const href = activityHref(name, index, REL);
  return href ? el('a', { href, textContent: name }) : el('span', { textContent: name });
}

function hero(session) {
  const cover = activityCover(session.activity, index, REL);
  const { day, weekday } = dayParts(session.date);
  return el('header', { className: cover ? 'session-hero has-cover' : 'session-hero' }, [
    cover && el('img', { className: 'session-cover', src: cover, alt: '' }),
    el('p', { className: 'session-day' }, [day, el('small', { textContent: weekday })]),
    el('h1', {}, [activityName(session.activity)]),
    el('p', { className: 'lead', textContent: `${session.district}・${session.responses} 份參加者問卷` }),
  ]);
}

function answerSection({ label, choices }, counts) {
  return el('section', { className: 'answer' }, [
    el('h2', { textContent: label }),
    dotRow(counts, choices),
    el(
      'p',
      { className: 'answer-counts' },
      choiceCounts(counts, choices).map(({ choice, count }, choiceIndex) =>
        el('span', {}, [el('i', { className: `dot dot-${choiceIndex}` }), `${choice} ${count}`]),
      ),
    ),
  ]);
}

function nextRow({ name, count }) {
  const cover = activityCover(name, index, REL);
  return el('li', {}, [
    cover ? el('img', { src: cover, alt: '', loading: 'lazy' }) : el('span', { className: 'next-no-cover' }),
    activityName(name),
    dotRow({ [name]: count }, [name]),
  ]);
}

function renderSession(session) {
  if (!session.answers) return [hero(session)];
  const next = el('section', { className: 'answer' }, [
    el('h2', { textContent: '下一次想參加哪一種' }),
    session.next.length ? el('ul', { className: 'next-list' }, session.next.map(nextRow)) : el('p', { textContent: '沒有人勾。' }),
  ]);
  return [hero(session), ...ANSWER_ROWS.map((row) => answerSection(row, session.answers[row.key] ?? {})), next];
}
