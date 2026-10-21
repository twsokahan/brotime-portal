const STORY_CARD_PATTERN = /故事卡\s*([A-Z])/;

const point = ({ name, lat, lon }) => ({ name, lat, lon });

const storyCardLetter = (suggestion) => STORY_CARD_PATTERN.exec(suggestion ?? '')?.[1] ?? null;

export function normalizeRoute(raw, circleName) {
  const { text, points } = raw;
  const [firstLegMinutes, secondLegMinutes] = raw.timeline.legMinutes;
  return {
    district: raw.district,
    circle: circleName,
    title: raw.title,
    meetingPoint: text.集合點,
    parking: text.停車,
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
    googleRouteUrl: raw.google.open,
  };
}

export function walkingLink({ lat, lon }) {
  return `https://www.google.com/maps/dir/?api=1&travelmode=walking&destination=${lat},${lon}`;
}

const navigateTo = (target, mapsLabel) => ({ mapsUrl: walkingLink(target), mapsLabel });

const ROUTE_STOP_FIELDS = {
  start: (route) => ({
    place: `集合點：${route.meetingPoint}`,
    ...navigateTo(route.stop1, `走到下一站：${route.stop1.name}`),
  }),
  stop1: (route) => ({
    place: `停在${route.stop1.place}`,
    readAloud: route.stop1.intro,
    cards: ['story'],
    cardIds: [route.stop1.storyCard],
    ...navigateTo(route.end, `走到下一站：${route.end.name}`),
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
