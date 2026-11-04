import { parseSigninRecord, SIGNIN_STORAGE_KEY } from '../lib/signin.mjs';
import { jsonForScript } from './html.mjs';

// Runs before the body is drawn, so a page without a sign-in record never flashes its content.
function askToSignInWithoutRecord(key, parse) {
  try {
    if (parse(localStorage.getItem(key))) return;
  } catch {}
  document.documentElement.classList.add('signin-needed');
}

export const SIGNIN_HEAD_SCRIPT = `(${askToSignInWithoutRecord})(${JSON.stringify(SIGNIN_STORAGE_KEY)}, ${parseSigninRecord});`;

export const renderSigninPanel = ({ rel }) => `<section class="signin" aria-live="polite">
<div data-view="start">
<h1>每一場的回顧</h1>
<p>這頁是給區負責人和幹部看參加者問卷結果的。請用 Gmail 登入。</p>
<div class="signin-button"></div>
<p class="signin-line" hidden>在 LINE 裡沒辦法用 Google 登入。請點右上角「⋯」，選「用預設瀏覽器開啟」。</p>
<p class="signin-error" hidden></p>
</div>
<div data-view="not-listed" hidden>
<h1>這個帳號看不到問卷結果</h1>
<p>你登入的信箱是</p>
<p class="signin-email"></p>
<p>你是區負責人或幹部的話，請把上面這個信箱傳給你的圈負責人。</p>
<div class="signin-actions"><button type="button" data-action="copy">複製這個信箱</button><button type="button" data-action="switch">換一個 Google 帳號</button></div>
<p class="home-link"><a href="${rel}">← 回到首頁</a></p>
</div>
</section>`;

export const signinConfigScript = ({ clientId, endpoint }) =>
  `<script type="application/json" id="signin-config">${jsonForScript({ clientId, endpoint })}</script>`;
