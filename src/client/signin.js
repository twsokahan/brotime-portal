import {
  isInLine,
  needsRecheck,
  parseSigninRecord,
  recheckOutcome,
  recordFrom,
  SIGN_OUT_ERRORS,
  SIGNIN_STORAGE_KEY,
} from './lib/signin.mjs';

const GOOGLE_SCRIPT = 'https://accounts.google.com/gsi/client';
const root = document.documentElement;
const panel = document.querySelector('.signin');
const config = JSON.parse(document.getElementById('signin-config').textContent);
const startView = panel.querySelector('[data-view="start"]');
const notListedView = panel.querySelector('[data-view="not-listed"]');
const errorLine = panel.querySelector('.signin-error');
const buttonBox = panel.querySelector('.signin-button');

function readRecord() {
  try {
    return parseSigninRecord(localStorage.getItem(SIGNIN_STORAGE_KEY));
  } catch {
    return null;
  }
}

function saveRecord(value) {
  try {
    localStorage.setItem(SIGNIN_STORAGE_KEY, JSON.stringify(value));
  } catch {}
}

function clearRecord() {
  try {
    localStorage.removeItem(SIGNIN_STORAGE_KEY);
  } catch {}
}

let record = readRecord();
let wasSignedIn = Boolean(record);
let resolveSignedIn;
const signedIn = new Promise((resolve) => {
  resolveSignedIn = resolve;
});
if (record) resolveSignedIn(record);

export const whenSignedIn = () => signedIn;

export async function callApi(action, body = {}) {
  let response;
  try {
    const reply = await fetch(config.endpoint, { method: 'POST', body: JSON.stringify({ action, session: record?.session, ...body }) });
    response = await reply.json();
  } catch {
    return null;
  }
  if (response && !response.ok && SIGN_OUT_ERRORS.includes(response.error)) signOut();
  return response;
}

function showError(text) {
  errorLine.textContent = text;
  errorLine.hidden = !text;
}

function showView(view) {
  startView.hidden = view !== startView;
  notListedView.hidden = view !== notListedView;
}

let googleReady = null;

function loadGoogle() {
  googleReady ??= new Promise((resolve, reject) => {
    const script = Object.assign(document.createElement('script'), { src: GOOGLE_SCRIPT, async: true });
    script.onload = () => {
      google.accounts.id.initialize({ client_id: config.clientId, callback: onCredential });
      resolve();
    };
    script.onerror = () => {
      googleReady = null;
      reject(new Error('Google sign-in script did not load'));
    };
    document.head.append(script);
  });
  return googleReady;
}

const GOOGLE_BUTTON_MAX_WIDTH = 400;

function renderGoogleButton() {
  buttonBox.replaceChildren();
  google.accounts.id.renderButton(buttonBox, {
    theme: 'filled_black',
    shape: 'pill',
    size: 'large',
    text: 'signin_with',
    locale: 'zh-TW',
    width: Math.min(buttonBox.clientWidth || GOOGLE_BUTTON_MAX_WIDTH, GOOGLE_BUTTON_MAX_WIDTH),
  });
}

function showStart() {
  showView(startView);
  showError('');
  if (isInLine(navigator.userAgent)) {
    panel.querySelector('.signin-line').hidden = false;
    buttonBox.hidden = true;
    return;
  }
  loadGoogle().then(renderGoogleButton, () => showError('連不上 Google，請確認網路後重新整理。'));
}

function showNotListed(email) {
  panel.querySelector('.signin-email').textContent = email;
  panel.querySelector('[data-action="copy"]').textContent = '複製這個信箱';
  showView(notListedView);
}

function signOut() {
  record = null;
  clearRecord();
  root.classList.add('signin-needed');
  showStart();
}

export function signOutByUser() {
  if (window.google?.accounts) google.accounts.id.disableAutoSelect();
  signOut();
}

function finishSignIn(newRecord) {
  record = newRecord;
  saveRecord(record);
  // Scripts on this page already started with the old record; starting over is simpler than re-running them.
  if (wasSignedIn) {
    location.reload();
    return;
  }
  wasSignedIn = true;
  root.classList.remove('signin-needed');
  resolveSignedIn(record);
}

async function onCredential({ credential }) {
  showError('');
  const response = await callApi('signIn', { idToken: credential });
  if (response?.ok && response.listed) finishSignIn(recordFrom(response, response.session, Date.now()));
  else if (response?.ok) showNotListed(response.email);
  else showError('登入沒有成功，請再試一次。');
}

async function copyEmail(button) {
  try {
    await navigator.clipboard.writeText(panel.querySelector('.signin-email').textContent);
    button.textContent = '複製好了';
  } catch {
    getSelection().selectAllChildren(panel.querySelector('.signin-email'));
  }
}

function switchAccount() {
  if (window.google?.accounts) google.accounts.id.disableAutoSelect();
  showStart();
}

async function recheck() {
  const response = await callApi('me');
  const outcome = recheckOutcome(response);
  if (outcome === 'update') {
    record = recordFrom(response, record.session, Date.now());
    saveRecord(record);
  } else if (outcome === 'sign-out') {
    signOut();
  }
}

panel.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action]');
  if (button?.dataset.action === 'copy') copyEmail(button);
  if (button?.dataset.action === 'switch') switchAccount();
});

if (root.classList.contains('signin-needed')) showStart();
else if (record && needsRecheck(record, Date.now()) && navigator.onLine) recheck();
