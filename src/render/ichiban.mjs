import { escapeHtml, jsonForScript } from './html.mjs';

const NO_SCRIPT_LINE = '這個瀏覽器沒有開 JavaScript，電子一番賞用不了；換一個瀏覽器，或改用實體刮刮卡。';

export function renderIchibanMain({ activity, rel }) {
  const data = { activityId: activity.id, name: activity.name, defaults: activity.ichiban.grades };
  return `<div id="ichiban-app"></div>
<noscript><p>${NO_SCRIPT_LINE}</p></noscript>
<script type="application/json" id="ichiban-data">${jsonForScript(data)}</script>
<div class="back"><a href="${rel}a/${escapeHtml(activity.id)}/">← 回到${escapeHtml(activity.name)}</a></div>`;
}
