import { routeSteps } from './city-walk.mjs';

const PLANNED_MINUTES = 60;
const SHORTEST_FIRST_STOP_MINUTES = 5;

export function routeWording(text, { totalMinutes, walkMinutes }) {
  if (!text) return text;
  const walked = text.replace('走約 30 分鐘', `走約 ${walkMinutes} 分鐘`);
  if (totalMinutes <= PLANNED_MINUTES) return walked;
  return walked
    .replace('60 分鐘準時結束', `大約 ${totalMinutes} 分鐘結束`)
    .replace('60 分鐘準時宣布', `約 ${totalMinutes} 分鐘準時宣布`);
}

function overtimeNote(totalMinutes, firstStopMinutes) {
  const over = totalMinutes - PLANNED_MINUTES;
  if (over <= 0) return null;
  const cut = Math.min(over, firstStopMinutes - SHORTEST_FIRST_STOP_MINUTES);
  const leftOver = over - cut;
  const note = `這條路線照流程走大約 ${totalMinutes} 分鐘。想 60 分鐘結束，可以把停留點一縮短 ${cut} 分`;
  return leftOver > 0 ? `${note}，還是會超過 ${leftOver} 分鐘。` : `${note}。`;
}

export function routeFlow(steps, route) {
  const filled = routeSteps(steps, route);
  const walkMinutes = route.legMinutes.reduce((sum, minutes) => sum + minutes, 0);
  const totalMinutes = filled.reduce((sum, step) => sum + step.minutes, 0);
  const wording = { totalMinutes, walkMinutes };
  let from = 0;
  const timed = filled.map((step) => {
    const to = from + step.minutes;
    const timedStep = {
      ...step,
      from,
      to,
      time: `${from}–${to} 分`,
      say: routeWording(step.say, wording),
      do: routeWording(step.do, wording),
    };
    from = to;
    return timedStep;
  });
  const firstStop = filled.find((step) => step.routeStop === 'stop1');
  const isOver = totalMinutes > PLANNED_MINUTES;
  return {
    steps: timed,
    totalMinutes,
    walkMinutes,
    flowTitle: isOver ? `${totalMinutes} 分鐘這樣過` : null,
    duration: isOver ? `約 ${totalMinutes} 分鐘` : null,
    overtimeNote: overtimeNote(totalMinutes, firstStop.minutes),
  };
}
