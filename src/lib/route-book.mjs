import { streetViewUrl } from './city-walk.mjs';
import { pathLength, pointAlong } from './geo.mjs';

const LEG_NAMES = ['第一段', '第二段'];
const LEG_DESTINATIONS = ['停留點一', '終點'];

const stopPoint = (route, stop) => [route[stop].lat, route[stop].lon];
const endCardOf = (flow) => flow.steps.find((step) => step.routeStop === 'end').cardIds[0];
const km = (meters) => `${(meters / 1000).toFixed(1)} 公里`;

function stopRow(route, step, flow) {
  const base = { kind: 'stop', stop: step.routeStop, minute: step.from, streetViewUrl: streetViewUrl(route[step.routeStop]) };
  if (step.routeStop === 'start') return { ...base, title: `集合：${route.meetingPoint}`, detail: null };
  if (step.routeStop === 'stop1') {
    return {
      ...base,
      title: `停留點一：${route.stop1.place}`,
      detail: `念故事卡 ${route.stop1.storyCard}，停 ${step.minutes} 分`,
    };
  }
  return { ...base, title: `終點：${route.end.place}`, detail: `念故事卡 ${endCardOf(flow)}、分享感動` };
}

function legRow(route, step) {
  const leg = step.routeLeg;
  return {
    kind: 'leg',
    leg,
    minute: step.from,
    title: `${LEG_NAMES[leg]}　約 ${route.legMinutes[leg]} 分・${km(route.legMeters[leg])}`,
    via: route.legTexts[leg],
    navUrl: route.legNavUrls[leg],
  };
}

export function bookRows(route, flow) {
  return flow.steps.map((step) => {
    if (step.routeStop !== undefined) return stopRow(route, step, flow);
    if (step.routeLeg !== undefined) return legRow(route, step);
    return { kind: 'wrap', minute: step.from, title: `收尾，約第 ${flow.totalMinutes} 分結束`, detail: route.returnText };
  });
}

function stepAt(flow, minute) {
  return flow.steps.find((step) => minute >= step.from && minute < step.to) ?? flow.steps.at(-1);
}

const metersWalked = (route, step, minute) =>
  (pathLength(route.legPaths[step.routeLeg]) * (minute - step.from)) / (step.to - step.from);

export function positionAt(route, flow, minute) {
  const step = stepAt(flow, minute);
  if (step.routeLeg !== undefined) {
    return { point: pointAlong(route.legPaths[step.routeLeg], metersWalked(route, step, minute)), leg: step.routeLeg };
  }
  return { point: stopPoint(route, step.routeStop ?? 'end'), leg: null };
}

export function minuteText(route, flow, minute) {
  const prefix = `第 ${minute} 分　`;
  if (minute >= flow.totalMinutes) return `${prefix}結束。`;
  const step = stepAt(flow, minute);
  if (step.routeLeg !== undefined) {
    const walked = Math.round(metersWalked(route, step, minute) / 10) * 10;
    return `${prefix}${LEG_NAMES[step.routeLeg]}，走了約 ${walked} 公尺，再約 ${step.to - minute} 分到${LEG_DESTINATIONS[step.routeLeg]}。`;
  }
  if (step.routeStop === 'start') return `${prefix}在集合點等人到齊、說明路線。`;
  if (step.routeStop === 'stop1') return `${prefix}在停留點一念故事卡 ${route.stop1.storyCard}。`;
  if (step.routeStop === 'end') return `${prefix}在終點念故事卡 ${endCardOf(flow)}、分享感動。`;
  return `${prefix}收尾，第 ${flow.totalMinutes} 分結束。`;
}
