import { el } from './dom.js';
import { STATS_PATH } from './lib/stats-view.mjs';
import { signOutByUser, whenSignedIn } from './signin.js';

const foot = document.querySelector('.account-foot');
const record = await whenSignedIn();
const seesStats = Boolean(record.scope?.level) && record.scope.level !== 'none';

if (foot) {
  const statsLink = el('p', { className: 'stats-link' }, [el('a', { href: STATS_PATH, textContent: '看每一場的回顧 →' })]);
  const accountLine = el('p', { className: 'account-line' }, [
    el('span', { textContent: `已用 ${record.email} 登入` }),
    el('button', { type: 'button', textContent: '登出', onclick: signOutByUser }),
  ]);
  foot.replaceChildren(...(seesStats ? [statsLink, accountLine] : [accountLine]));
  foot.hidden = false;
}
