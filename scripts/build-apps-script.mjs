import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE_DIR = fileURLToPath(new URL('../apps-script/', import.meta.url));
// Apps Script runs every file in one global scope, so the modules are joined in dependency order.
export const APPS_SCRIPT_MODULES = ['districts', 'allowlist', 'responses', 'session-token', 'api'];
const GENERATED_NOTE = '// 由 scripts/build-apps-script.mjs 從 apps-script/ 產生，請改那裡的檔案，不要直接改這支。\n';

const asPlainScript = (source) =>
  source
    .split('\n')
    .filter((line) => !line.startsWith('import '))
    .map((line) => line.replace(/^export /, ''))
    .join('\n');

export async function buildAppsScript({ outDir = 'dist-apps-script' } = {}) {
  const modules = await Promise.all(APPS_SCRIPT_MODULES.map((name) => readFile(path.join(SOURCE_DIR, `${name}.mjs`), 'utf8')));
  const server = await readFile(path.join(SOURCE_DIR, 'server.js'), 'utf8');
  await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, 'Code.js'), GENERATED_NOTE + [...modules.map(asPlainScript), server].join('\n'));
  await copyFile(path.join(SOURCE_DIR, 'appsscript.json'), path.join(outDir, 'appsscript.json'));
  return { files: ['Code.js', 'appsscript.json'] };
}

if (import.meta.main) {
  const outDir = 'dist-apps-script';
  const { files } = await buildAppsScript({ outDir });
  console.log(`已產生 ${files.join('、')} 到 ${outDir}`);
}
