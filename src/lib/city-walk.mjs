import { pathLength, pointAlong } from './geo.mjs';

const STORY_CARD_PATTERN = /故事卡\s*([A-Z])/;
const LEG_TEXTS_PATTERN = /第一段（約\d+分鐘）：(.+?)。第二段（約\d+分鐘）：(.+?)。/;
const WAYPOINT_FRACTIONS = [1 / 4, 2 / 4, 3 / 4];
const PARKING_CHECK_TAIL = /(汽車、)?機車停車位需實地確認$/;

const point = ({ name, lat, lon }) => ({ name, lat, lon });

const storyCardLetter = (suggestion) => STORY_CARD_PATTERN.exec(suggestion ?? '')?.[1] ?? null;

const parkingForHost = (parking) => parking.replace(PARKING_CHECK_TAIL, '$1機車停哪裡，建議事先到現場看一下');

const roundTo5 = (value) => Math.round(value * 1e5) / 1e5;
const coord = ([lat, lon]) => `${lat.toFixed(6)},${lon.toFixed(6)}`;

export function splitLegTexts(routeText) {
  const match = LEG_TEXTS_PATTERN.exec(routeText);
  return match ? [match[1], match[2]].map((text) => text.replaceAll('→', ' → ')) : null;
}

export function legNavUrl(from, path, to) {
  const length = pathLength(path);
  const waypoints = WAYPOINT_FRACTIONS.map((fraction) => coord(pointAlong(path, length * fraction)));
  return (
    'https://www.google.com/maps/dir/?api=1&travelmode=walking&dir_action=navigate' +
    `&origin=${coord([from.lat, from.lon])}&destination=${coord([to.lat, to.lon])}` +
    `&waypoints=${waypoints.join('%7C')}`
  );
}

export function streetViewUrl({ lat, lon }) {
  return `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lon}`;
}

function legTextsOf(raw) {
  const legTexts = splitLegTexts(raw.text.路線);
  if (!legTexts) throw new Error(`${raw.district} 的路線文字拆不出兩段`);
  return legTexts;
}

export function normalizeRoute(raw, circleName) {
  const { text, points } = raw;
  const [firstLegMinutes, secondLegMinutes] = raw.timeline.legMinutes;
  return {
    district: raw.district,
    circle: circleName,
    title: raw.title,
    meetingPoint: text.集合點,
    parking: parkingForHost(text.停車),
    routeText: text.路線,
    start: point(points.start),
    stop1: {
      ...point(points.stop1),
      place: text.停留點一,
      intro: text.介紹詞,
      storyCard: storyCardLetter(text.建議故事卡),
    },
    end: { ...point(points.end), place: text.終點 },
    returnText: text.回程,
    toilets: text.廁所,
    rainPlan: text.雨天備案,
    optional: text.選配,
    totalM: raw.totalM,
    legMinutes: [firstLegMinutes, secondLegMinutes],
    legMeters: raw.legs.map((leg) => leg.m),
    legPaths: raw.legs.map((leg) => leg.path.map(([lat, lon]) => [roundTo5(lat), roundTo5(lon)])),
    legTexts: legTextsOf(raw),
    legNavUrls: [
      legNavUrl(points.start, raw.legs[0].path, points.stop1),
      legNavUrl(points.stop1, raw.legs[1].path, points.end),
    ],
  };
}

export function districtLabel(id) {
  const [circle, place] = id.split('_');
  return place ? `${place}（${circle}）` : id;
}

export function walkingLink({ lat, lon }) {
  return `https://www.google.com/maps/dir/?api=1&travelmode=walking&destination=${lat},${lon}`;
}

const navigateTo = (target, mapsLabel) => ({ mapsUrl: walkingLink(target), mapsLabel });

const ROUTE_STOP_FIELDS = {
  start: (route) => ({
    place: `集合點：${route.meetingPoint}`,
    mapsUrl: route.legNavUrls[0],
    mapsLabel: `走到下一站：${route.stop1.name}`,
  }),
  stop1: (route) => ({
    place: `停在${route.stop1.place}`,
    readAloud: route.stop1.intro,
    cards: ['story'],
    cardIds: [route.stop1.storyCard],
    mapsUrl: route.legNavUrls[1],
    mapsLabel: `走到下一站：${route.end.name}`,
  }),
  end: (route) => ({
    place: `終點：${route.end.place}`,
    ...navigateTo(route.start, `回到集合點：${route.start.name}`),
  }),
};

function routeStopFields(step, route) {
  const { place, ...fields } = ROUTE_STOP_FIELDS[step.routeStop](route);
  return { ...fields, do: step.do ? `${place}。${step.do}` : place };
}

export function routeSteps(steps, route) {
  return steps.map((step) => ({
    ...step,
    ...(step.routeStop === undefined ? {} : routeStopFields(step, route)),
    ...(step.routeLeg === undefined ? {} : { minutes: route.legMinutes[step.routeLeg] }),
  }));
}
