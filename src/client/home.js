import { isShowing, localIsoDate } from './lib/featured.mjs';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const previewDate = new URLSearchParams(location.search).get('today');
const today = ISO_DATE.test(previewDate ?? '') ? previewDate : localIsoDate();

const sections = [...document.querySelectorAll('[data-show-from]')];
for (const section of sections) {
  section.hidden = !isShowing({ from: section.dataset.showFrom, to: section.dataset.showTo }, today);
}

if (sections.every((section) => section.hidden)) {
  location.replace(document.querySelector('.all-link a').href);
}
