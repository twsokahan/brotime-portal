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

const SIGNIN_PANEL = `<section class="signin" aria-live="polite">
<div data-view="start">
<h1>下個月，約兄弟做什麼？</h1>
<p>這裡是給各區帶兄弟時光的人用的。請用創價班通訊錄上登記的 Gmail 登入。</p>
<div class="signin-button"></div>
<p class="signin-line" hidden>在 LINE 裡沒辦法用 Google 登入。請點右上角「⋯」，選「用預設瀏覽器開啟」。</p>
<p class="signin-error" hidden></p>
<p class="signin-note">通訊錄上登記的不是 Gmail，或還沒登記？請你們區的區負責人在網站上把你的 Gmail 加進名單。</p>
</div>
<div data-view="not-listed" hidden>
<h1>這個帳號還不在名單上</h1>
<p>你登入的信箱是</p>
<p class="signin-email"></p>
<p>名單照創價班通訊錄。你也會帶兄弟時光的話，請把上面這個信箱傳給你們區的區負責人，請他在網站上把你加進名單。</p>
<div class="signin-actions"><button type="button" data-action="copy">複製這個信箱</button><button type="button" data-action="switch">換一個 Google 帳號</button></div>
<p class="signin-note">只是想看故事卡？主持人分享給你的故事卡連結，不用登入就能看。</p>
</div>
</section>`;

export const renderSigninPanel = () => SIGNIN_PANEL;

export const signinConfigScript = ({ clientId, endpoint }) =>
  `<script type="application/json" id="signin-config">${jsonForScript({ clientId, endpoint })}</script>`;
