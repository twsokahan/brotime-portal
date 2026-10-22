import { cardPageUrl, shareFallbacks } from '../lib/share.mjs';
import { escapeHtml } from './html.mjs';

function questionsSection(questions) {
  if (!questions) return '';
  const items = questions.map((question) => `<li>${escapeHtml(question)}</li>`).join('\n');
  return `<section class="story-questions">
<h2>分享提問</h2>
<ol>
${items}
</ol>
</section>
`;
}

function noteSection(note) {
  if (!note) return '';
  return `<section class="story-questions">
<h2>${escapeHtml(note.label)}</h2>
<p>${escapeHtml(note.text)}</p>
</section>
`;
}

export function renderCardMain({ activity, card, site, rel }) {
  const { lineUrl } = shareFallbacks(card.title, cardPageUrl(site, activity.id, card.id));
  const paragraphs = card.text
    .split('\n\n')
    .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
    .join('\n');
  return `<article class="story-card">
<img class="card-front" src="${rel}cards/${escapeHtml(activity.id)}/${escapeHtml(card.id)}.webp" alt="${escapeHtml(card.title)}">
<h1>${escapeHtml(card.title)}</h1>
${paragraphs}
<footer class="source">出處：${escapeHtml(card.source)}</footer>
${questionsSection(card.questions)}${noteSection(card.note)}</article>
<div class="share"><a href="${escapeHtml(lineUrl)}">分享到 LINE</a></div>
<div class="back"><a href="${rel}a/${escapeHtml(activity.id)}/">← 回到${escapeHtml(activity.name)}</a></div>`;
}
