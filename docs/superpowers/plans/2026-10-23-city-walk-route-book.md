# 城市散步路書 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 城市散步選好區之後，活動頁有地圖＋拉桿＋路書；當天的「走到下一站」照規劃的那一段導航；所有時間照路線實際長度顯示；活動回報表多一個只給城市散步的區段。

**Architecture:** 純邏輯放 `src/lib/`（可以用 `node --test` 測）：路線資料轉換（`city-walk.mjs`）、距離與內插（`geo.mjs`）、每一步時間與換字（`route-flow.mjs`）、路書列與拉桿位置（`route-book.mjs`）。畫面放 `src/client/`：`route-book.js` 畫路書和拉桿，`route-map.js` 按需載入 Leaflet 畫地圖，`activity.js` 在選區時呼叫它們。Leaflet 的檔案直接放進 `public/vendor/leaflet/`，不用 npm。

**Tech Stack:** Node 24 內建 `node --test`、原生 ES modules、Leaflet 1.9.4（UMD 壓縮版）、國土測繪中心 EMAP 圖磚、Google Apps Script（表單）。

**Spec:** `docs/superpowers/specs/2026-10-23-city-walk-route-book-design.md`（實作前先讀完）

## Global Constraints

- 這個 repo 沒有任何 npm 套件，不要加 `package.json` 相依；Leaflet 以固定版本 1.9.4 的檔案放在 `public/vendor/leaflet/`。
- 網站用詞避開「活動」「舉辦」（`docs/wording-changes.md`）；表單題目不受這條限制。
- 整個 repo 公開：不放金鑰、個人信箱、表單編輯網址。檢閱網站的 `todo`、`flags`、`notes`、`confidence` 不能出現在網站資料裡。
- 底圖網址 `https://wmts.nlsc.gov.tw/wmts/EMAP/default/GoogleMapsCompatible/{z}/{y}/{x}`，標示來源「© 內政部國土測繪中心」。
- 街景網址 `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint={lat},{lon}`。
- 導航網址：`travelmode=walking`、`dir_action=navigate`、起點、終點、中途點最多 3 個。
- 時間標示格式沿用現有的「0–5 分」（en dash `–`）。
- 停留點一的時間不自動縮短；超過 60 分鐘只提醒，不改流程。
- 推之前 `npm test`、`npm run build` 都要過；直接推 `main`，不開 PR；不要用 `--no-verify`。
- 測試名稱用英文，跟現有測試一致；commit message 用英文。

## Review Focus

- 從超過 60 分的區（台北東區）切到 60 分以內的區（台北西區），標題、上方時間、開場白、收尾那步、第一次主持的提醒要全部回到「60 分鐘」的寫法 → Task 2 的測試鎖住 60 分以內不換字；Task 3 的驗證步驟實際切換一次。
- Leaflet 或圖磚載不到（沒訊號、圖磚服務掛了）時，路書、拉桿、連結照樣能用，地圖區塊收起來 → Task 5 的驗證步驟把 `leaflet.js` 拿掉再看一次。
- 手機上單指滑過地圖要捲動頁面，不是拖地圖 → Task 5 的 `createRouteMap` 在 `L.Browser.mobile` 時關掉 `dragging`，驗證步驟用手機寬度確認。
- 重新整理後「繼續」上次的當天模式，時間和準備清單的提醒要用存起來的那一區 → Task 3 的驗證步驟走一次續接。
- 總長剛好 60 分不算超過：不換字、不加提醒、拉桿不標 60 → Task 2 的測試。

---

### Task 1: 路線資料多帶兩段的路線、路名和導航網址

**Files:**
- Create: `src/lib/geo.mjs`
- Modify: `src/lib/city-walk.mjs`（`normalizeRoute`、`ROUTE_STOP_FIELDS`）
- Modify: `src/lib/schema.mjs:367-378`（`routeErrors`）
- Modify: `src/client/activity.js:98-119`（`routeSummary` 的 Google 連結，Task 5 會整段換掉）
- Modify: `tests/fixtures/content/city-walk/routes.json`、`content/city-walk/routes.json`（重新匯入）、`.gitignore`
- Test: `tests/geo.test.mjs`（新）、`tests/city-walk.test.mjs`、`tests/schema.test.mjs`

**Interfaces:**
- Produces:
  - `pathLength(path: [lat, lon][]) → number`（公尺）、`pointAlong(path, meters: number) → [lat, lon]`（超出範圍時夾在頭尾）— `src/lib/geo.mjs`
  - `splitLegTexts(routeText: string) → [string, string] | null`、`legNavUrl(from: {lat, lon}, path, to: {lat, lon}) → string`、`streetViewUrl({lat, lon}) → string` — `src/lib/city-walk.mjs`
  - 正規化後的路線多了 `legPaths: [lat, lon][][]`（兩段，小數 5 位）、`legMeters: [number, number]`、`legTexts: [string, string]`、`legNavUrls: [string, string]`；拿掉 `googleRouteUrl`。

- [ ] **Step 1: 寫 geo 的失敗測試** — `tests/geo.test.mjs`

```js
const path = [[25, 121], [25, 121.004]];
test('a path is as long as the sum of its pieces', () => {
  const half = [[25, 121], [25, 121.002]];
  assert.ok(Math.abs(pathLength(path) - 2 * pathLength(half)) < 1e-6);
  assert.ok(pathLength(path) > 400 && pathLength(path) < 410); // 0.004° 經度在北緯 25 度約 403 公尺
});
test('a point halfway along the path sits in the middle', () => {
  const [lat, lon] = pointAlong(path, pathLength(path) / 2);
  assert.ok(Math.abs(lat - 25) < 1e-9 && Math.abs(lon - 121.002) < 1e-9);
});
test('a point outside the path stays at its ends', () => {
  assert.deepEqual(pointAlong(path, -5), [25, 121]);
  assert.deepEqual(pointAlong(path, 99999), [25, 121.004]);
});
```

- [ ] **Step 2: 跑 `node --test tests/geo.test.mjs`**，預期 FAIL（找不到模組）。

- [ ] **Step 3: 實作 `src/lib/geo.mjs`**：距離用等距圓柱近似（`6371000 × hypot(Δlon × cos(平均緯度), Δlat)`，弧度），`pointAlong` 沿線段累加後線性內插。

- [ ] **Step 4: 跑 `node --test tests/geo.test.mjs`**，預期 PASS。

- [ ] **Step 5: 在 `tests/city-walk.test.mjs` 加失敗測試**（`rawRoute()` 是台北西區的測試資料）

```js
test('route text splits into two legs with spaced arrows', () => {
  assert.deepEqual(splitLegTexts(rawRoute().text.路線), [
    '從3號出口進台北植物園，沿園內步道走到臘葉館',
    '臘葉館 → 荷花池 → 園內步道往西北 → 小南門',
  ]);
});
test('a trailing remark after the distance does not break the split', () => {
  const text = '第一段（約17分鐘）：南苗市場→中山路→羅福星像。第二段（約20分鐘）：羅福星像→園內步道→南苗三角公園。全程約2.6公里，含園內步道。';
  assert.deepEqual(splitLegTexts(text), ['南苗市場 → 中山路 → 羅福星像', '羅福星像 → 園內步道 → 南苗三角公園']);
});
test('route text without two legs cannot be split', () => {
  assert.equal(splitLegTexts('從公園走到車站。'), null);
});
test('a leg navigation link walks from one stop to the next through three points on the path', () => {
  assert.equal(
    legNavUrl({ lat: 25, lon: 121 }, [[25, 121], [25, 121.004]], { lat: 25, lon: 121.004 }),
    'https://www.google.com/maps/dir/?api=1&travelmode=walking&dir_action=navigate' +
      '&origin=25.000000,121.000000&destination=25.000000,121.004000' +
      '&waypoints=25.000000,121.001000%7C25.000000,121.002000%7C25.000000,121.003000',
  );
});
test('a street view link opens the panorama nearest the point', () => {
  assert.equal(streetViewUrl({ lat: 25.1, lon: 121.5 }), 'https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=25.1,121.5');
});
test('normalizing a route carries both legs for the map and navigation', () => {
  const route = normalizeRoute(rawRoute(), '北一圈');
  assert.equal(route.legPaths.length, 2);
  assert.equal(route.legPaths[0].length, 42);
  const [lat, lon] = route.legPaths[0][0];
  assert.ok(Math.abs(lat - 25.035325) <= 0.000005 && Math.abs(lon - 121.511042) <= 0.000005);
  assert.equal(lat, Number(lat.toFixed(5)));
  assert.deepEqual(route.legMeters, [537, 1130]);
  assert.equal(route.legNavUrls[1], legNavUrl(route.stop1, rawRoute().legs[1].path, route.end));
  assert.equal(route.googleRouteUrl, undefined);
});
test('normalizing a route whose text has no two legs names the district', () => {
  const raw = rawRoute();
  raw.text.路線 = '從公園走到車站。';
  assert.throws(() => normalizeRoute(raw, '北一圈'), /台北西區/);
});
```

同一個檔案裡，把 `the start and end steps lead to the next stop and back to the meeting point` 的 `filled[0].mapsUrl` 斷言改成 `route.legNavUrls[0]`，`the first stop reads the intro aloud…` 加一行 `assert.equal(stop1.mapsUrl, route.legNavUrls[1])`。終點的「回到集合點」維持 `walkingLink(route.start)`。

- [ ] **Step 6: 跑 `node --test tests/city-walk.test.mjs`**，預期新測試 FAIL。

- [ ] **Step 7: 在 `src/lib/city-walk.mjs` 實作**
  - `splitLegTexts`：`/第一段（約\d+分鐘）：(.+?)。第二段（約\d+分鐘）：(.+?)。/`，兩段都把 `→` 換成 ` → `。
  - `legNavUrl`：中途點取這段路線長度的 1/4、2/4、3/4（`pointAlong`），所有座標 `toFixed(6)`。
  - `normalizeRoute` 加上 `legPaths`（`Math.round(x * 1e5) / 1e5`）、`legMeters`、`legTexts`（`null` 時丟 `Error(\`${raw.district} 的路線文字拆不出兩段\`)`）、`legNavUrls`（start→stop1、stop1→end，路線用原始的 `raw.legs[i].path`）；拿掉 `googleRouteUrl`。
  - `ROUTE_STOP_FIELDS.start` 的 `mapsUrl` 改用 `route.legNavUrls[0]`，`stop1` 改用 `route.legNavUrls[1]`，標籤不變；`end` 不變。

- [ ] **Step 8: 跑 `node --test tests/city-walk.test.mjs`**，預期 PASS（包含原本的「不公開內部資料」測試：新欄位名稱都不含 `legs` 這個字串）。

- [ ] **Step 9: 在 `tests/schema.test.mjs`（第 448 行附近那組城市散步路線測試）加失敗測試**：路線少了 `legTexts`、`legPaths` 其中一段少於 2 點、`legNavUrls` 不是兩個 `https://www.google.com/maps/dir/` 開頭的網址時，`validateAll` 各回一則錯誤，訊息分別包含 `routes[台北東區].legTexts`、`routes[台北東區].legPaths`、`routes[台北東區].legNavUrls`。完整的路線不報錯。

- [ ] **Step 10: 在 `routeErrors` 實作這三個檢查**（跟 `storyCard` 的檢查並列，每條路線都檢查）。

- [ ] **Step 11: 更新測試用的 `tests/fixtures/content/city-walk/routes.json`**：拿掉 `googleRouteUrl`，加上 `legPaths`（兩段，各用起訖兩點）、`legMeters: [1000, 1000]`、`legTexts: ["測試公園 → 測試路 → 測試館", "測試館 → 測試街 → 測試公園"]`、`legNavUrls`（用 `legNavUrl` 算出來的兩個網址）。

- [ ] **Step 12: 把 `src/client/activity.js` 的 `externalLink('整條路線在 Google 地圖開啟', …)` 換成兩個連結**：「第一段在 Google 地圖開啟」→ `route.legNavUrls[0]`、「第二段在 Google 地圖開啟」→ `route.legNavUrls[1]`（Task 5 會換掉整個路線區塊）。

- [ ] **Step 13: 重新匯入路線並全部測試**

Run: `node tools/import-city-walk.mjs && npm test`
Expected: `已匯入 61 條路線到 content/city-walk/routes.json`；全部 PASS（`content.test` 會用真資料跑 `validateAll`，61 條都要拆得出兩段）。

- [ ] **Step 14: `.gitignore` 加一行 `.superpowers/`，commit**

```bash
git add .gitignore src/lib/geo.mjs src/lib/city-walk.mjs src/lib/schema.mjs src/client/activity.js tests content/city-walk/routes.json
git commit -m "feat: carry each city-walk leg's path, road names and navigation link"
```

---

### Task 2: 每一步的時間照路線實際長度算，超過 60 分鐘時換字

**Files:**
- Create: `src/lib/route-flow.mjs`
- Test: `tests/route-flow.test.mjs`（新）

**Interfaces:**
- Consumes: `routeSteps(steps, route)`（`src/lib/city-walk.mjs`，已存在）
- Produces:
  - `routeFlow(steps, route) → { steps, totalMinutes, walkMinutes, flowTitle, duration, overtimeNote }`
    - `steps`：`routeSteps` 的結果，每一步多 `from`、`to`（分鐘）、`time`（例如 `'5–21 分'`），`say`、`do` 經過 `routeWording`。
    - `flowTitle`：超過 60 分時 `'64 分鐘這樣過'`，否則 `null`。
    - `duration`：超過 60 分時 `'約 64 分鐘'`，否則 `null`。
    - `overtimeNote`：超過 60 分時的提醒字串，否則 `null`。
  - `routeWording(text, { totalMinutes, walkMinutes }) → string`

換字規則（`routeWording`）：
- `走約 30 分鐘` → `走約 ${walkMinutes} 分鐘`（一律換，`walkMinutes` 是兩段分鐘數相加）
- 只在 `totalMinutes > 60` 時：`60 分鐘準時結束` → `大約 ${totalMinutes} 分鐘結束`；`60 分鐘準時宣布` → `約 ${totalMinutes} 分鐘準時宣布`

提醒字句（`overtimeNote`，`over = total - 60`，`cut = min(over, 停留點一分鐘數 - 5)`，`rest = over - cut`）：
- `rest === 0`：`這條路線照流程走大約 ${total} 分鐘。想 60 分鐘結束，可以把停留點一縮短 ${cut} 分。`
- `rest > 0`：`這條路線照流程走大約 ${total} 分鐘。想 60 分鐘結束，可以把停留點一縮短 ${cut} 分，還是會超過 ${rest} 分鐘。`

- [ ] **Step 1: 寫失敗測試** — `tests/route-flow.test.mjs`。用真的 `content/activities/city-walk.json` 的 `steps`，路線用 `normalizeRoute(rawRoute(), '北一圈')` 再覆寫 `legMinutes`：

```js
const steps = () => JSON.parse(readFileSync(new URL('../content/activities/city-walk.json', import.meta.url), 'utf8')).steps;
const routeWith = (legMinutes) => ({ ...normalizeRoute(rawRoute(), '北一圈'), legMinutes });

test('step times add up the route legs', () => {
  assert.deepEqual(routeFlow(steps(), routeWith([16, 18])).steps.map((s) => s.time),
    ['0–5 分', '5–21 分', '21–31 分', '31–49 分', '49–59 分', '59–64 分']);
  assert.deepEqual(routeFlow(steps(), routeWith([18, 25])).steps.map((s) => s.time),
    ['0–5 分', '5–23 分', '23–33 分', '33–58 分', '58–68 分', '68–73 分']);
});
test('a route past 60 minutes says its real length', () => {
  const flow = routeFlow(steps(), routeWith([16, 18]));
  assert.equal(flow.totalMinutes, 64);
  assert.equal(flow.flowTitle, '64 分鐘這樣過');
  assert.equal(flow.duration, '約 64 分鐘');
  assert.equal(flow.steps[0].say, '今天就是一起散散步、輕鬆聊天，大約 64 分鐘結束；要先離開的不用客氣。');
  assert.equal(flow.overtimeNote, '這條路線照流程走大約 64 分鐘。想 60 分鐘結束，可以把停留點一縮短 4 分。');
});
test('a route too long to fix by shortening the first stop says how much is left over', () => {
  assert.equal(routeFlow(steps(), routeWith([18, 25])).overtimeNote,
    '這條路線照流程走大約 73 分鐘。想 60 分鐘結束，可以把停留點一縮短 5 分，還是會超過 8 分鐘。');
});
test('no step of a long route still promises 60 minutes', () => {
  const flow = routeFlow(steps(), routeWith([18, 25]));
  for (const step of flow.steps) assert.ok(!`${step.say}${step.do}`.includes('60 分鐘'), step.title);
});
test('the walking time in the opening step follows the route', () => {
  assert.ok(routeFlow(steps(), routeWith([16, 18])).steps[0].do.includes('走約 34 分鐘，中間停兩個地方'));
});
test('a route of exactly 60 minutes keeps the 60-minute wording', () => {
  const flow = routeFlow(steps(), routeWith([15, 15]));
  assert.equal(flow.totalMinutes, 60);
  assert.equal(flow.flowTitle, null);
  assert.equal(flow.duration, null);
  assert.equal(flow.overtimeNote, null);
  assert.equal(flow.steps[0].say, steps()[0].say);
});
test('a short route ends early but keeps the 60-minute wording', () => {
  const flow = routeFlow(steps(), routeWith([8, 16]));
  assert.equal(flow.steps.at(-1).time, '49–54 分');
  assert.equal(flow.flowTitle, null);
  assert.ok(flow.steps.at(-1).do.includes('60 分鐘準時宣布'));
});
test('the first-time tip about announcing the end follows the route length', () => {
  assert.equal(routeWording('60 分鐘準時宣布「正式程序到此結束」', { totalMinutes: 64, walkMinutes: 34 }), '約 64 分鐘準時宣布「正式程序到此結束」');
  assert.equal(routeWording('60 分鐘準時宣布「正式程序到此結束」', { totalMinutes: 54, walkMinutes: 24 }), '60 分鐘準時宣布「正式程序到此結束」');
});
```

- [ ] **Step 2: 跑 `node --test tests/route-flow.test.mjs`**，預期 FAIL（找不到模組）。

- [ ] **Step 3: 實作 `src/lib/route-flow.mjs`**：先 `routeSteps`，再依序累加 `minutes` 得到 `from`/`to`，`time` 用 `` `${from}–${to} 分` ``；`say`、`do` 經過 `routeWording`；停留點一的分鐘數取 `routeStop === 'stop1'` 那一步的 `minutes`。

- [ ] **Step 4: 跑 `node --test tests/route-flow.test.mjs`**，預期 PASS；再跑 `npm test`，全部 PASS。

- [ ] **Step 5: Commit**

```bash
git add src/lib/route-flow.mjs tests/route-flow.test.mjs
git commit -m "feat: time each city-walk step by its route and say when it runs past 60 minutes"
```

---

### Task 3: 活動頁和當天模式套用實際時間

**Files:**
- Modify: `src/render/activity.mjs:12-18`（`renderHead`）、`:112-120`（`renderMore`）
- Modify: `src/lib/live.mjs:22-24`（`preflightItems`）
- Modify: `src/client/activity.js`（`liveStepsFor`、`choose`、`showPreflight`）
- Test: `tests/render-activity.test.mjs`、`tests/live.test.mjs`

**Interfaces:**
- Consumes: `routeFlow`、`routeWording`（Task 2）
- Produces: `preflightItems(activity, extra = []) → string[]`；活動頁 HTML 的時間那一項是 `<li class="duration">`，第一次主持的清單是 `<ol class="first-time">`。

- [ ] **Step 1: 寫失敗測試**
  - `tests/render-activity.test.mjs`：活動頁 HTML 包含 `<li class="duration">60 分鐘</li>` 和 `<ol class="first-time">`（用現有測試的活動資料）。
  - `tests/live.test.mjs`：`assert.deepEqual(preflightItems({ preflight: ['a'] }, ['b']), ['a', 'b'])`，以及不給第二個參數時等於 `['a']`。

- [ ] **Step 2: 跑 `node --test tests/render-activity.test.mjs tests/live.test.mjs`**，預期新測試 FAIL。

- [ ] **Step 3: 實作**
  - `renderHead`：時間那一項加 `class="duration"`（人數、地點不動）。
  - `renderMore`：第一次主持的 `<ol>` 加 `class="first-time"`。
  - `preflightItems(activity, extra = [])` 回傳 `[...activity.preflight, ...extra]`。

- [ ] **Step 4: 跑同一組測試**，預期 PASS。

- [ ] **Step 5: 改 `src/client/activity.js`**
  - 加 `const flowFor = (name) => routeFlow(activity.steps, routeFor(name));`；`liveStepsFor` 改成 `routes ? flowFor(name).steps : activity.steps`（當天模式每一步上面的時間、開場白、收尾那步就跟著變）。
  - 加 `showRouteTimes(flow)`，在 `choose()` 裡、`showStopStoryThumbs` 前呼叫。第一次呼叫時記下原本的字（`.flow h2`、`.facts .duration`、每個 `.timeline > .step` 的 `.time` 和 `.say`、每個 `.first-time li`），之後每次都從原本的字算：標題 `flow.flowTitle ?? 原本`、時間 `flow.duration ?? 原本`、每一步 `.time` = `flow.steps[i].time`、`.say` = `` `說：${flow.steps[i].say}` ``、第一次主持的每一項 = `routeWording(原本, flow)`。
  - `showPreflight` 的清單改成 `preflightItems(activity, routes && live.district ? [flowFor(live.district).overtimeNote].filter(Boolean) : [])`。

- [ ] **Step 6: 預覽並截圖驗證**

Run: `npm test && npm run preview && npm run serve`（另一個 shell），用 gstack browse（`BROWSE_STATE_FILE` 用自己的一份、截圖存 `/private/tmp`、視窗 390×844）：
1. 打開 `http://localhost:8766/a/city-walk/?d=台北東區`：標題「64 分鐘這樣過」、上方「約 64 分鐘」、時間 0–5／5–21／21–31／31–49／49–59／59–64、第一步「說：…大約 64 分鐘結束…」、第一次主持的提醒「約 64 分鐘準時宣布」。
2. 改選台北西區：標題回到「60 分鐘這樣過」、上方「60 分鐘」、最後一步「49–54 分」、提醒回到「60 分鐘準時宣布」。
3. 選回台北東區，按「開始」：準備清單最後一項是「這條路線照流程走大約 64 分鐘。想 60 分鐘結束，可以把停留點一縮短 4 分。」；開始後第一步上面寫「0–5 分」，第二步「5–21 分」。
4. 在第二步重新整理頁面，按「繼續」：仍是台北東區、時間「5–21 分」。

- [ ] **Step 7: Commit**

```bash
git add src/render/activity.mjs src/lib/live.mjs src/client/activity.js tests/render-activity.test.mjs tests/live.test.mjs
git commit -m "feat: show each city walk's real timings once a district is picked"
```

---

### Task 4: 路書的列和拉桿的位置

**Files:**
- Create: `src/lib/route-book.mjs`
- Test: `tests/route-book.test.mjs`（新）

**Interfaces:**
- Consumes: `routeFlow`（Task 2）、`pathLength`/`pointAlong`（Task 1）、`streetViewUrl`（Task 1）
- Produces:
  - `bookRows(route, flow) → Row[]`，`Row` 是下列其中一種，`minute` 是那一步的 `from`：
    - `{ kind: 'stop', stop: 'start' | 'stop1' | 'end', minute, title, detail, streetViewUrl }`（`detail` 可為 `null`）
    - `{ kind: 'leg', leg: 0 | 1, minute, title, via, navUrl }`
    - `{ kind: 'wrap', minute, title, detail }`
  - `positionAt(route, flow, minute) → { point: [lat, lon], leg: 0 | 1 | null }`
  - `minuteText(route, flow, minute) → string`

列的文字（`flow` 用真的城市散步步驟）：
- 集合：`title` = `` `集合：${route.meetingPoint}` ``，`detail` = `null`
- 路段：`title` = `` `第一段　約 ${legMinutes[0]} 分・${(legMeters[0] / 1000).toFixed(1)} 公里` ``（第二段同理），`via` = `legTexts[i]`，`navUrl` = `legNavUrls[i]`
- 停留點一：`title` = `` `停留點一：${route.stop1.place}` ``，`detail` = `` `念故事卡 ${route.stop1.storyCard}，停 ${那一步的 minutes} 分` ``
- 終點：`title` = `` `終點：${route.end.place}` ``，`detail` = `` `念故事卡 ${那一步的 cardIds[0]}、分享感動` ``
- 收尾（終點之後、沒有 `routeStop`/`routeLeg` 的那一步）：`title` = `` `收尾，約第 ${flow.totalMinutes} 分結束` ``，`detail` = `route.returnText`

拉桿說明（`minuteText`，`t` 是分鐘，中間是全形空白）：
- 集合：`` `第 ${t} 分　在集合點等人到齊、說明路線。` ``
- 路段：`` `第 ${t} 分　第一段，走了約 ${四捨五入到 10 的公尺} 公尺，再約 ${to - t} 分到停留點一。` ``（第二段寫「第二段」「到終點」）
- 停留點一：`` `第 ${t} 分　在停留點一念故事卡 ${storyCard}。` ``
- 終點：`` `第 ${t} 分　在終點念故事卡 ${cardId}、分享感動。` ``
- 收尾：`` `第 ${t} 分　收尾，第 ${total} 分結束。` ``；`t === total` 時：`` `第 ${t} 分　結束。` ``

路段上的位置：`公尺 = pathLength(legPaths[i]) × (t − from) / (to − from)`。`t` 落在 `[from, to)` 的那一步算數；`t === total` 算最後一步。收尾時紅點在終點。

- [ ] **Step 1: 寫失敗測試** — `tests/route-book.test.mjs`。`flow = routeFlow(真的步驟, normalizeRoute(rawRoute(), '北一圈'))`（台北西區，兩段 8、16 分，總長 54）：

```js
test('the book lists the stops and legs in walking order with their start minutes', () => {
  const rows = bookRows(route, flow);
  assert.deepEqual(rows.map((r) => [r.kind, r.minute]),
    [['stop', 0], ['leg', 5], ['stop', 13], ['leg', 23], ['stop', 39], ['wrap', 49]]);
  assert.equal(rows[1].title, '第一段　約 8 分・0.5 公里');
  assert.equal(rows[1].via, '從3號出口進台北植物園，沿園內步道走到臘葉館');
  assert.equal(rows[2].detail, '念故事卡 P，停 10 分');
  assert.equal(rows[4].detail, '念故事卡 B、分享感動');
  assert.equal(rows[5].title, '收尾，約第 54 分結束');
  assert.equal(rows[0].streetViewUrl, streetViewUrl(route.start));
});
test('the dot waits at the meeting point, walks the legs and ends at the last stop', () => {
  assert.deepEqual(positionAt(route, flow, 0), { point: [route.start.lat, route.start.lon], leg: null });
  assert.deepEqual(positionAt(route, flow, 5), { point: route.legPaths[0][0], leg: 0 });
  assert.deepEqual(positionAt(route, flow, 9), { point: pointAlong(route.legPaths[0], pathLength(route.legPaths[0]) / 2), leg: 0 });
  assert.deepEqual(positionAt(route, flow, 13), { point: [route.stop1.lat, route.stop1.lon], leg: null });
  assert.deepEqual(positionAt(route, flow, 50), { point: [route.end.lat, route.end.lon], leg: null });
  assert.deepEqual(positionAt(route, flow, 54), { point: [route.end.lat, route.end.lon], leg: null });
});
test('the slider line says where the group is and how long to the next stop', () => {
  const walked = Math.round(pathLength(route.legPaths[0]) / 2 / 10) * 10;
  assert.equal(minuteText(route, flow, 9), `第 9 分　第一段，走了約 ${walked} 公尺，再約 4 分到停留點一。`);
  assert.equal(minuteText(route, flow, 2), '第 2 分　在集合點等人到齊、說明路線。');
  assert.equal(minuteText(route, flow, 15), '第 15 分　在停留點一念故事卡 P。');
  assert.equal(minuteText(route, flow, 40), '第 40 分　在終點念故事卡 B、分享感動。');
  assert.equal(minuteText(route, flow, 50), '第 50 分　收尾，第 54 分結束。');
  assert.equal(minuteText(route, flow, 54), '第 54 分　結束。');
});
```

- [ ] **Step 2: 跑 `node --test tests/route-book.test.mjs`**，預期 FAIL（找不到模組）。

- [ ] **Step 3: 實作 `src/lib/route-book.mjs`** 的三個函式，照上面的規則；步驟和列的對應靠 `routeStop`／`routeLeg`。

- [ ] **Step 4: 跑 `node --test tests/route-book.test.mjs`**，預期 PASS；再跑 `npm test`。

- [ ] **Step 5: Commit**

```bash
git add src/lib/route-book.mjs tests/route-book.test.mjs
git commit -m "feat: lay out the city-walk route book and where the group is at each minute"
```

---

### Task 5: 活動頁的路書、拉桿和地圖

**Files:**
- Create: `public/vendor/leaflet/leaflet.js`、`leaflet.css`、`LICENSE`
- Create: `src/client/dom.js`、`src/client/route-map.js`、`src/client/route-book.js`
- Modify: `src/client/activity.js`（拿掉 `routeSummary`、`el`、`externalLink`，改用 `dom.js`；`choose()` 改呼叫 `renderRouteBook`）
- Modify: `src/styles/site.css`（`.route-summary` 一帶）、`README.md`（「要先裝什麼」）

**Interfaces:**
- Consumes: `bookRows`、`positionAt`、`minuteText`（Task 4）、`flowFor`（Task 3 加在 `activity.js`）
- Produces:
  - `el(tag, props, children)`、`externalLink(textContent, href, className)` — `src/client/dom.js`（從 `activity.js` 原封不動搬過來）
  - `loadLeaflet(rel: string) → Promise<L>`（只載一次；`<link>` 載 `${rel}vendor/leaflet/leaflet.css`、`<script>` 載 `${rel}vendor/leaflet/leaflet.js`，失敗就 reject）、`createRouteMap(container, L, route) → { moveDot(point), focusLeg(leg | null), remove() }` — `src/client/route-map.js`
  - `renderRouteBook(container, route, flow, { rel })` — `src/client/route-book.js`（換掉 `container` 的內容；換區時先移除上一張地圖）

- [ ] **Step 1: 放進 Leaflet 1.9.4**

```bash
TMP=$(mktemp -d) && npm pack leaflet@1.9.4 --pack-destination "$TMP" && tar -xzf "$TMP"/leaflet-1.9.4.tgz -C "$TMP"
mkdir -p public/vendor/leaflet && cp "$TMP"/package/dist/leaflet.js "$TMP"/package/dist/leaflet.css "$TMP"/package/LICENSE public/vendor/leaflet/
head -c 80 public/vendor/leaflet/leaflet.js
```
Expected: 開頭有 `Leaflet 1.9.4`。

- [ ] **Step 2: 抽出 `src/client/dom.js`**，`activity.js` 改成 import；跑 `npm test` 確認沒壞。

- [ ] **Step 3: 實作 `src/client/route-map.js`**
  - 地圖選項：`dragging: !L.Browser.mobile`、`scrollWheelZoom: false`（手機單指捲頁面，兩指縮放）。
  - 底圖用 Global Constraints 的網址，`maxZoom: 19`，`attribution: '© 內政部國土測繪中心'`。
  - 兩段路線用 `L.polyline(..., { className: 'route-leg route-leg-0' })`（第二段 `route-leg-1`），顏色寫在 CSS（`stroke: var(--step1)`、`var(--step3)`，看起來分得清楚就好）。
  - 三個點用 `L.divIcon`，字是「集」「1」「終」，`className: 'route-pin'`；紅點用 `L.circleMarker`，`className: 'route-dot'`。
  - `fitBounds` 包住兩段路線。`focusLeg(i)` 讓另一段加 `is-faded`（變淡），`null` 時兩段都正常。

- [ ] **Step 4: 實作 `src/client/route-book.js` 的 `renderRouteBook`**，由上到下：
  1. `h3` 路線名稱
  2. `p.route-length`：`` `全程約 ${(route.totalM / 1000).toFixed(1)} 公里・走路約 ${flow.walkMinutes} 分，中間停 ${停留點一分鐘數} 分，整場大約 ${flow.totalMinutes} 分鐘` ``
  3. `flow.overtimeNote` 不是 `null` 時加 `p.route-overtime`
  4. `div.route-map`（`loadLeaflet` 失敗就把這個區塊 `hidden`，其他照常）
  5. `input.route-slider`（`type=range`、`min=0`、`max=flow.totalMinutes`、`step=1`、`value=0`、`aria-label="第幾分鐘"`）；總長超過 60 時，下面加一個 `span.route-sixty`（字「60」），`left: ${60 / total * 100}%`
  6. `p.route-now`（`aria-live="polite"`），內容 `minuteText`
  7. `ol.route-book`：每一列一個 `li`（`data-minute`），`title` 粗體、`via`／`detail` 一般字；停靠點加 `externalLink('看街景', streetViewUrl)`，路段加 `externalLink('在 Google 地圖看這一段', navUrl)`
  8. `dl.route-facts`：停車、廁所、雨天備案、選配（跟現在一樣的寫法）
  9. `p.route-adjust`：`路線是企劃室的建議，實地走過覺得不順，可以自己調整；事後的回報表會請你寫改了什麼、為什麼。`

  拉桿 `input` 時：`positionAt` → `moveDot`、`focusLeg`；更新 `p.route-now`；`data-minute` 不大於目前分鐘的最後一列加 `is-now`。點某一列：拉桿設成那一列的 `minute`，再跑一次同樣的更新。

- [ ] **Step 5: `activity.js` 的 `choose()` 改成 `renderRouteBook(summary, route, flowFor(name), { rel: REL })`**，刪掉 `routeSummary` 和 Task 1 加的兩個連結。

- [ ] **Step 6: CSS**：`.route-map`（高約 240px、圓角）、`.route-slider`、`.route-sixty`、`.route-now`、`.route-book li`（路段左邊一條色線，`is-now` 底色）、`.route-pin`、`.route-dot`、`.route-leg-*`、`.is-faded`。沿用 `site.css` 現有的變數。

- [ ] **Step 7: README**：「要先裝什麼」那段的「這個專案沒有任何套件」後面加一句：城市散步的地圖用 Leaflet 1.9.4，檔案直接放在 `public/vendor/leaflet/`，不用 npm。

- [ ] **Step 8: 預覽並截圖驗證**（gstack browse，390×844，一屏一屏截）

Run: `npm test && npm run preview`
1. `?d=台北東區`：地圖有底圖、兩段不同顏色、三個標記；拉桿 0～64，下面有「60」的記號；拖到第 12 分（用 `browse js` 設 `value` 再送 `input` 事件），紅點在第一段、「第一段」那一列亮、說明寫「第 12 分　第一段，走了約…」。點「停留點一」那一列，拉桿跳到 21。
2. `?d=苗栗區`：第二段的路名結尾是「南苗三角公園」。
3. `?d=台北西區`：拉桿 0～54，沒有「60」的記號，沒有提醒那一行。
4. 手機寬度單指從地圖上往下滑，頁面會捲動。
5. 把 `dist-preview/vendor/leaflet/leaflet.js` 改名後重新整理：地圖區塊不見，路書、拉桿、連結照常。驗完改回來。
6. 「看街景」「在 Google 地圖看這一段」的網址跟 `routes.json` 裡的一致。

- [ ] **Step 9: Commit**

```bash
git add public/vendor/leaflet src/client src/styles/site.css README.md
git commit -m "feat: add the city-walk route book with a map and time slider"
```

---

### Task 6: 活動回報表加「城市散步的路線」區段

**Files:**
- Modify: `~/code/sokahan-propalsal-2026/兄弟時光/問卷/建立問卷表單.gs`（不在這個 repo，那個資料夾不是 git）

- [ ] **Step 1: 備份**：`cp 建立問卷表單.gs 建立問卷表單.before-city-walk.gs`

- [ ] **Step 2: 在檔案最後加上**（題目是規格定死的字，照抄）：

```js
// ===== 活動回報表加「城市散步的路線」區段：選城市散步才出現，其他活動直接送出 =====

const CITY_WALK = '城市散步';
const CITY_WALK_SECTION_TITLE = '城市散步的路線';

function addCityWalkRouteSection() {
  const form = FormApp.openById('1Ir-44O5zfVUeHueqzZO1F9KsGKnfewcjaXcyWbXSmGU'); // 活動回報表
  const exists = form.getItems(FormApp.ItemType.PAGE_BREAK).some((item) => item.getTitle() === CITY_WALK_SECTION_TITLE);
  if (exists) {
    Logger.log('已經有「城市散步的路線」區段，沒有再加');
    return;
  }
  const section = form.addPageBreakItem().setTitle(CITY_WALK_SECTION_TITLE);
  form.addMultipleChoiceItem()
    .setTitle('這次有沒有照企劃室建議的路線走？')
    .setChoiceValues(['照建議的路線走', '有調整'])
    .setRequired(true);
  form.addParagraphTextItem().setTitle('原本的路線哪裡不順？').setHelpText('有調整才填').setRequired(false);
  form.addParagraphTextItem().setTitle('調整後怎麼走？考慮了什麼？').setHelpText('有調整才填').setRequired(false);

  const activity = form.getItems(FormApp.ItemType.LIST).find((item) => item.getTitle() === '舉辦的活動').asListItem();
  activity.setChoices(activity.getChoices().map((choice) =>
    activity.createChoice(choice.getValue(), choice.getValue() === CITY_WALK ? section : FormApp.PageNavigationType.SUBMIT)));
  Logger.log('已加上「城市散步的路線」區段');
}
```

- [ ] **Step 3: 語法檢查**：`cp 建立問卷表單.gs "$CLAUDE_JOB_DIR/tmp/form-check.js" && node --check "$CLAUDE_JOB_DIR/tmp/form-check.js"`，預期沒有輸出。

- [ ] **Step 4: 交給使用者**：請使用者用企劃室帳號，把新函式貼進 Apps Script 專案，執行 `addCityWalkRouteSection` 一次。執行後打開表單確認：選「城市散步」會跳到新區段，選別的直接送出。這一步做不了自動驗證，在交接檔記為待辦。

---

### Task 7: Review、上線、交接

- [ ] **Step 1: 全部測試和 build**：`npm test && npm run build`，預期全部 PASS、build 沒有錯誤。

- [ ] **Step 2: Review**：用 `superpowers:requesting-code-review` 跑整個分支（`model: "sonnet"`）。最多兩輪、照 `~/CLAUDE.md` 的三道閘門；不修的記到 `HANDOFF.md` 的延後清單。

- [ ] **Step 3: 合回 main 並推上去**

```bash
cd ~/code/brotime-portal && git merge --ff-only city-walk-route-book && npm test && npm run build && git push origin main
gh run watch --repo twsokahan/brotime-portal $(gh run list --repo twsokahan/brotime-portal --branch main --limit 1 --json databaseId -q '.[0].databaseId')
```
Expected: Actions 成功。

- [ ] **Step 4: 確認正式站**：`curl -s https://kyodai-tokimitsu.twsokahan.org/js/route-book.js | head -3` 有內容；`curl -sI https://kyodai-tokimitsu.twsokahan.org/vendor/leaflet/leaflet.js` 是 200；用 gstack browse 開正式站 `?d=台北東區` 截一張。

- [ ] **Step 5: 更新 `HANDOFF.md`**：現況加一段城市散步路書（做了什麼、超過 60 分照實際時間的原則、使用者的決定）；「之後改東西要記得」加：路線資料多了 `legPaths`／`legTexts`／`legNavUrls`、Leaflet 放在 `public/vendor/leaflet/`；延後清單加 review 留下的 low；待辦加三件使用者要做的事：
  1. 用企劃室帳號跑 `addCityWalkRouteSection`。
  2. 手機實測：台北東區、苗栗區、再一條的兩段 Google 連結，看 Google 畫的路跟網站地圖一不一樣；「看街景」打開的是街景不是黑畫面；在家按「走到下一站」看到路線預覽。
  3. 路線超過 60 分的 26 條，企劃室另外檢討。
  Commit 並推上 main。

- [ ] **Step 6: 收尾**：`git worktree remove ~/code/brotime-portal-worktrees/city-walk-route-book`、`git branch -d city-walk-route-book`、`git push origin --delete city-walk-route-book`；用 terminal-notifier（參數見 `~/CLAUDE.md`）和 Pushover（mcpm 的 `pushover_send`）以繁體中文通知使用者。
