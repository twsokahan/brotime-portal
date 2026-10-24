import { distance } from './geo.mjs';

export const venueLabel = ({ name, area }) => (area ? `${name}（${area}）` : name);

export const placeMapsUrl = ({ address }) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

export const placesByRegion = (places) =>
  [...Map.groupBy(places, (place) => place.region)].map(([region, inRegion]) => ({ region, places: inRegion }));

const VENUE_STOP_FIELDS = {
  meet: (place, step) => ({
    do: `地點：${place.name}，${place.address}。${step.do}`,
    mapsUrl: placeMapsUrl(place),
    mapsLabel: `在 Google 地圖打開${place.name}`,
  }),
  sit: (place) => ({ nearby: { title: `${place.name}附近吃飯喝咖啡`, spots: place.food } }),
};

export function venueSteps(steps, place) {
  if (!place) return steps;
  return steps.map((step) =>
    step.venueStop === undefined ? step : { ...step, ...VENUE_STOP_FIELDS[step.venueStop](place, step) },
  );
}

export function nearestPlace(places, { lat, lon }) {
  return places
    .map((place) => ({ place, meters: distance([lat, lon], [place.lat, place.lon]) }))
    .reduce((nearest, candidate) => (candidate.meters < nearest.meters ? candidate : nearest));
}

export const distanceText = (meters) => (meters < 500 ? '直線不到 1 公里' : `直線約 ${Math.round(meters / 1000)} 公里`);
