import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { normalizeRoute } from '../src/lib/city-walk.mjs';

const DEFAULT_SOURCE = '~/code/city-walk-review/data/routes.json';
const OUTPUT_DIR = fileURLToPath(new URL('../content/city-walk/', import.meta.url));

const expandHome = (path) => (path === '~' || path.startsWith('~/') ? join(homedir(), path.slice(1)) : path);

function routesInCircleOrder({ circles, routes }) {
  const slots = circles.flatMap((circle) => circle.routes.map((district) => ({ district, circle: circle.name })));
  const unplaced = routes.filter((raw) => !slots.some((slot) => slot.district === raw.district));
  if (unplaced.length > 0) {
    throw new Error(`這些區不在任何一圈裡：${unplaced.map((raw) => raw.district).join('、')}`);
  }
  return slots.flatMap(({ district, circle }) =>
    routes.filter((raw) => raw.district === district).map((raw) => normalizeRoute(raw, circle)),
  );
}

const { values } = parseArgs({ options: { src: { type: 'string', default: DEFAULT_SOURCE } } });
const source = JSON.parse(readFileSync(expandHome(values.src), 'utf8'));
const routes = routesInCircleOrder(source);

mkdirSync(OUTPUT_DIR, { recursive: true });
writeFileSync(join(OUTPUT_DIR, 'routes.json'), JSON.stringify(routes, null, 2) + '\n');
console.log(`已匯入 ${routes.length} 條路線到 content/city-walk/routes.json`);
