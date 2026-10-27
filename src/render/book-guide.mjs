import { GUIDE_HEADING, SERIES, bookTitle, guideRows } from '../lib/book-guide.mjs';
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
