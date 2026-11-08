import { cardPageUrl, shareFallbacks } from '../lib/share.mjs';
import { renderBookGuide } from './book-guide.mjs';
import { escapeHtml } from './html.mjs';

const DEFAULT_QUESTIONS_HEADING = '分享提問';

function questionsSection(questions, heading) {
  if (!questions) return '';
  const items = questions.map((question) => `<li>${escapeHtml(question)}</li>`).join('\n');
  return `<section class="story-questions">
<h2>${escapeHtml(heading)}</h2>
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
  const questionsHeading = activity.storyReading?.questionsHeading ?? DEFAULT_QUESTIONS_HEADING;
  return `<article class="story-card">
<img class="card-front" src="${rel}cards/${escapeHtml(activity.id)}/${escapeHtml(card.id)}.webp" alt="${escapeHtml(card.title)}">
<h1>${escapeHtml(card.title)}</h1>
${questionsSection(card.questions, questionsHeading)}${noteSection(card.note)}${renderBookGuide(card.guide, activity.storyReading?.guideHeading)}</article>
<div class="share"><a href="${escapeHtml(lineUrl)}">分享到 LINE</a></div>
<div class="back"><a href="${rel}a/${escapeHtml(activity.id)}/">← 回到${escapeHtml(activity.name)}</a></div>`;
}
