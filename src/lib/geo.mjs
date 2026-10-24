const EARTH_RADIUS_M = 6371000;
const radians = (degrees) => (degrees * Math.PI) / 180;

export function distance([lat1, lon1], [lat2, lon2]) {
  const meanLat = radians((lat1 + lat2) / 2);
  return EARTH_RADIUS_M * Math.hypot(radians(lon2 - lon1) * Math.cos(meanLat), radians(lat2 - lat1));
}

export function pathLength(path) {
  let total = 0;
  for (let i = 1; i < path.length; i++) total += distance(path[i - 1], path[i]);
  return total;
}

export function pointAlong(path, meters) {
  if (meters <= 0) return [...path[0]];
  let walked = 0;
  for (let i = 1; i < path.length; i++) {
    const piece = distance(path[i - 1], path[i]);
    if (walked + piece >= meters) {
      const t = piece === 0 ? 0 : (meters - walked) / piece;
      const [lat1, lon1] = path[i - 1];
      const [lat2, lon2] = path[i];
      return [lat1 + (lat2 - lat1) * t, lon1 + (lon2 - lon1) * t];
    }
    walked += piece;
  }
  return [...path.at(-1)];
}
