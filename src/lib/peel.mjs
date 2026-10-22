const REST_PULL = 2;
const TAB_OVERHANG = 20;
const FLAP_MARGIN = Object.freeze({ left: 30, top: 12, right: 40, bottom: 12 });
const FLAP_ROOM = 24;
const STAGE_ROOM = 10;
const AUTO_TEAR_LIFT = 70;
const FINISH_LIFT = Object.freeze({ least: 30, share: 0.4 });

const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
const lerp = (from, to, progress) => [from[0] + (to[0] - from[0]) * progress, from[1] + (to[1] - from[1]) * progress];
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const openPoint = ({ length, height }) => [2 * length, height / 2];

function polygonArea(polygon) {
  const twice = polygon.reduce((sum, [x, y], i) => {
    const [nextX, nextY] = polygon[(i + 1) % polygon.length];
    return sum + x * nextY - nextX * y;
  }, 0);
  return Math.abs(twice) / 2;
}

function flapBox({ length, height }) {
  const { left, top, right, bottom } = FLAP_MARGIN;
  return [
    [-left, -top],
    [length + right, -top],
    [length + right, height + bottom],
    [-left, height + bottom],
  ];
}

export function limitPull(a, target, { maxAngle, maxLength }) {
  const pull = [target[0] - a[0], target[1] - a[1]];
  if (pull[0] <= 0) return [...a];
  const angle = clamp(Math.atan2(pull[1], pull[0]), -maxAngle, maxAngle);
  const length = Math.min(maxLength, Math.hypot(pull[0], pull[1]));
  return [a[0] + length * Math.cos(angle), a[1] + length * Math.sin(angle)];
}

export function clipHalfPlane(polygon, point, normal, keepPositive) {
  const sign = keepPositive ? 1 : -1;
  const side = ([x, y]) => sign * dot([x - point[0], y - point[1]], normal);
  const kept = [];
  polygon.forEach((vertex, i) => {
    const next = polygon[(i + 1) % polygon.length];
    const here = side(vertex);
    const there = side(next);
    if (here >= 0) kept.push(vertex);
    if (here >= 0 !== there >= 0) kept.push(lerp(vertex, next, here / (here - there)));
  });
  return kept;
}

export function foldSegment(midpoint, direction, { left, top, right, bottom }) {
  let from = -Infinity;
  let to = Infinity;
  for (const [axis, low, high] of [
    [0, left, right],
    [1, top, bottom],
  ]) {
    const step = direction[axis];
    const start = midpoint[axis];
    if (Math.abs(step) < 1e-9) {
      if (start < low || start > high) return null;
      continue;
    }
    const [enter, leave] = [(low - start) / step, (high - start) / step].sort((p, q) => p - q);
    from = Math.max(from, enter);
    to = Math.min(to, leave);
  }
  if ((to - from) * Math.hypot(direction[0], direction[1]) < 1) return null;
  const at = (t) => [midpoint[0] + direction[0] * t, midpoint[1] + direction[1] * t];
  return [at(from), at(to)];
}

export function peeledFraction(peeledPolygon, { left, top, right, bottom }) {
  const edges = [
    [[left, 0], [1, 0]],
    [[right, 0], [-1, 0]],
    [[0, top], [0, 1]],
    [[0, bottom], [0, -1]],
  ];
  const onStrip = edges.reduce((polygon, [point, normal]) => clipHalfPlane(polygon, point, normal, true), peeledPolygon);
  return polygonArea(onStrip) / ((right - left) * (bottom - top));
}

export function peelLayout(a, q, size) {
  const { length, height } = size;
  const box = flapBox(size);
  const pull = [q[0] - a[0], q[1] - a[1]];
  if (Math.hypot(pull[0], pull[1]) < REST_PULL) return { front: box, back: null, curl: null, peeled: 0 };
  const mid = [(a[0] + q[0]) / 2, (a[1] + q[1]) / 2];
  const angle = Math.atan2(pull[1], pull[0]);
  const flap = clipHalfPlane(box, mid, pull, false);
  const fold = foldSegment(mid, [-Math.sin(angle), Math.cos(angle)], {
    left: -TAB_OVERHANG,
    top: 0,
    right: length,
    bottom: height,
  });
  return {
    front: clipHalfPlane(box, mid, pull, true),
    back: {
      left: 2 * mid[0] - length,
      clip: flap.map(([x, y]) => [length - x, y]),
      origin: [length - mid[0], mid[1]],
      rotation: 2 * angle,
    },
    curl: fold && {
      from: fold[0],
      length: Math.hypot(fold[1][0] - fold[0][0], fold[1][1] - fold[0][1]),
      rotation: angle,
    },
    peeled: peeledFraction(flap, { left: 0, top: 0, right: length, bottom: height }),
  };
}

export function autoTearAt(progress, size) {
  const [openX, openY] = openPoint(size);
  return [openX * progress, openY - AUTO_TEAR_LIFT * Math.sin(Math.PI * progress)];
}

export function finishAt(start, progress, size) {
  const end = openPoint(size);
  const lift = Math.max(FINISH_LIFT.least, end[1] - start[1]) * FINISH_LIFT.share;
  const [x, y] = lerp(start, end, progress);
  return [x, y - lift * Math.sin(Math.PI * progress)];
}

export function keepFlapInView(q, { stripLeft, stageWidth }) {
  return Math.min(0, stageWidth - STAGE_ROOM - (stripLeft + q[0] + FLAP_ROOM));
}

export function centredShift({ stripLeft, length, stageWidth }) {
  return (stageWidth - length) / 2 - (stripLeft + length);
}
