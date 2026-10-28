import { BOOKS_HEADING, GUIDE_HEADING, SERIES, bookTitle, booksPlan, guideRows, readingSlots } from '../lib/book-guide.mjs';
import { escapeHtml } from './html.mjs';

const renderRow = ({ label, text, note }) =>
  `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(text)}${note ? ` <small>（${escapeHtml(note)}）</small>` : ''}</dd></div>`;

export function renderBookGuide(guide) {
  return `<section class="book-guide">
<h2>${GUIDE_HEADING}</h2>
<p class="book-guide-series">${SERIES}</p>
<p class="book-guide-book">${escapeHtml(bookTitle(guide))}</p>
<p class="book-guide-page"><small>約第 </small>${escapeHtml(String(guide.page))}<small> 頁</small></p>
<dl class="book-guide-rows">
${guideRows(guide).map(renderRow).join('\n')}
</dl>
<ul class="book-guide-tips">${guide.tips.map((tip) => `<li>${escapeHtml(tip)}</li>`).join('')}</ul>
</section>
`;
}

const renderBookRow = ({ cards, link, volume, chapters, role }) =>
  `<li><b>${escapeHtml(cards)}</b> ${link}<strong>${escapeHtml(volume)}</strong>${escapeHtml(chapters)}${role ? `<em>${escapeHtml(role)}</em>` : ''}</li>`;

const paragraph = (className, text) => (text ? `\n<p class="${className}">${escapeHtml(text)}</p>` : '');

export function renderBooks(activity) {
  const plan = booksPlan(readingSlots(activity.steps, activity.cardSets));
  if (!plan) return '';
  const rows = plan.rows.length ? `\n<ul class="books-rows">${plan.rows.map(renderBookRow).join('')}</ul>` : '';
  return `<section class="books" id="books" aria-labelledby="books-title">
<h2 id="books-title">${BOOKS_HEADING}</h2>${paragraph('books-lead', plan.lead)}
${plan.heads.map((head) => `<p class="books-head">${escapeHtml(head)}</p>`).join('\n')}${paragraph('books-intro', plan.intro)}${rows}${paragraph('books-pending', plan.pending)}${paragraph('books-note', plan.note)}
</section>`;
}
