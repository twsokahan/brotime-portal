import { el } from './dom.js';
import { signOutByUser, whenSignedIn } from './signin.js';

const foot = document.querySelector('.account-foot');
const record = await whenSignedIn();

if (foot) {
  const accountLine = el('p', { className: 'account-line' }, [
    `已用 ${record.email} 登入・`,
    el('button', { type: 'button', className: 'text-button', textContent: '登出', onclick: signOutByUser }),
  ]);
  foot.replaceChildren(accountLine);
  foot.hidden = false;
}
