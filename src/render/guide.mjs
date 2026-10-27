import { guidePageUrl, shareFallbacks } from '../lib/share.mjs';
import { escapeHtml } from './html.mjs';

const renderSection = ({ heading, items }) =>
  `<section>
<h2>${escapeHtml(heading)}</h2>
<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
</section>`;

export function renderGuideMain({ activity, site, rel }) {
  const { title, intro, sections } = activity.guide;
  const { lineUrl } = shareFallbacks(title, guidePageUrl(site, activity.id));
  return `<article class="guide">
<p class="guide-kicker">${escapeHtml(activity.name)}・新手小抄</p>
<h1>${escapeHtml(title)}</h1>
${intro ? `<p class="guide-intro">${escapeHtml(intro)}</p>\n` : ''}${sections.map(renderSection).join('\n')}
</article>
<div class="share"><a href="${escapeHtml(lineUrl)}">分享到 LINE</a></div>
<div class="back"><a href="${rel}a/${escapeHtml(activity.id)}/">← 回到${escapeHtml(activity.name)}</a></div>`;
}
