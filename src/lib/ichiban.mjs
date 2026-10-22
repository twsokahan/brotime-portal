export const GRADES = Object.freeze(['A', 'B', 'C', 'D']);
export const MAX_TICKETS = 100;
export const MAX_PER_GRADE = 99;
export const STALE_AFTER_MS = 86_400_000;

const ROUND_VERSION = 1;
const UINT32_RANGE = 2 ** 32;

const byGrade = (valueOf) => Object.fromEntries(GRADES.map((grade) => [grade, valueOf(grade)]));
const trimmed = (text) => (text ?? '').trim();
const isPlainObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const isValidCount = (count) => Number.isInteger(count) && count >= 0 && count <= MAX_PER_GRADE;

export function ticketTotal(counts) {
  return GRADES.reduce((sum, grade) => sum + counts[grade], 0);
}

export function countsProblem(counts) {
  if (!GRADES.every((grade) => isValidCount(counts[grade]))) return 'bad-count';
  const total = ticketTotal(counts);
  if (total === 0) return 'empty';
  if (total > MAX_TICKETS) return 'too-many';
  return null;
}

export function shuffle(items, randomInt) {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function cryptoRandomInt(n) {
  const unbiasedLimit = UINT32_RANGE - (UINT32_RANGE % n);
  const value = new Uint32Array(1);
  do {
    globalThis.crypto.getRandomValues(value);
  } while (value[0] >= unbiasedLimit);
  return value[0] % n;
}

export function startRound({ counts, prizes, lastPrize }, randomInt, nowMs) {
  const tickets = GRADES.flatMap((grade) => Array(counts[grade]).fill(grade));
  return {
    version: ROUND_VERSION,
    counts: byGrade((grade) => counts[grade]),
    prizes: byGrade((grade) => trimmed(prizes?.[grade])),
    lastPrize: trimmed(lastPrize),
    seats: shuffle(tickets, randomInt),
    torn: tickets.map(() => false),
    updatedAt: nowMs,
  };
}

export function tearSeat(round, seatIndex, nowMs) {
  const inRow = Number.isInteger(seatIndex) && seatIndex >= 0 && seatIndex < round.seats.length;
  if (!inRow || round.torn[seatIndex]) return null;
  const torn = round.torn.map((isTorn, i) => isTorn || i === seatIndex);
  return {
    round: { ...round, torn, updatedAt: nowMs },
    grade: round.seats[seatIndex],
    isLast: torn.every(Boolean),
  };
}

export function remainingByGrade(round) {
  return byGrade((grade) => round.seats.filter((seat, i) => seat === grade && !round.torn[i]).length);
}

export function ticketsLeft(round) {
  return round.torn.filter((isTorn) => !isTorn).length;
}

export function isStale(round, nowMs) {
  return nowMs - round.updatedAt > STALE_AFTER_MS;
}

function isRound(value) {
  if (!isPlainObject(value) || value.version !== ROUND_VERSION) return false;
  const { counts, prizes, lastPrize, seats, torn, updatedAt } = value;
  return (
    isPlainObject(counts) &&
    countsProblem(counts) === null &&
    isPlainObject(prizes) &&
    GRADES.every((grade) => typeof prizes[grade] === 'string') &&
    typeof lastPrize === 'string' &&
    Array.isArray(seats) &&
    seats.every((seat) => GRADES.includes(seat)) &&
    GRADES.every((grade) => seats.filter((seat) => seat === grade).length === counts[grade]) &&
    Array.isArray(torn) &&
    torn.length === seats.length &&
    torn.every((isTorn) => typeof isTorn === 'boolean') &&
    Number.isFinite(updatedAt)
  );
}

export function parseSaved(text) {
  try {
    const saved = JSON.parse(text);
    return isRound(saved) ? saved : null;
  } catch {
    return null;
  }
}

export function settingsFrom(round, defaults) {
  if (!isRound(round)) return { counts: byGrade((grade) => defaults[grade]), prizes: byGrade(() => ''), lastPrize: '' };
  return {
    counts: byGrade((grade) => round.counts[grade]),
    prizes: byGrade((grade) => round.prizes[grade]),
    lastPrize: round.lastPrize,
  };
}
