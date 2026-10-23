import { KIDS, PLACE, SLOTS, INTERESTS } from './labels.mjs';

const MAX_PICKS = 3;
const FLEXIBLE = 'flexible';
const FIXED_SLOTS = ['weekend-day', 'weeknight', 'early-morning'];
const OPPOSITE_PLACE = { indoor: 'outdoor', outdoor: 'indoor' };
const KIDS_POINTS = { great: 2, ok: 1 };
const PLACE_POINTS = {
  indoor: { indoor: 2, both: 1 },
  outdoor: { outdoor: 2, both: 1 },
};
const MATCH_POINTS = 2;
const NO_MATCH_NOTE = '沒有剛好符合的，換個條件試試看。';
const DATED_LEAD_MONTHS = 2;

const twoDigits = (number) => String(number).padStart(2, '0');
const isoDate = (date) => `${date.getFullYear()}-${twoDigits(date.getMonth() + 1)}-${twoDigits(date.getDate())}`;

function isPlannableNow(availability, today) {
  if (!availability) return true;
  const endOfLeadWindow = new Date(today.getFullYear(), today.getMonth() + DATED_LEAD_MONTHS + 1, 0);
  return availability.from <= isoDate(endOfLeadWindow) && isoDate(today) <= availability.to;
}

function isExcluded(tags, answers) {
  if (answers.kids === 'yes' && tags.kids === 'no') return true;
  const slotMissed = !tags.slots.includes(answers.slot) && !tags.slots.includes(FLEXIBLE);
  if (FIXED_SLOTS.includes(answers.slot) && slotMissed) return true;
  return tags.place === OPPOSITE_PLACE[answers.place];
}

function hitsFor(tags, answers) {
  const hits = [];
  const kidsPoints = answers.kids === 'yes' ? KIDS_POINTS[tags.kids] : undefined;
  if (kidsPoints) hits.push({ points: kidsPoints, reason: KIDS[tags.kids] });
  if (tags.slots.includes(answers.slot)) {
    hits.push({ points: MATCH_POINTS, reason: answers.slot === FLEXIBLE ? '時間彈性' : SLOTS[answers.slot] });
  }
  const placePoints = PLACE_POINTS[answers.place]?.[tags.place];
  if (placePoints) hits.push({ points: placePoints, reason: PLACE[tags.place] });
  if (tags.interests.includes(answers.interest)) {
    hits.push({ points: MATCH_POINTS, reason: `喜歡${INTERESTS[answers.interest]}` });
  }
  return hits;
}

function noteFor(count) {
  if (count === 0) return NO_MATCH_NOTE;
  if (count < MAX_PICKS) return `符合的只有 ${count} 種，可以放寬條件再試一次。`;
  return null;
}

export function recommend(activities, answers, today = new Date()) {
  const picks = activities
    .filter(
      (activity) =>
        activity.status === 'ready' &&
        isPlannableNow(activity.availability, today) &&
        !isExcluded(activity.tags, answers),
    )
    .map((activity) => {
      const hits = hitsFor(activity.tags, answers);
      const score = hits.reduce((sum, hit) => sum + hit.points, 0);
      return { activity, score, reasons: hits.map((hit) => hit.reason) };
    })
    .sort((a, b) => b.score - a.score || a.activity.order - b.activity.order)
    .slice(0, MAX_PICKS)
    .map(({ activity, reasons }) => ({
      id: activity.id,
      name: activity.name,
      reasons,
      ...(activity.availability && { onlyDuring: activity.availability.label }),
    }));
  return { picks, note: noteFor(picks.length) };
}
