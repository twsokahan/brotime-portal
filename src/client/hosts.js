import { el } from './dom.js';
import { shortDate } from './lib/stats-view.mjs';
import { callApi, whenSignedIn } from './signin.js';
import { OFFLINE_TEXT } from './stats-data.js';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ADD_RESULTS = {
  added: '加好了，請他用這個 Gmail 登入。',
  'already-listed': '這個信箱已經在名單上了，直接登入就可以。',
  'bad-email': '這看起來不是信箱，再檢查一下。',
};
const form = document.querySelector('.host-form');
const result = form.querySelector('.host-result');
const submit = form.querySelector('button[type="submit"]');
const picker = document.querySelector('.stats-district');
const select = picker.querySelector('select');
const listSection = document.querySelector('.host-list');
const record = await whenSignedIn();
const districts = record.scope?.districts ?? [];

if (!districts.length) {
  form.replaceWith(el('p', { textContent: '加主持人要請你們區的區負責人幫忙。' }));
  listSection.hidden = true;
} else {
  if (districts.length > 1) {
    select.replaceChildren(...districts.map((district) => el('option', { value: district, textContent: district })));
    picker.hidden = false;
    select.addEventListener('change', loadHosts);
  }
  form.addEventListener('submit', addHost);
  loadHosts();
}

function currentDistrict() {
  return districts.length > 1 ? select.value : districts[0];
}

function hostRow({ email, name, addedOn }, district) {
  const remove = el('button', { type: 'button', textContent: '拿掉' });
  remove.addEventListener('click', async () => {
    remove.disabled = true;
    const response = await callApi('removeHost', { district, email });
    if (response?.ok) loadHosts();
    else remove.disabled = false;
  });
  const when = ISO_DATE.test(addedOn) ? `・${shortDate(addedOn)} 加` : '';
  return el('li', {}, [el('span', { textContent: `${name ? `${name}・` : ''}${email}${when}` }), remove]);
}

async function loadHosts() {
  const district = currentDistrict();
  const list = listSection.querySelector('ul');
  listSection.querySelector('h2').textContent = `${district}加過的人`;
  const response = await callApi('hosts', { district });
  if (district !== currentDistrict()) return;
  if (!response?.ok) {
    list.replaceChildren(el('li', { textContent: OFFLINE_TEXT }));
    return;
  }
  const rows = response.hosts.map((host) => hostRow(host, district));
  list.replaceChildren(...(rows.length ? rows : [el('li', { textContent: '這一區還沒有加過人。' })]));
}

async function addHost(event) {
  event.preventDefault();
  submit.disabled = true;
  result.textContent = '';
  const data = new FormData(form);
  const response = await callApi('addHost', { district: currentDistrict(), email: data.get('email'), name: data.get('name') });
  submit.disabled = false;
  const outcome = response?.ok ? (response.added ? 'added' : response.reason) : response?.error;
  result.textContent = ADD_RESULTS[outcome] ?? OFFLINE_TEXT;
  if (outcome === 'added') {
    form.reset();
    loadHosts();
  }
}
