# 登入與各區統計 實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 兄弟時光網站加上 Google 輕登入（只限名單上的人），並讓區負責人在網站上看自己區的參加者問卷統計、替自己區加主持人。

**Architecture:** 網站仍是 GitHub Pages 靜態頁。要登入的頁在 `<head>` 用一段同步小程式檢查手機上的登入紀錄，沒有紀錄就藏起 `<main>`、顯示登入面板。登入用 Google Identity Services 拿 ID token，送到一支 Apps Script 網頁應用程式；它驗 token、比對三份名單，發一張自己簽的 session token，之後的背景確認、統計、加主持人都帶這張 token。Apps Script 的純邏輯寫成 `apps-script/*.mjs` 給 `node --test` 測，`scripts/build-apps-script.mjs` 把它們拼成一支 `Code.js` 用 clasp 推上去。`content/site.json` 沒有 `signIn` 時整個功能關閉，所以 Task 1–10 可以先推上線，Task 11 才打開。

**Tech Stack:** Node 24（`node --test`，沒有外部套件）、瀏覽器原生 ES modules、Google Identity Services、Google Apps Script（V8）、clasp。

**Spec:** `docs/superpowers/specs/2026-11-03-login-and-district-stats-design.md`

## Global Constraints

- repo 是公開的：名單信箱、試算表 ID／網址、Apps Script 專案 ID 不進 repo、不進網頁。試算表 ID 放 Apps Script 的 Script Properties，位置記在本機記憶 `brotime-login-allowlist-sources.md`。OAuth 用戶端 ID 和 Apps Script 的 `/exec` 網址本來就會出現在網頁上，放 `content/site.json`。
- 要登入：首頁、`all/`、活動頁（含準備中）、電子一番賞、`stats/`、`stats/session/`、`hosts/`。不用登入：故事卡頁、新手小抄頁、`public/` 的檔案。
- 對外文字不寫「企劃室」，新文字一律避開「活動」「舉辦」「主辦」（`tests/content.test.mjs` 掃 `src/client`、`src/lib` 和 preview build）。
- 一場＝同一區、同一個活動名稱、同一個台灣日期的參加者問卷回覆。一場少於 3 份不列數字。
- 「今天有沒有一句話或一個瞬間留在心裡？」那一欄 Apps Script 不讀、不回傳。
- 統計權限：區級看自己區；圈級看圈內各區；創價班企劃組與總部幹部看全部；補充名單上的人看不到。
- 沒訊號時，登入過的手機照樣放行。只有伺服器明確回「不在名單」或 session 無效才登出。
- 瀏覽器呼叫 Apps Script 一律 `POST`，body 是 JSON 字串，不設 `Content-Type`（預設 `text/plain`，避開預檢）。
- 不加外部套件；樣式只用 `src/lib/palette.mjs` 已有的 CSS 變數，不寫死顏色。
- 網站直接推 main、不開 PR；推之前 `npm test`、`npm run build`。

## 實作判斷（設計文件第 8 節留給實作的人，這裡定案）

- 手機上的登入紀錄不設期限。打開要登入的頁時，距離上次確認滿 24 小時且有網路，就在背景問一次 Apps Script（`me`）。
- 防閃：`<head>` 同步檢查，沒有紀錄就在 `<html>` 加 `signin-needed`，CSS 藏 `main`、顯示 `.signin`。
- Apps Script 快取：合併後的名單放 CacheService 10 分鐘，加人、拿掉人時清掉；統計結果以登入者範圍為 key 快取 10 分鐘（放不進快取就不快取）。瀏覽器把 `stats` 回應放 sessionStorage 10 分鐘，首頁和回顧頁共用。
- 「你們區的人想約」列前 3 名。圈級顯示「你們圈的人想約」，算圈內每一區最近 3 場加總。看全部的人首頁不顯示這一塊，只顯示「看每一場的回顧」連結。
- 圈 → 區的對照從通訊錄本身推：通訊錄的「圈別」只寫在圈負責人那一列，底下各區那幾列要往下沿用。2025-12-28 版已經是雙和圈、板城圈、桃園一圈／二圈、台中一圈／二圈，跟 `content/city-walk/routes.json` 的舊圈名不同，不能拿路線檔當對照。
- 通訊錄有合併儲存格：企劃組、圈負責人那幾列的職務落在「區別」欄（例如 `['花東圈', '圈負責人']`），所以「區別」解析不出區名是正常的。
- 信箱 `@gmail.com.tw` 視為 `@gmail.com`（通訊錄有一格這樣打錯）。
- 同一個信箱出現在多份名單：取範圍最大的（all > circle > district > none），同級的區取聯集。
- session token 格式 `encodeURIComponent(email).發出時間毫秒.簽章`，簽章是 HMAC-SHA256（Script Property `SESSION_SECRET`），有效 365 天；每次使用仍重新比對名單。

## Review Focus

1. 已登入的手機沒網路時：背景確認的 fetch 丟錯、回傳不是 JSON、Apps Script 回 `server` 錯，都要照樣放行，不可登出。→ Task 8 `recheckOutcome` 測試。
2. 無痕模式、localStorage 讀取丟例外、存的 JSON 壞掉：`<head>` 小程式不能丟例外讓頁面空白，要顯示登入面板。→ Task 7 head script 測試。
3. 名單信箱有大小寫、全形「＠」、夾文字、兩個信箱欄，要跟 Google 回傳的小寫信箱對得上；同一人同時在通訊錄（區負責人）和補充名單，不能被降成看不到統計。→ Task 2 測試。
4. 舊回覆：加「下一次想參加哪一種」之前的回覆那格是空的、區沒填、區名不在清單、活動名稱是改名前的（巷口泡茶會），都不能讓整份統計壞掉。空的「下一次」不算票，沒填區的不算，舊活動名照原名顯示、找不到對應頁就不加連結。→ Task 3 測試、Task 9 `activityHref` 測試。
5. 幹部名單的圈、區寫法（「花東」沒有「圈」、「北東」「高北」縮寫、「金門」）要對得到；對不到的人仍能登入、只是看不到統計，而且 `checkSetup()` 會列出對不到的寫法。→ Task 1、Task 2 測試。

---

## 檔案結構

Apps Script（純邏輯可測，最後拼成一支）：
- `apps-script/districts.mjs`：區清單、區名與圈名解析。
- `apps-script/allowlist.mjs`：從三份名單抽信箱、算每個人看得到的範圍、合併。
- `apps-script/responses.mjs`：參加者問卷回覆 → 一場一場 → 統計、想約。
- `apps-script/session-token.mjs`：檢查 Google tokeninfo；簽發、讀取 session token。
- `apps-script/api.mjs`：`handleRequest`，所有動作的路由與權限，依賴從外面注入。
- `apps-script/server.js`：Apps Script 外殼（`doPost`、讀試算表、快取、鎖、`checkSetup`、`createSupplementSheet`）。不寫單元測試，靠打包測試確認語法和進入點。
- `apps-script/appsscript.json`：manifest。
- `scripts/build-apps-script.mjs`：拼成 `dist-apps-script/Code.js`。

網站：
- `src/lib/signin.mjs`：登入紀錄的判斷（純函式，`<head>` 小程式也用）。
- `src/lib/stats-view.mjs`：統計畫面用的純函式與文字。
- `src/render/signin.mjs`：`<head>` 小程式、登入面板 HTML、設定 JSON。
- `src/render/stats.mjs`：`stats/`、`stats/session/`、`hosts/` 三頁的骨架。
- `src/client/signin.js`：登入面板行為、背景確認、`callApi`。
- `src/client/stats-data.js`、`district-wants.js`、`stats.js`、`stats-session.js`、`hosts.js`。
- 修改：`src/lib/schema.mjs`、`src/render/layout.mjs`、`src/render/entry.mjs`、`scripts/build.mjs`、`src/styles/site.css`、`package.json`、`.gitignore`、`README.md`、`HANDOFF.md`。

---

### Task 1: 區名與圈名解析

**Files:**
- Create: `apps-script/districts.mjs`
- Test: `tests/districts.test.mjs`

**Interfaces:**
- Produces:
  - `DISTRICTS: string[]`：61 項，從 `~/code/sokahan-propalsal-2026/兄弟時光/問卷/建立問卷表單.gs` 的 `DISTRICTS` 一字不差、同順序複製。
  - `DISTRICT_ABBREVIATIONS: Record<string, string>`：先放 `{ 北東: '台北東區', 高北: '高雄北區' }`，Task 11 用 `checkSetup()` 補齊。
  - `normalizePlace(text: unknown): string`：轉字串、去掉所有空白（含換行）。
  - `resolveDistrict(text: unknown): string | null`：依序比對區全名、去掉結尾「區」的名稱、離島「（」前的短名（金門、馬祖、澎湖）、`DISTRICT_ABBREVIATIONS`。
  - `resolveCircle(text: unknown, circles: Record<string, string[]>): string | null`：只認 `circles` 裡有的圈，比對全名或去掉結尾「圈」的名稱。

- [ ] **Step 1: 寫失敗的測試**

```js
test('a district resolves from its full name, without 區, from an abbreviation and from an island short name', () => {
  assert.equal(resolveDistrict('花蓮區'), '花蓮區');
  assert.equal(resolveDistrict(' 花蓮 '), '花蓮區');
  assert.equal(resolveDistrict('北東'), '台北東區');
  assert.equal(resolveDistrict('高北'), '高雄北區');
  assert.equal(resolveDistrict('金門'), '金門（總合本部）');
  assert.equal(resolveDistrict('馬祖（基宜圈）'), '馬祖（基宜圈）');
});

test('role text, blanks and unknown names are not districts', () => {
  for (const text of ['圈負責人', '創價班總合長', '', undefined, '台北區']) assert.equal(resolveDistrict(text), null);
});

test('a circle resolves with or without 圈 and line breaks, only when the roster knows it', () => {
  const circles = { 花東圈: ['花蓮區', '台東區'], 桃園一圈: ['桃園北區', '桃園東區'] };
  assert.equal(resolveCircle('花東', circles), '花東圈');
  assert.equal(resolveCircle('桃園\n一圈', circles), '桃園一圈');
  assert.equal(resolveCircle('桃園圈', circles), null);
});

test('the district list follows the survey forms', () => {
  assert.equal(DISTRICTS.length, 61);
  assert.equal(DISTRICTS[0], '花蓮區');
  assert.equal(DISTRICTS.at(-1), '澎湖（南二圈）');
});
```

- [ ] **Step 2: 跑測試確認失敗**：`node --test tests/districts.test.mjs`，預期 FAIL（找不到模組）。
- [ ] **Step 3: 實作 `apps-script/districts.mjs`**：模組最外層只能宣告常數和函式，不能呼叫任何 Apps Script 服務（Task 6 會在空環境執行整支程式）。
- [ ] **Step 4: 跑測試確認通過**：`node --test tests/districts.test.mjs`，預期 PASS。
- [ ] **Step 5: Commit**：`git add apps-script/districts.mjs tests/districts.test.mjs && git commit -m "Resolve district and circle names for sign-in lists"`

---

### Task 2: 名單解析與合併

**Files:**
- Create: `apps-script/allowlist.mjs`
- Test: `tests/allowlist.test.mjs`

**Interfaces:**
- Consumes: Task 1 的 `DISTRICTS`、`normalizePlace`、`resolveDistrict`、`resolveCircle`。
- Produces:
  - `type Scope = { level: 'all' | 'circle' | 'district' | 'none', label: string, districts: string[] }`。all 的 label 是 `'全部'`、districts 是 `DISTRICTS`；none 的 label 是 `''`、districts 是 `[]`。
  - `type ListEntry = { email: string, scope: Scope }`
  - `NONE_SCOPE: Scope`
  - `extractEmails(cell: unknown): string[]`：全形「＠」轉半形、轉小寫、用正規式抽出所有信箱、`@gmail.com.tw` 改成 `@gmail.com`。
  - `parseRoster(rows: string[][]): { entries: ListEntry[], circles: Record<string, string[]> }`：`rows` 是 `getDisplayValues()`。表頭列是第一個同時含「區別」和「電子信箱」的列；欄位用表頭找「圈別」「區別」「電子信箱」。
  - `parseCadres(rows: string[][], circles: Record<string, string[]>, headers: { circle: string, district: string, emails: string[] }): ListEntry[]`：表頭列是第一個含 `headers.emails[0]` 的列。
  - `unresolvedPlaces(rows, circles, headers): string[]`：幹部名單裡圈或區有寫字、卻算出 none 的寫法，格式 `圈｜區`，去重、排序。
  - `SUPPLEMENT_HEADERS = ['信箱', '名字', '區', '加的人', '加的日期']`
  - `type SupplementRow = { email: string, name: string, district: string, addedBy: string, addedOn: string }`
  - `parseSupplement(rows: string[][]): SupplementRow[]`：第 1 列是表頭；沒有信箱、或區不在 `DISTRICTS` 的列略過。
  - `mergeAllowlist(lists: ListEntry[][]): Record<string, Scope>`

範圍規則（`parseRoster`）：先掃一遍，「圈別」往下沿用，每個「區別」解析得到區的列，把區加進當下沿用的圈，得到 `circles`。再掃一遍給每列範圍：沿用到的圈別含「企劃組」→ all；「區別」解析得到區 → district；沿用的圈在 `circles` 裡 → circle；其他 → none。
範圍規則（`parseCadres`）：區欄解析得到區 → district；圈欄解析得到圈 → circle；圈欄或區欄含「總部」→ all；其他 → none。兩個信箱欄都算。

- [ ] **Step 1: 寫失敗的測試**

```js
const ROSTER = [
  [],
  ['圈別', '區別', '職務', '姓名', '連絡電話', '電子信箱'],
  [],
  ['創價班\n企劃組', '創價班總合長', '', '甲', '', 'Plan.Lead@Gmail.com'],
  ['', '創價班企劃長', '', '乙', '', '事務長信箱  plan2@gmail.com'],
  ['花東圈', '圈負責人', '', '丙', '', 'circle＠gmail.com'],
  ['', '花蓮區', '區負責人', '丁', '', 'hualien@gmail.com.tw'],
  ['', '台東區', '區負責人', '戊', '', ''],
  ['板城圈', '圈負責人', '', '己', '', 'bancheng@gmail.com（主）'],
  ['', '板橋區', '區負責人', '庚', '', 'banqiao@yahoo.com.tw'],
];
const CIRCLES = { 花東圈: ['花蓮區', '台東區'], 板城圈: ['板橋區'] };
const CADRE_HEADERS = { circle: '圈', district: '區', emails: ['E-mail(1)', 'E-mail(2)'] };
const CADRES = [
  ['男子部幹部名單'],
  ['姓名', '職務', '圈', '區', 'E-mail(1)', 'E-mail(2)', '備註'],
  ['甲', '區長', '花東', '花蓮', 'one@gmail.com', '', ''],
  ['乙', '圈長', '花東', '', 'TWO@gmail.com', 'two.alt@gmail.com', ''],
  ['丙', '部長', '總部', '', 'hq@gmail.com', '', ''],
  ['丁', '區長', '北一', '北東', 'four@gmail.com', '', ''],
  ['戊', '區長', '火星圈', '火星', 'five@gmail.com', '', ''],
];
const levelOf = (entries, email) => entries.find((entry) => entry.email === email)?.scope;

test('emails come out of cells with notes, full-width ＠, capitals and the gmail.com.tw typo', () => {
  assert.deepEqual(extractEmails('事務長信箱  A.B@Gmail.com'), ['a.b@gmail.com']);
  assert.deepEqual(extractEmails('x＠gmail.com（主）'), ['x@gmail.com']);
  assert.deepEqual(extractEmails('y@gmail.com.tw'), ['y@gmail.com']);
  assert.deepEqual(extractEmails('a@g.ntu.edu.tw / b@gs.ncku.edu.tw'), ['a@g.ntu.edu.tw', 'b@gs.ncku.edu.tw']);
  assert.deepEqual(extractEmails(''), []);
});

test('the roster carries each circle down to its districts', () => {
  assert.deepEqual(parseRoster(ROSTER).circles, CIRCLES);
});

test('roster rows get the planning team, circle and district scopes', () => {
  const { entries } = parseRoster(ROSTER);
  assert.equal(levelOf(entries, 'plan.lead@gmail.com').level, 'all');
  assert.equal(levelOf(entries, 'plan2@gmail.com').level, 'all');
  assert.deepEqual(levelOf(entries, 'circle@gmail.com'), { level: 'circle', label: '花東圈', districts: ['花蓮區', '台東區'] });
  assert.deepEqual(levelOf(entries, 'hualien@gmail.com'), { level: 'district', label: '花蓮區', districts: ['花蓮區'] });
  assert.equal(levelOf(entries, 'bancheng@gmail.com').label, '板城圈');
  assert.equal(levelOf(entries, 'banqiao@yahoo.com.tw').label, '板橋區');
  assert.equal(entries.length, 6);
});

test('cadres resolve short circle names, abbreviations and headquarters, and count both email columns', () => {
  const circles = { ...CIRCLES, 北一圈: ['汐止區', '內湖區', '台北東區'] };
  const entries = parseCadres(CADRES, circles, CADRE_HEADERS);
  assert.equal(levelOf(entries, 'one@gmail.com').label, '花蓮區');
  assert.equal(levelOf(entries, 'two@gmail.com').label, '花東圈');
  assert.equal(levelOf(entries, 'two.alt@gmail.com').label, '花東圈');
  assert.equal(levelOf(entries, 'hq@gmail.com').level, 'all');
  assert.equal(levelOf(entries, 'four@gmail.com').label, '台北東區');
  assert.equal(levelOf(entries, 'five@gmail.com').level, 'none');
  assert.deepEqual(unresolvedPlaces(CADRES, circles, CADRE_HEADERS), ['火星圈｜火星']);
});

test('the supplement skips rows without an email or a known district', () => {
  const rows = [SUPPLEMENT_HEADERS, ['new@gmail.com', '小明', '花蓮區', 'hualien@gmail.com', '2027-01-15'], ['', '', '花蓮區', '', ''], ['x@gmail.com', '', '火星區', '', '']];
  assert.deepEqual(parseSupplement(rows), [{ email: 'new@gmail.com', name: '小明', district: '花蓮區', addedBy: 'hualien@gmail.com', addedOn: '2027-01-15' }]);
});

test('merging keeps the widest scope and joins districts at the same level', () => {
  const district = (name) => ({ level: 'district', label: name, districts: [name] });
  const merged = mergeAllowlist([
    [{ email: 'a@gmail.com', scope: district('花蓮區') }, { email: 'b@gmail.com', scope: district('花蓮區') }],
    [{ email: 'a@gmail.com', scope: NONE_SCOPE }, { email: 'b@gmail.com', scope: district('台東區') }],
  ]);
  assert.deepEqual(merged['a@gmail.com'], district('花蓮區'));
  assert.deepEqual(merged['b@gmail.com'], { level: 'district', label: '花蓮區、台東區', districts: ['花蓮區', '台東區'] });
});
```

- [ ] **Step 2: 跑測試確認失敗**：`node --test tests/allowlist.test.mjs`，預期 FAIL。
- [ ] **Step 3: 實作 `apps-script/allowlist.mjs`**，照上面的規則；不同模組之間不能有同名的最外層宣告（Task 6 會把它們拼在同一個範圍）。
- [ ] **Step 4: 跑測試確認通過**：`node --test tests/allowlist.test.mjs`，預期 PASS。
- [ ] **Step 5: Commit**：`git commit -m "Read the roster, cadre and supplement lists into sign-in scopes"`

---

### Task 3: 問卷回覆 → 一場一場的統計

**Files:**
- Create: `apps-script/responses.mjs`
- Test: `tests/responses.test.mjs`

**Interfaces:**
- Consumes: Task 1 `DISTRICTS`；Task 2 `Scope`。
- Produces:
  - `MIN_RESPONSES = 3`、`RECENT_SESSIONS = 3`、`TOP_WANTS = 3`
  - `PARTICIPANT_COLUMNS = { timestamp: '時間戳記', activity: '今天參加的活動', district: '你所在的區', listened: '認真聽你說話', closer: '變得更熟', different: '創價班活動比起來', again: '會想再來嗎', next: '下一次，你想參加哪一種' }`：表頭「包含」這段字就算那一欄。
  - `isParticipantHeader(header: string[]): boolean`：同時有 activity 和 district 欄。
  - `taipeiDate(ms: number): string`：加 8 小時取 UTC 日期（台灣沒有夏令時間）。
  - `type Response = { date, activity, district, listened, closer, different, again, next: string[] }`
  - `parseResponses(rows: unknown[][]): Response[]`：`rows[0]` 是表頭；時間戳記是 `Date` 或毫秒數；「下一次」用 `', '` 切開、去掉空字串；區不在 `DISTRICTS` 的列略過。
  - `type Session = { id, date, district, activity, responses: Response[] }`，`id = \`${date}|${district}|${activity}\``
  - `groupSessions(responses: Response[]): Session[]`：日期新到舊；同一天依區在 `DISTRICTS` 的順序、再依活動名稱。
  - `type SessionStats = { id, date, district, activity, responses: number, enough: boolean, answers?: { listened, closer, different, again: Record<string, number> }, next?: { name: string, count: number }[] }`：`enough` 為假時沒有 `answers`、`next` 這兩個 key。
  - `sessionStats(session: Session): SessionStats`
  - `type Wants = { sessions: number, responses: number, enough: boolean, top?: { name: string, count: number }[] }`
  - `districtWants(sessions: Session[], districts: string[]): Wants | null`：每一區取最近 `RECENT_SESSIONS` 場合起來；沒有任何一場回 `null`；回覆總數少於 `MIN_RESPONSES` 時 `enough: false`、沒有 `top`。
  - `statsFor(scope: Scope, sessions: Session[]): { wants: Wants | null, sessions: SessionStats[] }`：只回 `scope.districts` 的場次；`wants` 只給 district、circle 級，其他是 `null`。
  - 排名規則（`next`、`top` 共用）：票數多到少，同票依名稱字串比較（`a < b`），`top` 取前 `TOP_WANTS` 個。

- [ ] **Step 1: 寫失敗的測試**

```js
const HEADER = ['時間戳記', '今天參加的活動', '你所在的區', '今天有沒有人認真聽你說話？', '今天有沒有跟至少一個人變得更熟？',
  '這次活動跟你印象中的創價班活動比起來？', '下次類似的活動，你會想再來嗎？', '下一次，你想參加哪一種兄弟時光？', '今天有沒有一句話或一個瞬間留在心裡？（選填）'];
const reply = (iso, activity, district, next = '', answers = ['有', '有', '很不一樣', '會']) =>
  [new Date(iso), activity, district, ...answers, next, '留在心裡的話'];

test('a reply belongs to the Taiwan date it was sent', () => {
  assert.equal(taipeiDate(Date.parse('2027-01-15T15:30:00Z')), '2027-01-15');
  assert.equal(taipeiDate(Date.parse('2027-01-15T16:30:00Z')), '2027-01-16');
});

test('columns are found by title, even reordered or slightly renamed', () => {
  const header = [HEADER[2], HEADER[0], HEADER[1], '今天有沒有人認真聽你說話', ...HEADER.slice(4)];
  const [parsed] = parseResponses([header, ['花蓮區', new Date('2027-01-15T02:00:00Z'), '城市散步', '普通', '有', '差不多', '會', '', '']]);
  assert.equal(parsed.district, '花蓮區');
  assert.equal(parsed.listened, '普通');
});

test('replies without a known district are skipped and a blank next question counts no votes', () => {
  const parsed = parseResponses([HEADER, reply('2027-01-15T02:00:00Z', '城市散步', ''), reply('2027-01-15T02:00:00Z', '城市散步', '火星區'), reply('2027-01-15T02:00:00Z', '巷口泡茶會', '花蓮區')]);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].activity, '巷口泡茶會');
  assert.deepEqual(parsed[0].next, []);
});

test('replies group by district, activity and Taiwan date, newest first', () => {
  const sessions = groupSessions(parseResponses([HEADER,
    reply('2027-01-08T02:00:00Z', '城市散步', '花蓮區'), reply('2027-01-15T02:00:00Z', '城市散步', '花蓮區'),
    reply('2027-01-15T03:00:00Z', '城市散步', '花蓮區'), reply('2027-01-15T02:00:00Z', '桌遊之夜', '花蓮區')]));
  assert.deepEqual(sessions.map((session) => session.id), ['2027-01-15|花蓮區|城市散步', '2027-01-15|花蓮區|桌遊之夜', '2027-01-08|花蓮區|城市散步']);
});

test('a session with fewer than 3 replies shows no numbers', () => {
  const [session] = groupSessions(parseResponses([HEADER, reply('2027-01-15T02:00:00Z', '城市散步', '花蓮區'), reply('2027-01-15T03:00:00Z', '城市散步', '花蓮區')]));
  assert.deepEqual(sessionStats(session), { id: '2027-01-15|花蓮區|城市散步', date: '2027-01-15', district: '花蓮區', activity: '城市散步', responses: 2, enough: false });
});

test('a session counts each choice and splits the next question on ", "', () => {
  const [session] = groupSessions(parseResponses([HEADER,
    reply('2027-01-15T02:00:00Z', '城市散步', '花蓮區', '城市散步, 桌遊之夜'),
    reply('2027-01-15T02:01:00Z', '城市散步', '花蓮區', '城市散步', ['普通', '有', '差不多', '看時間']),
    reply('2027-01-15T02:02:00Z', '城市散步', '花蓮區', '')]));
  const stats = sessionStats(session);
  assert.deepEqual(stats.answers.listened, { 有: 2, 普通: 1 });
  assert.deepEqual(stats.next, [{ name: '城市散步', count: 2 }, { name: '桌遊之夜', count: 1 }]);
  assert.ok(!JSON.stringify(stats).includes('留在心裡的話'));
});

test('wants add up the latest 3 sessions of the district and leave the oldest out', () => {
  const rows = [HEADER];
  for (const [day, next] of [['01', '露營星空夜'], ['08', '桌遊之夜'], ['15', '桌遊之夜'], ['22', '城市散步']]) {
    for (const minute of ['00', '01']) rows.push(reply(`2027-01-${day}T02:${minute}:00Z`, '城市散步', '花蓮區', next));
  }
  assert.deepEqual(districtWants(groupSessions(parseResponses(rows)), ['花蓮區']), {
    sessions: 3, responses: 6, enough: true, top: [{ name: '桌遊之夜', count: 4 }, { name: '城市散步', count: 2 }],
  });
});

test('wants are not enough under 3 replies and null without sessions', () => {
  const sessions = groupSessions(parseResponses([HEADER, reply('2027-01-15T02:00:00Z', '城市散步', '花蓮區', '桌遊之夜')]));
  assert.deepEqual(districtWants(sessions, ['花蓮區']), { sessions: 1, responses: 1, enough: false });
  assert.equal(districtWants(sessions, ['台東區']), null);
});

test('stats show a district only its own sessions, give wants to district and circle levels, and nothing to none', () => {
  const sessions = groupSessions(parseResponses([HEADER, reply('2027-01-15T02:00:00Z', '城市散步', '花蓮區'), reply('2027-01-15T02:00:00Z', '城市散步', '台東區')]));
  const district = statsFor({ level: 'district', label: '花蓮區', districts: ['花蓮區'] }, sessions);
  assert.deepEqual(district.sessions.map((session) => session.district), ['花蓮區']);
  assert.notEqual(district.wants, null);
  assert.equal(statsFor({ level: 'all', label: '全部', districts: ['花蓮區', '台東區'] }, sessions).wants, null);
  assert.deepEqual(statsFor({ level: 'none', label: '', districts: [] }, sessions), { wants: null, sessions: [] });
});
```

- [ ] **Step 2: 跑測試確認失敗**：`node --test tests/responses.test.mjs`，預期 FAIL。
- [ ] **Step 3: 實作 `apps-script/responses.mjs`**；不讀「留在心裡」那一欄（`PARTICIPANT_COLUMNS` 沒有它）。
- [ ] **Step 4: 跑測試確認通過**：`node --test tests/responses.test.mjs`，預期 PASS。
- [ ] **Step 5: Commit**：`git commit -m "Turn participant survey replies into per-session stats"`

---

### Task 4: Google token 檢查與 session token

**Files:**
- Create: `apps-script/session-token.mjs`
- Test: `tests/session-token.test.mjs`

**Interfaces:**
- Produces:
  - `SESSION_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000`
  - `checkTokenInfo(info: object | null, clientId: string, nowMs: number): string | null`：回小寫信箱。條件全成立才回：`info.aud === clientId`、`info.email_verified` 是 `true` 或 `'true'`、`Number(info.exp) * 1000 > nowMs`、`info.iss` 是 `accounts.google.com` 或 `https://accounts.google.com`。
  - `makeSession(email: string, nowMs: number, sign: (text: string) => string): string`：`${encodeURIComponent(email)}.${nowMs}.${sign(`${encodeURIComponent(email)}.${nowMs}`)}`。
  - `readSession(token: unknown, nowMs: number, sign): string | null`：簽章相符且未滿 `SESSION_MAX_AGE_MS` 才回信箱。

- [ ] **Step 1: 寫失敗的測試**（`sign = (text) => createHmac('sha256', 'test-secret').update(text).digest('base64url')`，`node:crypto`）

```js
const NOW = Date.parse('2027-01-15T00:00:00Z');
const INFO = { aud: 'client.apps.googleusercontent.com', email: 'Hualien@Gmail.com', email_verified: 'true', exp: String(NOW / 1000 + 600), iss: 'https://accounts.google.com' };

test('a token issued to this site for a verified email gives the email in lower case', () => {
  assert.equal(checkTokenInfo(INFO, INFO.aud, NOW), 'hualien@gmail.com');
});

test('tokens for another site, unverified emails, expired or from another issuer are refused', () => {
  for (const change of [{ aud: 'other' }, { email_verified: 'false' }, { exp: String(NOW / 1000 - 1) }, { iss: 'evil.example' }]) {
    assert.equal(checkTokenInfo({ ...INFO, ...change }, INFO.aud, NOW), null);
  }
  assert.equal(checkTokenInfo(null, INFO.aud, NOW), null);
});

test('a session reads back as its email until it is a year old', () => {
  const token = makeSession('hualien@gmail.com', NOW, sign);
  assert.equal(readSession(token, NOW + 1000, sign), 'hualien@gmail.com');
  assert.equal(readSession(token, NOW + SESSION_MAX_AGE_MS, sign), null);
});

test('a changed email, time or signature and garbage are refused', () => {
  const [, time, signature] = makeSession('hualien@gmail.com', NOW, sign).split('.');
  assert.equal(readSession(`taitung%40gmail.com.${time}.${signature}`, NOW, sign), null);
  assert.equal(readSession(`hualien%40gmail.com.${NOW + 1}.${signature}`, NOW, sign), null);
  for (const garbage of ['', 'a.b', undefined, 'a.b.c.d']) assert.equal(readSession(garbage, NOW, sign), null);
});
```

- [ ] **Step 2: 跑測試確認失敗**：`node --test tests/session-token.test.mjs`，預期 FAIL。
- [ ] **Step 3: 實作 `apps-script/session-token.mjs`**。
- [ ] **Step 4: 跑測試確認通過**，預期 PASS。
- [ ] **Step 5: Commit**：`git commit -m "Check Google ID tokens and sign our own sessions"`

---

### Task 5: 請求路由與權限

**Files:**
- Create: `apps-script/api.mjs`
- Test: `tests/api.test.mjs`

**Interfaces:**
- Consumes: Task 2 `extractEmails`、`Scope`、`SupplementRow`；Task 3 `taipeiDate`；Task 4 `checkTokenInfo`、`makeSession`、`readSession`。
- Produces: `handleRequest(request: object, deps: Deps): object`

```
Deps = {
  clientId: string,
  now(): number,
  sign(text: string): string,
  tokenInfo(idToken: string): object | null,
  allowlist(): Record<string, Scope>,
  stats(scope: Scope): { wants, sessions },
  supplement: { list(): SupplementRow[], add(row: SupplementRow): void, remove(email: string, district: string): boolean },
}
```

瀏覽器依賴的回應格式：

| action | 請求欄位 | 成功回應 |
|---|---|---|
| `signIn` | `idToken` | 在名單：`{ ok: true, listed: true, email, session, scope }`；不在：`{ ok: true, listed: false, email }` |
| `me` | `session` | `{ ok: true, listed: true, email, scope }` 或 `{ ok: true, listed: false, email }` |
| `stats` | `session` | `{ ok: true, wants, sessions }` |
| `hosts` | `session`、`district` | `{ ok: true, hosts: [{ email, name, addedOn }] }`，新到舊 |
| `addHost` | `session`、`district`、`email`、`name`（選填） | `{ ok: true, added: true }` 或 `{ ok: true, added: false, reason: 'already-listed' }` |
| `removeHost` | `session`、`district`、`email` | `{ ok: true, removed: boolean }` |

錯誤一律 `{ ok: false, error }`：`bad-request`（不認得的 action、缺欄位）、`bad-token`、`bad-session`、`not-listed`（`stats`／`hosts`／`addHost`／`removeHost` 時人已不在名單）、`forbidden`（範圍是 none，或 `district` 不在 `scope.districts`）、`bad-email`。
`addHost` 寫入的列：`{ email: extractEmails(email)[0], name: name 去頭尾空白, district, addedBy: 呼叫者信箱, addedOn: taipeiDate(now) }`。

- [ ] **Step 1: 寫失敗的測試**：用假的 `deps`（`sign` 同 Task 4、`tokenInfo` 照 idToken 回不同 info、`supplement` 記下呼叫）。測試名稱與斷言：
  - `signing in with a listed account returns a session that me accepts`：`signIn` 回 `listed: true`、`scope` 等於名單上的範圍；拿回傳的 `session` 打 `me` 得到同一個 `email`。
  - `a token for another site is refused`：`aud` 不同 → `{ ok: false, error: 'bad-token' }`。
  - `an unlisted account learns which email it used and gets no session`：`{ ok: true, listed: false, email }`，回應沒有 `session` key。
  - `me reports a person taken off the lists`：同一張 session，名單拿掉後 `me` 回 `listed: false`；`stats` 回 `not-listed`。
  - `stats are forbidden to the supplement list and passed the caller's scope otherwise`：none 範圍 → `forbidden`；district 範圍 → `deps.stats` 收到的就是那個 scope。
  - `adding a host stays inside the caller's districts and records who and when`：別區 → `forbidden`；自己區、`'New＠Gmail.com'`、`' 小明 '` → `supplement.add` 收到 `{ email: 'new@gmail.com', name: '小明', district: '花蓮區', addedBy: 呼叫者, addedOn: '2027-01-15' }`。
  - `adding someone already listed or something that is not an email changes nothing`：已在名單 → `{ ok: true, added: false, reason: 'already-listed' }`、`add` 沒被呼叫；`'王小明'` → `bad-email`。
  - `hosts list only that district, newest first, without who added them`：回應的每一項只有 `email`、`name`、`addedOn`。
  - `removing a host from another district is forbidden`。
  - `unknown actions and tampered sessions are refused`：`bad-request`、`bad-session`。
- [ ] **Step 2: 跑測試確認失敗**：`node --test tests/api.test.mjs`，預期 FAIL。
- [ ] **Step 3: 實作 `handleRequest`**（同步函式；Apps Script 沒有 async 的需要）。
- [ ] **Step 4: 跑測試確認通過**，預期 PASS。
- [ ] **Step 5: Commit**：`git commit -m "Route sign-in, stats and host requests with district permissions"`

---

### Task 6: Apps Script 外殼與打包

**Files:**
- Create: `apps-script/server.js`、`apps-script/appsscript.json`、`scripts/build-apps-script.mjs`
- Modify: `package.json`（加 `"build:apps-script": "node scripts/build-apps-script.mjs"`）、`.gitignore`（加 `dist-apps-script/`、`apps-script/.clasp.json`）、`README.md`（新增「登入用的 Apps Script」一節）
- Test: `tests/apps-script-bundle.test.mjs`

**Interfaces:**
- Consumes: Task 1–5 的全部 export。
- Produces:
  - `scripts/build-apps-script.mjs`：`buildAppsScript({ outDir = 'dist-apps-script' } = {}): Promise<{ files: string[] }>`，依 `APPS_SCRIPT_MODULES = ['districts', 'allowlist', 'responses', 'session-token', 'api']` 的順序讀 `apps-script/<name>.mjs`，刪掉 `import` 開頭的行、去掉行首的 `export `，最後接上 `server.js`，寫成 `Code.js`（第一行註明是產生的、不要直接改）；複製 `appsscript.json`。用 `import.meta.main` 當 CLI。
  - `server.js` 的全域函式：`doPost(e)`、`checkSetup()`、`createSupplementSheet()`；常數 `CADRE_HEADERS = { circle: '圈', district: '區', emails: ['E-mail(1)', 'E-mail(2)'] }`（Task 11 換成幹部名單真正的表頭字）。
  - Script Properties：`CLIENT_ID`、`SESSION_SECRET`、`ROSTER_ID`、`ROSTER_SHEET`、`CADRE_ID`、`SUPPLEMENT_ID`、`RESPONSES_ID`。
  - `appsscript.json`：`timeZone: 'Asia/Taipei'`、`runtimeVersion: 'V8'`、`webapp: { executeAs: 'USER_DEPLOYING', access: 'ANYONE_ANONYMOUS' }`、`oauthScopes: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/script.external_request']`。

`server.js` 要做的事：
- `doPost(e)`：`JSON.parse(e.postData.contents)` → `handleRequest(request, deps)`；丟例外時 `console.error` 並回 `{ ok: false, error: 'server' }`；用 `ContentService` 回 JSON。
- `sign`：`Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(text, SESSION_SECRET))`。
- `tokenInfo`：`UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken), { muteHttpExceptions: true })`，200 才 `JSON.parse`，否則 `null`。
- `allowlist`：CacheService 鍵 `allowlist`、600 秒；沒有就讀通訊錄（`ROSTER_ID` 的 `ROSTER_SHEET` 分頁）、幹部名單（`CADRE_ID` 第一個分頁）、補充名單（`SUPPLEMENT_ID` 第一個分頁），都用 `getDisplayValues()`，補充名單每列轉成 `{ email, scope: NONE_SCOPE }`，`mergeAllowlist` 合併。
- `stats(scope)`：快取鍵 `stats:all` 或 `stats:` + `scope.districts.join(',')`、600 秒，`put` 丟例外（太大）就不快取；沒有就在 `RESPONSES_ID` 找表頭符合 `isParticipantHeader` 的分頁，`getDataRange().getValues()` → `parseResponses` → `groupSessions` → `statsFor`。
- `supplement.add` / `remove`：`LockService.getScriptLock().waitLock(10000)`；`add` 用 `appendRow`；`remove` 從最後一列往上找信箱和區都相符的列 `deleteRow`；兩者都清掉快取 `allowlist`。
- `checkSetup()`：用 `Logger.log` 印各來源筆數、合併後人數與各級人數、`unresolvedPlaces` 清單、找到的問卷分頁名稱與回覆數、缺哪些 Script Properties。不印任何信箱。
- `createSupplementSheet()`：建「兄弟時光｜補充名單」，第 1 列放 `SUPPLEMENT_HEADERS`、凍結第 1 列，把 ID 寫進 Script Property `SUPPLEMENT_ID`，印出網址。

- [ ] **Step 1: 寫失敗的測試**

```js
test('the bundle has no import or export lines and defines the Apps Script entry points', async () => {
  const outDir = await mkdtemp(path.join(tmpdir(), 'apps-script-'));
  await buildAppsScript({ outDir });
  const code = await readFile(path.join(outDir, 'Code.js'), 'utf8');
  assert.doesNotMatch(code, /^\s*(import|export)\s/m);
  const context = {};
  vm.runInNewContext(code, context);
  for (const name of ['doPost', 'checkSetup', 'createSupplementSheet', 'handleRequest']) assert.equal(typeof context[name], 'function', name);
});

test('the web app runs as the deployer, on Taiwan time, and anyone can call it', async () => {
  const manifest = JSON.parse(await readFile(new URL('../apps-script/appsscript.json', import.meta.url), 'utf8'));
  assert.deepEqual(manifest.webapp, { executeAs: 'USER_DEPLOYING', access: 'ANYONE_ANONYMOUS' });
  assert.equal(manifest.timeZone, 'Asia/Taipei');
});

test('no spreadsheet id is written into the Apps Script source', async () => {
  const dir = new URL('../apps-script/', import.meta.url);
  for (const name of await readdir(dir)) {
    if (!/\.(mjs|js|json)$/.test(name)) continue;
    assert.doesNotMatch(await readFile(new URL(name, dir), 'utf8'), /[A-Za-z0-9_-]{40,}/, name);
  }
});
```

- [ ] **Step 2: 跑測試確認失敗**：`node --test tests/apps-script-bundle.test.mjs`，預期 FAIL。
- [ ] **Step 3: 實作 `scripts/build-apps-script.mjs`、`apps-script/server.js`、`apps-script/appsscript.json`**，改 `package.json`、`.gitignore`。
- [ ] **Step 4: 跑測試確認通過**：`npm test`，預期全部 PASS；`npm run build:apps-script` 印出寫了 `Code.js`、`appsscript.json`。
- [ ] **Step 5: README 新增「登入用的 Apps Script」**：程式在哪、`npm run build:apps-script`、Script Properties 的名稱與用途（不寫值）、`cd apps-script && clasp push` 後要 `clasp deploy -i <部署 ID>` 才會更新同一個 `/exec` 網址、`checkSetup()` 怎麼看、對不到的區名補進 `DISTRICT_ABBREVIATIONS`。
- [ ] **Step 6: Commit**：`git commit -m "Bundle the sign-in Apps Script and document how to deploy it"`

---

### Task 7: 網站設定與登入閘門的骨架

**Files:**
- Create: `src/lib/signin.mjs`、`src/render/signin.mjs`
- Modify: `src/lib/schema.mjs`、`src/render/layout.mjs`、`scripts/build.mjs`、`src/styles/site.css`、`README.md`（新增「登入」一節）
- Test: `tests/schema.test.mjs`、`tests/signin-head.test.mjs`、`tests/build.test.mjs`、`tests/styles.test.mjs`

**Interfaces:**
- Produces:
  - `site.signIn`（選填）：`{ clientId: string, endpoint: string }`。`validateSite` 檢查 `clientId` 符合 `/^[\w-]+\.apps\.googleusercontent\.com$/`，`endpoint` 符合 `/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/`；錯誤訊息照現有中文風格，分別點名 `signIn.clientId`、`signIn.endpoint`。
  - `src/lib/signin.mjs`：`SIGNIN_STORAGE_KEY = 'brotime.signin'`；`parseSigninRecord(raw: string | null): Record | null`（是物件、`email` 和 `session` 是非空字串才回）。**這個函式不能引用模組裡的其他名稱**，因為它會被轉成字串放進 `<head>`。
  - `type Record = { email: string, session: string, scope: Scope, checkedAt: number }`
  - `src/render/signin.mjs`：
    - `SIGNIN_HEAD_SCRIPT: string`：`(${headCheck})(${JSON.stringify(SIGNIN_STORAGE_KEY)}, ${parseSigninRecord})`；讀 localStorage，`parseSigninRecord` 回 `null` 或任何例外 → `document.documentElement.classList.add('signin-needed')`。
    - `renderSigninPanel(): string`、`signinConfigScript(signIn): string`（`<script type="application/json" id="signin-config">`，用 `jsonForScript`）。
  - `page({ ..., signIn })`：有 `signIn` 時，`<head>` 在 leave-line 小程式之後加 `<script>${SIGNIN_HEAD_SCRIPT}</script>`；`<main>` 前面放面板和設定 JSON；`scripts` 最前面加 `js/signin.js`。
  - `scripts/build.mjs`：首頁、`all/`、上線與準備中的活動頁、電子一番賞傳 `signIn: site.signIn`；故事卡頁、新手小抄頁不傳。
  - CSS：`html.signin-needed main { display: none; }`、`.signin { display: none; }`、`html.signin-needed .signin { display: block; }`，面板其餘樣式用 palette 變數，要像入口頁、不像後台。

登入面板文字（照設計文件第 6 節，一字不改）：

```html
<section class="signin" aria-live="polite">
<div data-view="start">
<h1>下個月，約兄弟做什麼？</h1>
<p>這裡是給各區帶兄弟時光的人用的。請用創價班通訊錄上登記的 Gmail 登入。</p>
<div class="signin-button"></div>
<p class="signin-line" hidden>在 LINE 裡沒辦法用 Google 登入。請點右上角「⋯」，選「用預設瀏覽器開啟」。</p>
<p class="signin-error" hidden></p>
<p class="signin-note">通訊錄上登記的不是 Gmail，或還沒登記？請你們區的區負責人在網站上把你的 Gmail 加進名單。</p>
</div>
<div data-view="not-listed" hidden>
<h1>這個帳號還不在名單上</h1>
<p>你登入的信箱是</p>
<p class="signin-email"></p>
<p>名單照創價班通訊錄。你也會帶兄弟時光的話，請把上面這個信箱傳給你們區的區負責人，請他在網站上把你加進名單。</p>
<div class="signin-actions"><button type="button" data-action="copy">複製這個信箱</button><button type="button" data-action="switch">換一個 Google 帳號</button></div>
<p class="signin-note">只是想看故事卡？主持人分享給你的故事卡連結，不用登入就能看。</p>
</div>
</section>
```

- [ ] **Step 1: 寫失敗的測試**
  - `tests/schema.test.mjs`：`a site without signIn is valid`；`a site with a Google client id and an Apps Script exec url is valid`；`a malformed client id or endpoint is named in the error`（錯誤字串分別含 `signIn.clientId`、`signIn.endpoint`）。
  - `tests/signin-head.test.mjs`（照 `tests/leave-line.test.mjs` 用 `vm.runInNewContext` 和假的 `localStorage`、`document`）：
    - `without a record the page asks to sign in`：加了 `signin-needed`。
    - `a broken record, a record without a session, or storage that throws asks to sign in instead of breaking the page`：三種情況都加 `signin-needed`、`vm` 不丟例外。
    - `a record with an email and a session lets the page show`：沒有加任何 class。
  - `tests/build.test.mjs`：用現有的 `renderPages({ site: fixtureSite(), ... })` 寫法，`site` 加 `signIn: { clientId: 'test.apps.googleusercontent.com', endpoint: 'https://script.google.com/macros/s/test/exec' }`：
    - `with signIn, entry, all, activity, preparing and ichiban pages carry the sign-in panel; card and guide pages do not`：前者都含 `class="signin"`、`id="signin-config"`、`js/signin.js`、`signin-needed`；後者三個都不含。
    - `without signIn no page mentions sign-in`：所有頁都不含 `signin`。
  - `tests/styles.test.mjs`：`rule('html.signin-needed main')` 符合 `/display: none;/`。
- [ ] **Step 2: 跑測試確認失敗**：`npm test`，預期新測試 FAIL。
- [ ] **Step 3: 實作**上面列的檔案。
- [ ] **Step 4: 跑測試確認通過**：`npm test`、`npm run build`，預期全部 PASS（正式 `site.json` 還沒有 `signIn`，輸出頁跟改之前一樣）。
- [ ] **Step 5: README 新增「登入」一節**：哪些頁要登入、`site.signIn` 兩個欄位是什麼、拿掉 `signIn` 就整個關掉、名單和統計都在 Apps Script（見上一節）。
- [ ] **Step 6: Commit**：`git commit -m "Gate the planning pages behind a sign-in panel when signIn is configured"`

---

### Task 8: 登入面板的行為

**Files:**
- Modify: `src/lib/signin.mjs`
- Create: `src/client/signin.js`
- Test: `tests/signin.test.mjs`

**Interfaces:**
- Consumes: Task 5 的回應格式；Task 7 的面板 HTML、`#signin-config`、`SIGNIN_STORAGE_KEY`、`parseSigninRecord`。
- Produces（`src/lib/signin.mjs`）：
  - `RECHECK_AFTER_MS = 24 * 60 * 60 * 1000`
  - `needsRecheck(record: Record, nowMs: number): boolean`：沒有 `checkedAt`，或 `nowMs - checkedAt >= RECHECK_AFTER_MS`。
  - `recheckOutcome(response: object | null): 'keep' | 'update' | 'sign-out'`：`null` → keep；`ok` 且 `listed` → update；`ok` 且未 `listed` → sign-out；錯誤是 `bad-session` 或 `not-listed` → sign-out；其他錯誤 → keep。
  - `recordFrom(response: object, session: string, nowMs: number): Record`：`{ email: response.email, session, scope: response.scope, checkedAt: nowMs }`。
  - `isInLine(userAgent: string): boolean`：`/\bLine\//i`。
- Produces（`src/client/signin.js`，ES module）：
  - `callApi(action: string, body?: object): Promise<object | null>`：`fetch(endpoint, { method: 'POST', body: JSON.stringify({ action, session, ...body }) })`；網路或 JSON 失敗回 `null`；回應錯誤是 `bad-session` 或 `not-listed` 時清掉紀錄、加回 `signin-needed`、顯示開始畫面，仍回傳該回應。
  - `whenSignedIn(): Promise<Record>`：已有紀錄就立刻 resolve，否則登入成功時 resolve。
  - 載入時的行為：
    - `signin-needed` 時：在 LINE 裡顯示 `.signin-line`、不載 Google；否則動態載入 `https://accounts.google.com/gsi/client`，`google.accounts.id.initialize({ client_id, callback })`，在 `.signin-button` `renderButton`（`{ theme: 'outline', size: 'large', text: 'signin_with', locale: 'zh-TW' }`）。Google 的程式載不到時 `.signin-error` 顯示「連不上 Google，請確認網路後重新整理。」
    - Google 回呼：`callApi('signIn', { idToken: credential })` → 在名單：存紀錄、拿掉 `signin-needed`、resolve `whenSignedIn`；不在名單：切到 not-listed 畫面、填入信箱；`null` 或其他錯誤：「登入沒有成功，請再試一次。」
    - 「複製這個信箱」：`navigator.clipboard.writeText`，按鈕字改成「複製好了」。「換一個 Google 帳號」：`google.accounts.id.disableAutoSelect()`，回到開始畫面。
    - 已有紀錄、`needsRecheck` 為真、`navigator.onLine`：背景 `callApi('me')`，照 `recheckOutcome` 更新紀錄、登出，或不動。

- [ ] **Step 1: 寫失敗的測試**
  - `the record stays when the check cannot reach the server`：`recheckOutcome(null)`、`recheckOutcome({ ok: false, error: 'server' })` 都是 `'keep'`。
  - `a listed answer updates the record and an unlisted or invalid one signs out`：`{ ok: true, listed: true }` → update；`{ ok: true, listed: false }`、`{ ok: false, error: 'bad-session' }`、`{ ok: false, error: 'not-listed' }` → sign-out。
  - `a record is checked again after a day`：`checkedAt` 是 23 小時 59 分前 → false；24 小時前 → true；沒有 `checkedAt` → true。
  - `the LINE browser is recognised on iPhone and Android but not Safari`：用 `tests/leave-line.test.mjs` 的三個 UA 字串。
  - `a record keeps the session it was given`：`recordFrom({ email, scope }, 'tok', NOW)` 等於 `{ email, session: 'tok', scope, checkedAt: NOW }`。
- [ ] **Step 2: 跑測試確認失敗**：`node --test tests/signin.test.mjs`，預期 FAIL。
- [ ] **Step 3: 實作** `src/lib/signin.mjs` 新增的函式和 `src/client/signin.js`。
- [ ] **Step 4: 跑測試確認通過**：`npm test`，預期 PASS。
- [ ] **Step 5: 本機看畫面**：`site.json` 暫時加假的 `signIn`，`npm run preview && npm run serve`，在 http://localhost:8766 看到開始畫面且 `<main>` 沒有先閃出來；故事卡頁直接顯示；用 Chrome DevTools 切成 LINE UA 看到 LINE 提示。看完把假的 `signIn` 拿掉（不 commit）。
- [ ] **Step 6: Commit**：`git commit -m "Sign in with Google from the panel and re-check in the background"`

---

### Task 9: 首頁「你們區的人想約」與回顧頁

**Files:**
- Create: `src/lib/stats-view.mjs`、`src/render/stats.mjs`、`src/client/stats-data.js`、`src/client/district-wants.js`、`src/client/stats.js`、`src/client/stats-session.js`
- Modify: `src/render/entry.mjs`、`scripts/build.mjs`、`src/styles/site.css`
- Test: `tests/stats-view.test.mjs`、`tests/render-stats.test.mjs`、`tests/render-entry.test.mjs`、`tests/build.test.mjs`

**Interfaces:**
- Consumes: Task 3 的 `SessionStats`、`Wants`；Task 8 的 `callApi`、`whenSignedIn`。
- Produces：
  - `src/lib/stats-view.mjs`：
    - `STATS_PATH = 'stats/'`、`SESSION_PATH = 'stats/session/'`、`HOSTS_PATH = 'hosts/'`
    - `ANSWER_ROWS`：`[{ key: 'listened', label: '今天有沒有人認真聽你說話？', choices: ['有', '普通', '沒有'] }, { key: 'closer', label: '今天有沒有跟至少一個人變得更熟？', choices: ['有', '普通', '沒有'] }, { key: 'different', label: '跟印象中的創價班比起來？', choices: ['很不一樣', '有點不一樣', '差不多'] }, { key: 'again', label: '下次還會想再來嗎？', choices: ['會', '看時間', '不會'] }]`
    - `wantsHeading(level: 'district' | 'circle'): string`：`'你們區的人想約'`／`'你們圈的人想約'`
    - `wantsCaption(wants: Wants): string`：`根據最近 ${sessions} 場、共 ${responses} 份問卷`
    - `shortDate(iso: string): string`：`'2027-01-15'` → `'1/15（五）'`
    - `choiceCounts(counts: Record<string, number>, choices: string[]): { choice: string, count: number }[]`：照 `choices` 順序、沒有的補 0。
    - `activityHref(name: string, idsByName: Record<string, string>, rel: string): string | null`
    - `NOT_ENOUGH_TEXT = '回覆還不夠（少於 3 份），先不列出來，免得認出是誰填的。'`
    - `WANTS_NOT_ENOUGH_TEXT = '問卷回覆還不夠，再多幾場就看得到。'`
  - `src/render/stats.mjs`：`renderStatsMain({ rel })`、`renderSessionMain({ rel })`、`activityIdsScript(activities): string`（`<script type="application/json" id="activity-ids">`，名稱 → id，用 `jsonForScript`）。
  - `renderHomeMain({ ..., districtWants = false })`：為真時在 `.featured` 裡第一個 `season` 區塊前面放 `<section class="district-wants" hidden></section>`（沒有 season 就放 `.featured` 最後）。
  - `scripts/build.mjs`，只在有 `site.signIn` 時：首頁 `districtWants: true`、scripts 加 `js/district-wants.js`、附 `activityIdsScript`；新增 `stats/index.html`（title `每一場的回顧｜${site.title}`、rel `../`、scripts `['js/stats.js']`）和 `stats/session/index.html`（rel `../../`、scripts `['js/stats-session.js']`），兩頁都 `leaveLine: true`、傳 `signIn`、附 `activityIdsScript`。
  - `src/client/stats-data.js`：`loadStats(): Promise<{ wants, sessions } | null>`，sessionStorage 鍵 `brotime.stats`，10 分鐘內用快取，否則 `callApi('stats')`。

頁面骨架（`renderStatsMain`）：

```html
<header class="stats-head"><h1>每一場的回顧</h1><p class="lead">參加者問卷的結果，一場一頁。</p></header>
<label class="stats-district" hidden>哪一區 <select></select></label>
<p class="stats-status">讀取中…</p>
<ul class="stats-list"></ul>
<p class="hosts-link"><a href="${rel}hosts/">加一位主持人 →</a></p>
<p class="home-link"><a href="${rel}">← 回到推薦</a></p>
```

`renderSessionMain`：`<p class="stats-status">讀取中…</p>`、`<article class="session" hidden></article>`、`<p class="home-link"><a href="${rel}stats/">← 回到每一場的回顧</a></p>`。

瀏覽器行為：
- `district-wants.js`：`await whenSignedIn()`；範圍 none 不動；`loadStats()` 失敗不動。all 級只顯示連結「看每一場的回顧 →」。district／circle 級有 `wants` 時：`<h2>` 用 `wantsHeading`；`enough` 時列 `top`（名稱有 `activityHref` 就連過去，後面「・N 人」）加 `wantsCaption`；不夠時顯示 `WANTS_NOT_ENOUGH_TEXT`；最後是同一個連結。`wants` 是 `null` 時只顯示連結。
- `stats.js`：範圍 none 顯示「每一場的回顧是給區負責人和幹部看的。」並藏起加主持人連結。區超過一個時顯示下拉（「全部」＋各區），選擇記在網址 `?d=`（`history.replaceState`），從單場頁回來還在。每一列 `<a href="session/?id=${encodeURIComponent(id)}">${shortDate(date)} ${activity}・${district}</a>` 加小字「N 份問卷」。沒有場次：「還沒有問卷回覆。參加者填了問卷，這裡就會出現。」連不上：「連不上，等一下再試一次。」
- `stats-session.js`：用 `?id=` 找場次；找不到：「找不到這一場，可能不在你看得到的區。」標題是活動名稱（有 `activityHref` 就連過去），下一行 `${shortDate}・${district}・${responses} 份問卷`。`enough` 為假：`NOT_ENOUGH_TEXT`。否則每個 `ANSWER_ROWS` 一個 `<h2>`，用 `choiceCounts` 列出每個選項的人數和長條（寬度＝人數／回覆數）；最後 `<h2>下一次想參加哪一種</h2>` 列「名稱・N 人」，沒有人勾就寫「沒有人勾。」

- [ ] **Step 1: 寫失敗的測試**

```js
test('dates read as month/day with the weekday', () => {
  assert.equal(shortDate('2027-01-15'), '1/15（五）');
  assert.equal(shortDate('2026-11-03'), '11/3（二）');
});

test('wants are captioned with how many sessions and replies they come from', () => {
  assert.equal(wantsCaption({ sessions: 3, responses: 12 }), '根據最近 3 場、共 12 份問卷');
  assert.equal(wantsHeading('district'), '你們區的人想約');
  assert.equal(wantsHeading('circle'), '你們圈的人想約');
});

test('choices keep the survey order and show zero for choices nobody picked', () => {
  assert.deepEqual(choiceCounts({ 有: 2 }, ['有', '普通', '沒有']), [{ choice: '有', count: 2 }, { choice: '普通', count: 0 }, { choice: '沒有', count: 0 }]);
});

test('an activity links to its page, an old name that no page has gets no link', () => {
  assert.equal(activityHref('城市散步', { 城市散步: 'city-walk' }, '../'), '../a/city-walk/');
  assert.equal(activityHref('巷口泡茶會', { 城市散步: 'city-walk' }, '../'), null);
});
```

  - `tests/render-stats.test.mjs`：`the stats page links to adding a host and back home`（rel `../` 時含 `href="../hosts/"`、`href="../"`）；`the session page links back to the stats list`（rel `../../` 時含 `href="../../stats/"`）；`activity ids are embedded as name to id and cannot close the script tag`（名稱含 `</script>` 的假活動被跳脫）。
  - `tests/render-entry.test.mjs`：`the district wants block sits between the pushes and the season`（`districtWants: true` 時 `class="district-wants"` 出現在 `class="push"` 之後、`class="season"` 之前）；`without sign-in the home page has no district wants block`。
  - `tests/build.test.mjs`：`with signIn the stats pages are built behind sign-in and the home page loads the wants script`；`without signIn there are no stats pages`。
- [ ] **Step 2: 跑測試確認失敗**：`npm test`，預期新測試 FAIL。
- [ ] **Step 3: 實作**上面列的檔案。
- [ ] **Step 4: 跑測試確認通過**：`npm test`、`npm run build`，預期 PASS。
- [ ] **Step 5: Commit**：`git commit -m "Show district wants on the home page and a review page per session"`

---

### Task 10: 加一位主持人

**Files:**
- Modify: `src/render/stats.mjs`、`scripts/build.mjs`、`src/styles/site.css`
- Create: `src/client/hosts.js`
- Test: `tests/render-stats.test.mjs`、`tests/build.test.mjs`

**Interfaces:**
- Consumes: Task 5 的 `hosts`、`addHost`、`removeHost`；Task 8 `callApi`、`whenSignedIn`；Task 9 `shortDate`、`HOSTS_PATH`。
- Produces：`renderHostsMain({ rel }): string`；有 `site.signIn` 時 build 產生 `hosts/index.html`（title `加一位主持人｜${site.title}`、rel `../`、scripts `['js/hosts.js']`、`leaveLine: true`、傳 `signIn`）。

頁面骨架：

```html
<header class="stats-head"><h1>加一位主持人</h1>
<p class="lead">不是幹部、但會帶兄弟時光的人，貼上他的 Gmail 就加好了。加進來的人可以登入、用當天模式，看不到問卷結果。</p></header>
<label class="stats-district" hidden>哪一區 <select></select></label>
<form class="host-form">
<label>Gmail <input type="email" name="email" required autocomplete="off" inputmode="email"></label>
<label>名字（選填）<input type="text" name="name" autocomplete="off"></label>
<button type="submit">加進名單</button>
<p class="host-result" role="status"></p>
</form>
<section class="host-list"><h2></h2><ul></ul></section>
<p class="home-link"><a href="${rel}stats/">← 回到每一場的回顧</a></p>
```

瀏覽器行為（`hosts.js`）：範圍 none 時把表單換成「加主持人要請你們區的區負責人幫忙。」。區超過一個時顯示下拉，district 級預設自己區，其他預設第一區。列表標題 `${district}加過的人`，每一項 `${name ? `${name}・` : ''}${email}・${shortDate(addedOn)} 加` 加「拿掉」按鈕（直接拿掉、不跳確認框，拿掉後重抓列表）；沒有人：「這一區還沒有加過人。」送出時按鈕停用，結果：加好 →「加好了，請他用這個 Gmail 登入。」、清空表單、重抓列表；`already-listed` →「這個信箱已經在名單上了，直接登入就可以。」；`bad-email` →「這看起來不是信箱，再檢查一下。」；`null` →「連不上，等一下再試一次。」

- [ ] **Step 1: 寫失敗的測試**：`the hosts page has an email field, an optional name and a way back to the stats list`（含 `type="email" name="email"`、`name="name"`、`href="../stats/"`）；`with signIn the hosts page is built behind sign-in; without it there is none`。
- [ ] **Step 2: 跑測試確認失敗**，預期 FAIL。
- [ ] **Step 3: 實作**。
- [ ] **Step 4: 跑測試確認通過**：`npm test`、`npm run build`，預期 PASS。
- [ ] **Step 5: Commit**：`git commit -m "Let district leaders add and remove hosts for their district"`

---

### 上線前的 review 與推上 main

- [ ] 用 `superpowers:requesting-code-review` 看整個分支，**最多兩輪**，照 `~/CLAUDE.md` 的三道閘門取捨；沒修的記到 `HANDOFF.md` 檔尾延後清單。
- [ ] `npm test && npm run build` 通過後 push main。正式 `site.json` 還沒有 `signIn`，網站外觀不變；看 Actions 部署成功、正式網站照舊。

---

### Task 11: 上線（需要使用者先決定或動手的事）

**開工前要問使用者：**
1. 補充名單建在哪：由部署帳號跑 `createSupplementSheet()` 直接建在部署帳號的 Drive（不用另外共用）；或建在企劃室帳號的 Drive，再把編輯權共用給部署帳號。
2. 部署帳號用讀得到兩份名單的那個個人 Gmail（帳號記在本機記憶 `brotime-login-allowlist-sources.md`）。要確認它讀得到「兄弟時光｜問卷回覆」試算表（由企劃室帳號建的）；讀不到就請企劃室帳號共用檢視權。
3. 在 GCP 專案 `sokahan` 建 OAuth 用戶端（類型「網頁應用程式」），授權的 JavaScript 來源是 `https://kyodai-tokimitsu.twsokahan.org` 和 `http://localhost:8766`；OAuth 同意畫面只用預設的 email、profile 範圍。誰建、用哪個帳號。
4. clasp 目前沒有登入（`clasp show-authorized-user` 顯示 unknown user）。要用部署帳號 `clasp login`，並在 https://script.google.com/home/usersettings 打開 Apps Script API；做不到就把 `dist-apps-script/Code.js` 貼進 script.google.com 的編輯器。

- [ ] **Step 1: 幹部名單表頭**：用 google_workspace（部署帳號）讀幹部名單前 3 列，把圈、區兩欄的表頭字填進 `server.js` 的 `CADRE_HEADERS`。
- [ ] **Step 2: 建專案並推上去**：`npm run build:apps-script`；`cd apps-script && clasp create --type webapp --title "兄弟時光登入" --rootDir ../dist-apps-script`（產生的 `.clasp.json` 已被 gitignore）；`clasp push`。
- [ ] **Step 3: Script Properties**：在編輯器「專案設定 → 指令碼屬性」填 `CLIENT_ID`、`ROSTER_ID`、`ROSTER_SHEET`（`2025-12-28生效`）、`CADRE_ID`、`RESPONSES_ID`、`SESSION_SECRET`（`openssl rand -base64 48`）；照第 1 題的答案跑 `createSupplementSheet()`，或填既有的 `SUPPLEMENT_ID`。
- [ ] **Step 4: `checkSetup()`**：在編輯器執行（第一次會跳授權）。預期：通訊錄約 80 筆、幹部約 330 筆、合併後約 340 人，找得到參加者問卷分頁。把「對不到的圈區寫法」逐一補進 `DISTRICT_ABBREVIATIONS`，在 `tests/districts.test.mjs` 加對應的斷言，`npm test`、`npm run build:apps-script`、`clasp push`，重跑 `checkSetup()`，直到清單只剩確實沒有區的單位。
- [ ] **Step 5: 部署**：`clasp deploy --description "sign-in and stats"`，記下部署 ID 和 `/exec` 網址。之後改程式用 `clasp deploy -i <部署 ID>` 才會沿用同一個網址。
- [ ] **Step 6: 打一次看看**：`curl -sL -X POST -d '{"action":"me","session":"x"}' <exec 網址>`，預期 `{"ok":false,"error":"bad-session"}`。
- [ ] **Step 7: 打開網站的登入**：`content/site.json` 加 `"signIn": { "clientId": "…", "endpoint": "…" }`；`npm test && npm run build`；`npm run preview && npm run serve`，請使用者在 http://localhost:8766 用名單上的 Gmail 登入（企劃組帳號看全部、區負責人帳號看自己區），用不在名單上的帳號看到第二個畫面，故事卡頁不用登入。
- [ ] **Step 8: 上線**：commit、push main，看 Actions 部署。請使用者在手機上用正式網址確認：第一次登入、重新整理不再問、飛航模式下打開首頁和活動頁仍可用、從 LINE 開首頁會轉到手機瀏覽器、故事卡頁不用登入、區負責人帳號的首頁有「你們區的人想約」（沒有回覆時只有連結）、加一位主持人後那個 Gmail 可以登入。
- [ ] **Step 9: 記錄**：本機記憶 `brotime-login-allowlist-sources.md` 補上補充名單 ID、Apps Script 專案 ID 與部署 ID（不進 repo）；`HANDOFF.md` 更新現況；用 terminal-notifier 和 Pushover 通知使用者。
