import { el } from './dom.js';
import { activityCover, CARD_ROWS, choiceCounts, dayParts, personDots } from './lib/stats-view.mjs';

export function dotRow(counts, choices) {
  const label = choiceCounts(counts ?? {}, choices)
    .map(({ choice, count }) => `${choice} ${count}`)
    .join('・');
  return el(
    'span',
    { className: 'dots', role: 'img', ariaLabel: label },
    personDots(counts, choices).map((choiceIndex) => el('i', { className: `dot dot-${choiceIndex}` })),
  );
}

export function reviewCard(session, { index, rel, showDistrict = false, href = null, sample = false }) {
  const { day, weekday } = dayParts(session.date);
  const cover = activityCover(session.activity, index, rel);
  const title = showDistrict && session.district ? `${session.activity}・${session.district}` : session.activity;
  const children = [
    sample && el('span', { className: 'review-sample-tag', textContent: '範例' }),
    cover && el('img', { className: 'review-cover', src: cover, alt: '', loading: 'lazy' }),
    el('p', { className: 'review-day' }, [day, el('small', { textContent: weekday })]),
    el('p', { className: 'review-title' }, [title, el('small', { textContent: `${session.responses} 份問卷` })]),
    session.answers &&
      el(
        'dl',
        { className: 'review-rows' },
        CARD_ROWS.flatMap(({ key, label, choices }) => [
          el('dt', { textContent: label }),
          el('dd', {}, [dotRow(session.answers[key], choices)]),
        ]),
      ),
  ];
  const className = ['review-card', cover && 'has-cover', sample && 'is-sample'].filter(Boolean).join(' ');
  return href ? el('a', { className, href }, children) : el('div', { className }, children);
}
