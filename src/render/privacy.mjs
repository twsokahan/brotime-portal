import { renderSection } from './guide.mjs';
import { escapeHtml } from './html.mjs';

export const PRIVACY_PATH = 'privacy/';

const SECTIONS = [
  {
    heading: '登入時拿到什麼',
    items: ['你 Google 帳號的信箱和名字。', '拿不到你的密碼、聯絡人、信件或雲端硬碟。'],
  },
  {
    heading: '拿來做什麼',
    items: [
      '比對你的信箱在不在名單上：創價班通訊錄和男子部幹部名單。',
      '依你負責的區或圈，顯示大家填問卷的統計。',
    ],
  },
  {
    heading: '存在哪裡、誰看得到',
    items: [
      '名單和問卷回覆放在 Google 試算表，只有負責的幹部看得到。',
      '登入狀態只存在你這支手機或這台電腦的瀏覽器裡，登出就清掉。',
      '不寄廣告、不交給別人，也不會公開在網站上。',
    ],
  },
];

export function renderPrivacyMain({ siteTitle, rel }) {
  return `<article class="guide">
<p class="guide-kicker">${escapeHtml(siteTitle)}</p>
<h1>隱私權說明</h1>
<p class="guide-intro">這個網站只有「每一場的回顧」要用 Google 帳號登入，讓區負責人和幹部看參加者問卷的結果。下面說明登入後網站拿到什麼、怎麼用。</p>
${SECTIONS.map(renderSection).join('\n')}
</article>
<div class="back"><a href="${rel}">← 回到首頁</a></div>`;
}
