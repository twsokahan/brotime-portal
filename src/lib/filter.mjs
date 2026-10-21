const KID_FRIENDLY = ['great', 'ok'];
const RAIN_FRIENDLY = ['ok', 'move'];

export function emptyFilters() {
  return { kids: false, indoor: false, outdoor: false, rainOk: false, slots: [], interests: [] };
}

const sharesAny = (wanted, tagged) => wanted.length === 0 || wanted.some((value) => tagged.includes(value));

function placeMatches(place, { indoor, outdoor }) {
  if (indoor === outdoor) return true;
  return place === 'both' || place === (indoor ? 'indoor' : 'outdoor');
}

export function matchesFilters(activity, filters) {
  const { tags } = activity;
  if (!tags) return false;
  return (
    (!filters.kids || KID_FRIENDLY.includes(tags.kids)) &&
    placeMatches(tags.place, filters) &&
    (!filters.rainOk || RAIN_FRIENDLY.includes(tags.rain)) &&
    sharesAny(filters.slots, tags.slots) &&
    sharesAny(filters.interests, tags.interests)
  );
}

export function countMatches(activities, filters) {
  return activities.filter((activity) => activity.status === 'ready' && matchesFilters(activity, filters)).length;
}

const MATCHING = 0;
const NOT_MATCHING = 1;
const PREPARING = 2;

function wallRank(activity, filters) {
  if (activity.status !== 'ready') return PREPARING;
  return matchesFilters(activity, filters) ? MATCHING : NOT_MATCHING;
}

export function wallOrder(activities, filters) {
  return activities
    .map((activity) => ({ id: activity.id, order: activity.order, rank: wallRank(activity, filters) }))
    .sort((a, b) => a.rank - b.rank || a.order - b.order)
    .map(({ id }) => id);
}
