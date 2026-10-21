# 兄弟時光活動入口網站 v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 做一個給圈區工作人員用的靜態網站：入口（幫我挑＋16 個活動牆）→ 活動頁（事前看）→ 當天模式（現場跟著做），取代「一分鐘看懂」圖卡。

**Architecture:** 內容是 `content/` 底下每個活動一份 JSON。`scripts/build.mjs` 用 Node 內建模組驗證資料，再用純函式 renderer 產生每一頁的靜態 HTML，輸出到 `dist/`，由 GitHub Actions 部署到 GitHub Pages。互動（篩選、幫我挑、當天模式、城市散步選區）是瀏覽器端的 ES module，邏輯集中在 `src/lib/*.mjs` 純函式，Node 測試跟瀏覽器共用同一份。

**Tech Stack:** Node 24（`node:test`、`node:fs`），零 npm 相依；唯一外部程式碼是放進 `vendor/` 的 qrcode-generator 1.4.4（MIT）。卡片圖工具用本機 Python 3＋Pillow、pdftoppm；企劃案轉檔用 pandoc、soffice。

**Spec:** `docs/2026-10-21-brotime-portal-design.md`（實作前先讀完；本計畫的「設計文件第 N 節」都指它）

## Global Constraints

- 手機優先；LINE 內建瀏覽器（iPhone、Android）要能正常顯示和操作。版面寬度上限 560px、左右留 16px，320px 寬不能出現橫向捲動。
- 小字對比至少 4.5（WCAG 對比公式），由 `tests/palette.test.mjs` 把關。
- 內頁標題和數字用粗黑體（Noto Sans TC 900），內文用黑體；沿用故事卡的紙感、暖色調。內文字級 17px，可點的東西高度至少 44px。
- 用詞講人話，不用「模組」「流程節點」這類詞。準備清單第一塊的標題一字不差是「企劃室提供」。
- 《新・人間革命》與御書引文只用故事卡上已經有的文字，不要另寫新的引文或轉述。
- 網站不叫工作人員印東西。故事卡、話題卡都在網站上，沒有實體卡（桌遊之夜例外），問卷線上填。
- 只有念故事那一步請大家看自己的手機；話題卡只用主持人一支手機。
- 第一版不做登入、報名、問卷系統、活動回報表、統計後台、編輯介面。
- 活動代號（`id`）和網址結構 `a/<id>/` 定了就不改；城市散步的區代號就是區名（例如 `台北西區`），放在 `?d=` 參數裡。
- 只用 Google 地圖連結，不在網站裡嵌入地圖，不使用路線檢閱網站的 Maps API 金鑰。
- 所有 `href`、`src` 都用相對路徑，因為之後會從 `twsokahan.github.io/brotime-portal/` 換到自訂網域根目錄。唯一的例外是 `og:url`、`og:image` 和分享出去的卡片網址，這些用 `site.baseUrl` 組成完整網址。
- 零 npm 相依；不加 framework。瀏覽器端用原生 ES module。
- 介面語言 `zh-Hant-TW`。
- Commit message 用英文，結尾加上 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`。不准用 `--no-verify`。

## Review Focus

1. **當天模式中途切 App 或鎖螢幕，LINE 內建瀏覽器把頁面重新載入** → 要能回到同一步，倒數照實際經過的時間算（Task 4 `loadSession` 測試、Task 10 恢復提示）。
2. **按下「開始活動」之後沒訊號、部分卡片圖沒載到** → 還是能開始，沒載到的卡片改顯示卡片標題文字（Task 4 `preload` 測試、Task 10 替代顯示）。
3. **LINE 內建瀏覽器（尤其 Android）沒有 `navigator.share`** → 「分享故事卡」要退回「分享到 LINE」和「複製連結」兩顆按鈕，不能按了沒反應（Task 4 `shareFallbacks` 測試、Task 10）。
4. **路線資料裡給企劃室看的待辦、警示、備註、可信度被公開到網站上** → 匯入時就丟掉（Task 5 測試）。
5. **篩選或「幫我挑」的條件太嚴，結果是 0 個或不到 3 個** → 給一句換條件的建議，不能出現空白畫面（Task 3 測試）。

另外，Task 8 的測試要擋住以 `/` 開頭的 `href`、`src`，換網域時才不會壞。

---

## 檔案結構

```
brotime-portal/
  package.json              # scripts: test / build / preview / serve，沒有 dependencies
  .gitignore                # dist/ dist-preview/ node_modules/ .DS_Store
  content/
    site.json               # 網站設定：問卷連結
    activities/<id>.json    # 16 個活動，一個一份
    city-walk/routes.json   # 由 tools/import-city-walk.mjs 產生，不要手改
  public/                   # 原樣複製到 dist/
    cards/<id>/<cardId>.webp, <cardId>-thumb.webp, <cardId>-og.jpg（只有故事卡）
    files/<id>-plan.pdf, files/<id>-cards-*.pdf（想印實體卡的區下載）
  src/lib/                  # 純函式；Node 測試和瀏覽器共用
    palette.mjs  labels.mjs  schema.mjs  filter.mjs  recommend.mjs  live.mjs  share.mjs  city-walk.mjs
  src/render/               # build 時把資料轉成 HTML 字串
    layout.mjs  entry.mjs  activity.mjs  card.mjs  qr.mjs
  src/client/               # 瀏覽器端：只負責接 DOM
    entry.js  activity.js
  src/styles/site.css
  vendor/qrcode.js, vendor/LICENSE-qrcode-generator.txt
  scripts/build.mjs
  tools/import-city-walk.mjs
  tools/cards.py, tools/cards/<id>.json
  tests/*.test.mjs, tests/fixtures/
  docs/tags-review.md, docs/content-notes/<id>.md
  .github/workflows/pages.yml
  README.md
```

## 資料格式（Task 2 寫成驗證規則，之後所有任務都照這個）

`content/activities/<id>.json`：

| 欄位 | 型別 | 規則 |
|---|---|---|
| `id` | string | `^[a-z0-9-]+$`，跟檔名相同，不可重複 |
| `name`、`tagline` | string | `tagline` 用企劃簡報候選活動頁的原句 |
| `status` | `"preparing"`\|`"review"`\|`"ready"` | `review` = 內容做好、等使用者看預覽 |
| `edition` | `"metro"`\|`"rural"` | 都會版／鄉鎮版 |
| `templates` | string[] | 簡報五大版型，值為 `A`–`E` |
| `order` | int | 活動牆排序，1–16 不重複 |
| `tags` | object | `preparing` 可省略；其他狀態必填，見下 |
| `tags.kids` | `"great"`\|`"ok"`\|`"no"` | |
| `tags.place` | `"indoor"`\|`"outdoor"`\|`"both"` | |
| `tags.rain` | `"ok"`\|`"move"`\|`"postpone"` | 下雨也能辦／雨天改地點／雨天延期 |
| `tags.slots` | string[] | `weekend-day` `weeknight` `early-morning` `flexible`，至少一個 |
| `tags.interests` | string[] | `eat` `move` `talk` `play` `craft`，至少一個 |
| `rainNote` | string | `tags.rain` 不是 `ok` 時必填 |
| `facts` | `{people, duration, place}` | 三個字串，例如 `"6–10 人"` `"60 分鐘"` `"咖啡廳或會館"` |
| `provided` | `{item, qty}[]` | 企劃室提供的東西，至少一項 |
| `todo` | `{when, task}[]` | 你要做的事，至少一項 |
| `steps` | Step[] | 至少一步，見下 |
| `cardSets` | `{[key]: {kind, label, cards: Card[], thumbs?: string[]}}` | `kind` 是 `"story"`、`"topic"` 或 `"other"`；`thumbs` 是活動頁要顯示的代表卡 id，最多 3 個，省略時取前 3 張 |
| Card | `{id, title, group?, text?, source?}` | story 卡的 `text`（故事全文，段落用 `\n\n` 分開，一字不差抄卡片）和 `source`（出處，例如「《新・人間革命》第 16 卷〈羽翼〉」）必填；topic 卡的 `title` 就是題目，`group` 是卡上印的分類，例如「前菜」 |
| `firstTime` | string[] | 第一次主持要記得的事，至少一項 |
| `extra30` | string[] | 想多留 30 分鐘的選配，每段一句 |
| `planFile` | string | `files/<id>-plan.pdf` |
| `preflight` | string[] | 出發前要確認的事，例如 `"確認咖啡廳訂位"` `"手機有電，先連上網路"`；ready／review 必填 |
| `printFiles` | `{label, file}[]`? | 想印實體卡的區可以下載的 PDF，例如 `{"label":"故事卡（A4）","file":"files/brunch-cards-story.pdf"}` |
| `flowTitle` | string? | 省略時用「60 分鐘這樣過」 |
| `surveys` | `{participant?, staff?}`? | 個別活動另設問卷，必須是 `https://` |

Step：`{ time: "0–10 分", minutes: 10 | null, title, do, say, cards?: string[], cardIds?: string[], readAloud?: string, routeStop?: "start"|"stop1"|"end", routeLeg?: 0|1 }`

- `say` 最多 45 個字（用 code point 算）。這是「說這句就好」，只能一句。
- `cards` 裡的 key 都要在 `cardSets` 裡；`cardIds` 只限定這一步要用這組裡的哪幾張。
- `minutes: null` 表示不計時，例如登山上山那一段。
- 卡片圖路徑固定是 `public/cards/<id>/<cardId>.webp` 和 `<cardId>-thumb.webp`，故事卡另有 `<cardId>-og.jpg`。ready／review 狀態的活動，這些檔都要存在。

`content/site.json`：`{ "title": "兄弟時光", "baseUrl": "https://twsokahan.github.io/brotime-portal/", "surveys": { "participant": null, "staff": null } }`。`baseUrl` 必須是 `https://` 開頭、`/` 結尾；問卷連結拿到前維持 `null`。

故事卡頁的網址是 `a/<id>/cards/<cardId>/`，完整網址由 `cardPageUrl(site, activityId, cardId)` 產生，等於 `${baseUrl}a/${activityId}/cards/${cardId}/`。

---

### Task 1: 專案骨架與配色

**Files:**
- Create: `package.json`, `.gitignore`, `src/lib/palette.mjs`
- Test: `tests/palette.test.mjs`

**Interfaces:**
- Produces: `contrastRatio(hexA: string, hexB: string): number`；`PALETTE: { paper, box, ink, muted, line, steps: Array<{dot, text}> }`（`steps` 正好 5 組）；`paletteCss(): string` 回傳 `:root{--paper:…;--box:…;--ink:…;--muted:…;--line:…;--step1:…;--step1-text:…;…;--step5-text:…}`

- [ ] **Step 1:** 在 `~/code/brotime-portal` 執行 `git init -b main`，建 `.gitignore`。`package.json` 設 `"type": "module"`、`"private": true`，scripts 為 `"test": "node --test \"tests/**/*.test.mjs\""`、`"build": "node scripts/build.mjs --out dist"`、`"preview": "node scripts/build.mjs --preview --out dist-preview"`、`"serve": "python3 -m http.server 8766 -d dist-preview"`。
- [ ] **Step 2: 寫失敗的測試** `tests/palette.test.mjs`：
  - `contrastRatio('#000000', '#ffffff')` 介於 20.9 和 21.1 之間
  - `contrastRatio(PALETTE.ink, PALETTE.paper) >= 4.5`
  - `PALETTE.muted` 對 `paper`、對 `box` 都 `>= 4.5`
  - 每一組 `steps[i].text` 對 `paper`、對 `box` 都 `>= 4.5`，而且 `contrastRatio('#ffffff', steps[i].text) >= 4.5`，因為按鈕用步驟色當底、白字
  - `PALETTE.steps.length === 5`
  - `paletteCss()` 含 `--step3-text:` 和 `--paper:`
- [ ] **Step 3:** 執行 `npm test`，預期 FAIL（module not found）。
- [ ] **Step 4:** 實作 `palette.mjs`。起始值用草圖的色相：paper `#f7f0e3`、box `#fff8ec`、ink `#3a2e24`、line `#e2d5bf`；dot 用 `#c98a2b` `#5f8a3a` `#b4503a` `#3f6f9a` `#7a4f7d`。`text` 是同色相的深色版，調暗到測試通過為止，muted 也一樣。`contrastRatio` 用 WCAG 2 的相對亮度公式。
- [ ] **Step 5:** 執行 `npm test`，預期 PASS。
- [ ] **Step 6: Commit**：`git add -A && git commit -m "chore: scaffold project with palette and contrast tests"`。這次 commit 也把 `docs/` 一起加進去。

### Task 2: 中文標籤與資料驗證

**Files:**
- Create: `src/lib/labels.mjs`, `src/lib/schema.mjs`, `tests/fixtures/activities.mjs`
- Test: `tests/schema.test.mjs`

**Interfaces:**
- Produces:
  - `labels.mjs`：`KIDS = {great:'適合帶小孩', ok:'可以帶小孩', no:'不適合帶小孩'}`、`PLACE = {indoor:'室內', outdoor:'戶外', both:'室內戶外都可'}`、`RAIN = {ok:'下雨也能辦', move:'雨天改地點', postpone:'雨天延期'}`、`SLOTS = {'weekend-day':'週末白天', weeknight:'平日下班後', 'early-morning':'一大早', flexible:'時間不固定'}`、`INTERESTS = {eat:'吃', move:'動', talk:'聊', play:'玩', craft:'手作'}`
  - `validateActivity(a: object, opts?: {fileExists?: (relPath: string) => boolean}): string[]`，每則錯誤的格式為 `"<id>: <欄位路徑> <問題>"`，例如 `"brunch: steps[1].say 超過 45 字"`
  - `validateSite(site: object): string[]`
  - `validateAll({activities: object[], site: object, routes?: object[]}): string[]`：逐一驗證，再加上跨檔規則：`id`、`order` 不可重複；`city-walk` 是 ready／review 時，每條路線的 `stop1.storyCard` 都要在它的 `cardSets.story` 裡
  - `fixtures/activities.mjs` export `readyActivity()`（照早午餐會的內容寫一份完整、可通過驗證的物件：`cardSets.story` 是 `kind:'story'` 一張 `s1`，附 `text`、`source`；`cardSets.topic` 是 `kind:'topic'` 的 `t02`、`t05`、`t11`，`group` 分別為前菜、主餐、飯後咖啡；`preflight: ['確認咖啡廳訂位','手機有電，先連上網路']`）和 `preparingActivity()`（只有 id、name、tagline、status、edition、templates、order）
  - `fixtures/activities.mjs` 也 export `fixtureSite()`，回傳上面那份有 `baseUrl` 的 site 物件

- [ ] **Step 1: 寫失敗的測試** `tests/schema.test.mjs`（`fileExists` 一律傳 `() => true`，只有圖檔那一案傳 `() => false`）：
  - `validateActivity(readyActivity())` 和 `validateActivity(preparingActivity())` 都回傳 `[]`
  - 把 ready 的 `steps[1].say` 改成 46 個字，錯誤包含 `steps[1].say`
  - `steps[1].cards = ['nope']`，錯誤包含 `steps[1].cards`
  - `tags.rain = 'postpone'` 且刪掉 `rainNote`，錯誤包含 `rainNote`
  - `tags.slots = []`，錯誤包含 `tags.slots`
  - `status: 'review'` 但沒有 `tags`，錯誤包含 `tags`
  - `surveys.participant = 'http://x'`，錯誤包含 `surveys.participant`
  - `fileExists: () => false` 時，錯誤包含 `cards/brunch/`
  - `validateAll` 收到兩個相同 `order`，錯誤包含 `order`
  - 刪掉故事卡組第一張卡的 `text`，錯誤包含 `cardSets.story.cards[0].text`
  - `status: 'ready'` 但沒有 `preflight`，錯誤包含 `preflight`
  - `validateSite({title:'兄弟時光', baseUrl:'https://cades.github.io/brotime-portal/', surveys:{participant:null, staff:null}})` 回傳 `[]`；`baseUrl` 少了結尾的 `/` 時，錯誤包含 `baseUrl`
- [ ] **Step 2:** 執行 `npm test`，預期 FAIL。
- [ ] **Step 3:** 依上面的「資料格式」實作 `labels.mjs`、`schema.mjs`、fixture。字數用 `[...s].length` 算。
- [ ] **Step 4:** 執行 `npm test`，預期 PASS。
- [ ] **Step 5: Commit**：`feat: add activity schema validation and tag labels`

### Task 3: 篩選與「幫我挑」

**Files:**
- Create: `src/lib/filter.mjs`, `src/lib/recommend.mjs`
- Test: `tests/filter.test.mjs`, `tests/recommend.test.mjs`

**Interfaces:**
- Consumes: `labels.mjs`；測試用 `fixtures/activities.mjs`
- Produces:
  - `emptyFilters(): {kids:false, indoor:false, outdoor:false, rainOk:false, slots:[], interests:[]}`
  - `matchesFilters(activity, filters): boolean`
  - `countMatches(activities, filters): number`，只算 `status === 'ready'` 的活動
  - `recommend(activities, answers): {picks: Array<{id, name, reasons: string[]}>, note: string|null}`，其中 `answers = {kids:'yes'|'no'|'unsure', slot:'weekend-day'|'weeknight'|'early-morning'|'flexible', place:'indoor'|'outdoor'|'either', interest:'eat'|'move'|'talk'|'play'|'craft'|'none'}`

篩選規則：

- 沒有 `tags` 的活動一律不符合。
- `kids` 開啟時，`tags.kids` 要是 `great` 或 `ok`。
- 只開「室內」時，`place` 要是 `indoor` 或 `both`；只開「戶外」時，要是 `outdoor` 或 `both`；兩個都開或都不開，不限制。
- `rainOk` 開啟時，`rain` 要是 `ok` 或 `move`。
- `slots`、`interests` 有選時，跟活動的標籤至少要有一個交集。

推薦規則：

1. 候選只取 `status === 'ready'` 的活動。
2. **排除：**
   - `kids==='yes'` 且 `tags.kids==='no'`
   - `slot` 是週末白天、平日下班後、一大早其中之一，但 `tags.slots` 既不含這個時段，也不含 `flexible`
   - `place==='indoor'` 且 `tags.place==='outdoor'`
   - `place==='outdoor'` 且 `tags.place==='indoor'`
3. **計分：**
   - 帶小孩：`kids==='yes'` 時，`great` 加 2、`ok` 加 1。
   - 時段：`slot` 在 `tags.slots` 裡加 2；`slot==='flexible'` 而且活動也標 `flexible`，同樣加 2。
   - 地點：選室內時，`indoor` 加 2、`both` 加 1；選戶外時，`outdoor` 加 2、`both` 加 1。
   - 興趣：`interest` 在 `tags.interests` 裡加 2。
4. **排序：** 分數由高到低，同分時 `order` 小的在前，取前 3 個。
5. **推薦原因：** 依序為帶小孩、時段、地點、興趣，只列有加到分的項目。
   - 帶小孩用 `KIDS[tags.kids]`。
   - 時段用 `SLOTS[slot]`；但 `slot==='flexible'` 時改寫「時間彈性」。
   - 地點用 `PLACE[tags.place]`。
   - 興趣寫成「喜歡」加上 `INTERESTS[interest]`，例如「喜歡吃」。
6. **`note`：**
   - 0 個：「沒有剛好符合的活動，換個條件試試看。」
   - 1–2 個：「符合的只有 N 個，可以放寬條件再試一次。」，N 用阿拉伯數字。
   - 3 個：`null`。

- [ ] **Step 1: 寫失敗的測試**，用 fixture 複製出 4～5 個標籤不同的 ready 活動，外加 1 個 preparing。
  - **filter：**
    - `emptyFilters()` 時，ready 都符合、preparing 不符合。
    - 只開 `indoor` 時，`both` 符合、`outdoor` 不符合。
    - `rainOk` 時，`move` 符合、`postpone` 不符合。
    - `countMatches` 不把 preparing 算進去。
  - **recommend：**
    - preparing 活動絕不出現在 `picks`。
    - `kids:'yes'` 會排除 `kids:'no'` 的活動。
    - 標 `flexible` 的活動在 `slot:'weeknight'` 時不被排除。
    - 同分時 `order` 小的排前面。
    - 原因陣列等於 `['適合帶小孩','週末白天','室內','喜歡吃']`（造一個四項都符合的活動）。
    - 只剩 2 個時，`note === '符合的只有 2 個，可以放寬條件再試一次。'`。
    - 全部被排除時，`picks.length === 0` 且 `note === '沒有剛好符合的活動，換個條件試試看。'`。
- [ ] **Step 2:** 執行 `npm test`，預期 FAIL。
- [ ] **Step 3:** 實作兩個模組。
- [ ] **Step 4:** 執行 `npm test`，預期 PASS。
- [ ] **Step 5: Commit**：`feat: add wall filters and three-pick recommender`

### Task 4: 當天模式的邏輯

**Files:**
- Create: `src/lib/live.mjs`, `src/lib/share.mjs`
- Test: `tests/live.test.mjs`, `tests/share.test.mjs`

**Interfaces:**
- Produces:
  - `timerText(step, startedAtMs: number, nowMs: number): {text: string, overtime: boolean}`
    - `step.minutes === null`：回傳 `{text:'照大家的步調', overtime:false}`。
    - 剩餘秒數 = `minutes*60 - floor((now-started)/1000)`。
    - 剩餘 ≥ 0：`還剩 MM:SS`，兩位數補零。
    - 剩餘 < 0：`超過 N 分鐘了，沒關係，聊開了就讓大家聊`，其中 `N = ceil(超過秒數/60)`；`overtime: true`。
  - `progressText(index: number, total: number): string`，格式為 `第 ${index+1} 步，共 ${total} 步`
  - `preflightItems(activity): string[]`，回傳 `activity.preflight` 的複本
  - `saveSession(storage, activityId, {index, startedAtMs, district}, nowMs): void`
  - `loadSession(storage, activityId, nowMs): {index, startedAtMs, district}|null`
    - key 為 `brotime:live:<activityId>`，值為 JSON，加上 `savedAtMs`。
    - 超過 6 小時、格式壞掉，或 `storage` 讀寫丟例外，一律回傳 `null`。
    - 讀寫都包在 try/catch 裡。
  - `clearSession(storage, activityId): void`
  - `imageUrlsFor(activity, steps): string[]`：`steps` 裡用到的每張卡的完整版圖路徑 `cards/<id>/<cardId>.webp`，不重複，依出現順序。有 `cardIds` 時只取那幾張，否則取整組。
  - `preload(urls: string[], loadOne: (url) => Promise<void>, timeoutMs = 8000): Promise<{failed: string[]}>`：逾時或 reject 的 url 列進 `failed`，整體永遠 resolve。
  - `groupsOf(cards): string[]`：依出現順序列出不重複的 `group`；沒有分類時回傳 `[]`。
  - `drawCard(cards, drawnIds: string[], group: string|null, random = Math.random): {card, drawnIds: string[]}`：先依 `group` 篩選（`null` 表示不分類），再從還沒抽過的卡裡用 `Math.floor(random() * 剩下張數)` 挑一張。這個分類全部抽過時，先把該分類的 id 從 `drawnIds` 移掉再抽。回傳新的 `drawnIds`（含這次抽到的），不改原陣列。
  - `share.mjs`：
    - `cardPageUrl(site, activityId, cardId): string`
    - `shareFallbacks(title, url): {lineUrl, copyText}`：`copyText = \`${title} ${url}\``，`lineUrl = 'https://line.me/R/share?text=' + encodeURIComponent(copyText)`

- [ ] **Step 1: 寫失敗的測試**
  - `timerText({minutes:20}, 0, 5*60*1000+28*1000).text === '還剩 14:32'`
  - `timerText({minutes:10}, 0, 11*60*1000+1000)` 回傳 `{text:'超過 2 分鐘了，沒關係，聊開了就讓大家聊', overtime:true}`
  - `timerText({minutes:null}, 0, 999).text === '照大家的步調'`
  - `progressText(1, 5) === '第 2 步，共 5 步'`
  - `preflightItems` 對 fixture 回傳 `['確認咖啡廳訂位','手機有電，先連上網路']`
  - 抽話題卡，用 fixture 的三張話題卡：
    - `drawCard(topic, [], null, () => 0)` 抽到 `t02`，`drawnIds` 等於 `['t02']`。
    - `drawCard(topic, ['t02','t05'], null, () => 0).card.id === 't11'`。
    - `drawCard(topic, ['t02'], '前菜', () => 0)` 會從頭再抽，抽到 `t02`，`drawnIds` 等於 `['t02']`。
    - `groupsOf(topic)` 等於 `['前菜','主餐','飯後咖啡']`。
  - `tests/share.test.mjs`：
    - `cardPageUrl(fixtureSite(),'brunch','s1') === 'https://cades.github.io/brotime-portal/a/brunch/cards/s1/'`
    - **沒有內建分享選單（Review Focus 3）：** `shareFallbacks('戶田大學與市谷食堂','https://x/a/')` 的 `lineUrl` 等於 `'https://line.me/R/share?text=' + encodeURIComponent('戶田大學與市谷食堂 https://x/a/')`。
  - **恢復進度（Review Focus 1）：** 用記憶體假 storage，`saveSession` 之後 `loadSession` 拿回同樣的 `index`、`startedAtMs`、`district`；6 小時又 1 秒後回傳 `null`；storage 的 `getItem` 丟例外時回傳 `null`、不丟錯。
  - **沒訊號（Review Focus 2）：** `preload(['a','b'], u => u==='a' ? Promise.resolve() : new Promise(()=>{}), 50)` resolve 成 `{failed:['b']}`。
  - `imageUrlsFor`：只有 `cardIds:['t02']` 時只回傳 `cards/brunch/t02.webp`。
- [ ] **Step 2:** 執行 `npm test`，預期 FAIL。
- [ ] **Step 3:** 實作 `live.mjs`。
- [ ] **Step 4:** 執行 `npm test`，預期 PASS。
- [ ] **Step 5: Commit**：`feat: add live-mode timer, resume, preload, card draw and share helpers`

### Task 5: 城市散步路線轉換與匯入

**Files:**
- Create: `src/lib/city-walk.mjs`, `tools/import-city-walk.mjs`, `tests/fixtures/raw-route.json`
- Test: `tests/city-walk.test.mjs`

**Interfaces:**
- Produces:
  - `normalizeRoute(raw, circleName: string): Route`
    - `Route = {district, circle, title, meetingPoint, parking, routeText, start:{name,lat,lon}, stop1:{name,lat,lon,place,intro,storyCard}, end:{name,lat,lon,place}, returnText, toilets, rainPlan, optional, totalM, legMinutes:[number,number], googleRouteUrl}`
    - 來源對應：`text.集合點/停車/路線/停留點一/介紹詞/終點/回程/廁所/雨天備案/選配`、`points.start/stop1/end`（`lon` 欄位名照原樣）、`timeline.legMinutes`、`google.open`。
    - `storyCard` 從 `text.建議故事卡` 用 `/故事卡\s*([A-Z])/` 取出字母，取不到就給 `null`。
  - `walkingLink({lat, lon}): string`，等於 `https://www.google.com/maps/dir/?api=1&travelmode=walking&destination=${lat},${lon}`
  - `routeSteps(steps, route): Step[]`：回傳新陣列，不改原本的。帶 `routeStop` 的步驟依下列補上欄位；帶 `routeLeg: i` 的步驟，`minutes = route.legMinutes[i]`。

    | `routeStop` | `do` | 其他欄位 | `mapsUrl` 與 `mapsLabel` |
    |---|---|---|---|
    | `start` | `集合點：${meetingPoint}` | — | 導航到 `stop1`，`走到下一站：${stop1.name}` |
    | `stop1` | `停在${stop1.place}` | `readAloud = stop1.intro`，`cards=['story']`，`cardIds=[stop1.storyCard]` | 導航到 `end`，`走到下一站：${end.name}` |
    | `end` | `終點：${end.place}` | `cardIds` 保留活動 JSON 原本設定的終點卡 | 導航到 `start`，`回到集合點：${start.name}` |

  - CLI：`node tools/import-city-walk.mjs [--src <path>]`
    - 預設 `--src` 為 `~/code/city-walk-review/data/routes.json`。
    - 用來源的 `circles` 查每區屬於哪一圈，依圈的順序、圈內原順序輸出到 `content/city-walk/routes.json`，2 格縮排。
- [ ] **Step 1: 寫失敗的測試**：從真實 `routes.json` 複製「台北西區」那一筆到 `tests/fixtures/raw-route.json`，原有的 `todo`、`flags`、`notes`、`confidence` 都保留。
  - **不公開內部資料（Review Focus 4）：** `JSON.stringify(normalizeRoute(raw,'北一圈'))` 不含 `todo`、`flags`、`notes`、`confidence`、`備註`、`legs`、`低於1.8公里`。
  - `normalizeRoute(...).stop1.storyCard === 'P'`、`legMinutes` 等於 `[8,16]`、`start.lat === 25.035327`。
  - `walkingLink({lat:25.1, lon:121.5}) === 'https://www.google.com/maps/dir/?api=1&travelmode=walking&destination=25.1,121.5'`
  - `routeSteps`：`stop1` 步驟的 `readAloud` 等於介紹詞、`cardIds` 等於 `['P']`、`mapsLabel` 以 `走到下一站：` 開頭；`routeLeg:1` 的步驟 `minutes === 16`；原本的 steps 物件沒被改到。
- [ ] **Step 2:** 執行 `npm test`，預期 FAIL。
- [ ] **Step 3:** 實作兩個檔案。
- [ ] **Step 4:** 執行 `npm test`，預期 PASS；再跑 `node tools/import-city-walk.mjs`，確認 `content/city-walk/routes.json` 有 61 筆，而且 `grep -c todo content/city-walk/routes.json` 輸出 0。
- [ ] **Step 5: Commit**：`feat: import city-walk routes without internal review notes`

### Task 6: 活動頁 renderer

**Files:**
- Create: `vendor/qrcode.js`, `vendor/LICENSE-qrcode-generator.txt`, `src/render/qr.mjs`, `src/render/activity.mjs`, `src/render/card.mjs`
- Test: `tests/render-activity.test.mjs`, `tests/render-card.test.mjs`

**Interfaces:**
- Consumes: `labels.mjs`、`live.mjs` 的 `preflightItems`、`page()`（Task 7；本任務先在 `activity.mjs` 只回傳 `<main>` 內容字串，由 Task 8 套進 layout）
- Produces:
  - `qrSvg(url: string): string`：用 `createRequire(import.meta.url)('../../vendor/qrcode.js')`，`qrcode(0,'M')` → `addData` → `make` → `createSvgTag({cellSize:4, margin:2, scalable:true})`。
  - `renderActivityMain({activity, site, rel, preview}): string`
  - `renderPreparingMain({activity, rel}): string`
  - `renderCardMain({activity, card, site, rel}): string`（故事卡頁，rel 為 `'../../../../'`）
- Consumes（新增）：`share.mjs` 的 `cardPageUrl`、`shareFallbacks`

活動頁 `<main>` 由上到下的內容與固定文字：

1. **標題區：** `h1` 放 `name`，下方放 `tagline`，再放三格 `facts`。
2. **`h2` 要準備：**
   - 第一塊標題「企劃室提供」，列 `provided`。
   - 第二塊標題「你要做的」，列 `todo`，`when` 放右邊。
   - 第三塊標題「問卷」加上「線上」標籤，內文「線上填，活動最後掃 QR code，不用印。」
3. **`h2` 流程：** 標題用 `flowTitle ?? '60 分鐘這樣過'`，下面是時間軸。每一步有 `time`、`title`，以及「說：」加上 `say`。有 `cards` 的步驟放縮圖 `cards/<id>/<cardId>-thumb.webp`：有 `cardIds` 用 `cardIds`，否則用 `thumbs` 或前 3 張。`alt` 用卡片 `title`。故事卡的縮圖包在 `<a href="cards/${cardId}/">` 裡，點了就是故事卡頁。
4. **開始按鈕：** `<button id="start-live">開始活動 ▶</button>`，下面一行「要去沒訊號的地方，出發前在有訊號處先按『開始活動』。」
5. **雨天：** `tags.rain !== 'ok'` 時加「下雨怎麼辦：${rainNote}」。
6. **三個 `<details>`：**
   - 「第一次主持記得 ${firstTime.length} 件事」
   - 「想多留 30 分鐘（選配）」
   - 「完整企劃案」，內容是 `<a href="${rel}${planFile}">下載企劃案（PDF）</a>`；有 `printFiles` 時，接著放一行「想印實體卡的話：」，後面是每個檔案的連結，文字為 `${label}（PDF）`
7. **給當天模式用的資料：**
   - `<script type="application/json" id="activity-data">`：放 activity，但不含 `extra30`、`firstTime`；另外加一個 `baseUrl` 欄位，值為 `site.baseUrl`。
   - `<template id="qr-participant">`：問卷連結（活動的 `surveys.participant ?? site.surveys.participant`）存在時放 `qrSvg`；不存在時放「問卷連結準備中」。
   - `<template id="staff-survey">`：同樣規則，放連結或「工作人員問卷連結準備中」。
   - 每張故事卡一個 `<template id="qr-card-${cardId}">`，內容是 `qrSvg(cardPageUrl(site, id, cardId))`。
8. **預覽橫幅：** `preview` 為 true 時，最上方加「預覽：這個活動還沒上線」。

準備中頁：`h1` 放 `name`，下方放 `tagline`，再一行「這個活動還在準備中，做好後會放在這裡。」，最後一個回入口的連結「← 回到所有活動」，`href="${rel}"`。

故事卡頁由上到下：
1. 卡片正面圖 `${rel}cards/${id}/${cardId}.webp`。
2. `h1` 放 `title`。
3. `text` 依 `\n\n` 切成一段一段的 `<p>`。
4. 「出處：${source}」。
5. 一個不用 JS 的 `<a href="${shareFallbacks(title, cardPageUrl(...)).lineUrl}">分享到 LINE</a>`，給新朋友轉傳用。
6. 「← 回到${activity.name}」，`href="${rel}a/${id}/"`。

這一頁不載任何 script。

- [ ] **Step 1:** 從 `https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js` 下載到 `vendor/qrcode.js`，確認檔內有 `createSvgTag`。從套件的 LICENSE 抄 MIT 授權全文到 `vendor/LICENSE-qrcode-generator.txt`。
- [ ] **Step 2: 寫失敗的測試**（用 fixture）
  - 輸出含 `企劃室提供`、`你要做的`、`60 分鐘這樣過`、`開始活動 ▶`，以及提醒句的完整原文。
  - `企劃室提供` 出現的位置在 `60 分鐘這樣過` 之前。
  - 用到話題卡的那一步，`<li>` 區段內含 `cards/brunch/t02-thumb.webp`。
  - `site.surveys.participant` 為 `null` 時含 `問卷連結準備中`；設成 `https://example.com/f` 時含 `<svg`。
  - `tags.rain:'postpone'` 加上 `rainNote:'延期一週'` 時含 `下雨怎麼辦：延期一週`。
  - `preview:true` 時含 `預覽：這個活動還沒上線`。
  - `renderPreparingMain` 含 `這個活動還在準備中，做好後會放在這裡。`，而且不含 `開始活動`。
  - 故事卡縮圖包在 `href="cards/s1/"` 裡；輸出含 `id="qr-card-s1"`，而且那個 template 裡有 `<svg`。
  - fixture 加上 `printFiles:[{label:'故事卡（A4）', file:'files/brunch-cards-story.pdf'}]` 時，含 `故事卡（A4）（PDF）`。
  - `tests/render-card.test.mjs`：`renderCardMain({..., rel:'../../../../'})`
    - 含 `src="../../../../cards/brunch/s1.webp"`、`<h1>` 卡名、`出處：`、`https://line.me/R/share?text=`。
    - `text` 有兩段時，正好輸出兩個 `<p>`。
    - 不含 `<script`。
- [ ] **Step 3:** 執行 `npm test`，預期 FAIL。
- [ ] **Step 4:** 實作 `qr.mjs`、`activity.mjs`。所有插入的文字都要做 HTML escape（`& < > " '`）。
- [ ] **Step 5:** 執行 `npm test`，預期 PASS。
- [ ] **Step 6: Commit**：`feat: render activity, preparing and story card pages`

### Task 7: 入口與共用版型 renderer

**Files:**
- Create: `src/render/layout.mjs`, `src/render/entry.mjs`
- Test: `tests/render-entry.test.mjs`

**Interfaces:**
- Consumes: `labels.mjs`
- Produces:
  - `page({title, description, rel, main, scripts: string[], ogUrl?: string, ogImage?: string}): string`
    - 完整 HTML，`<html lang="zh-Hant-TW">`。
    - 含 viewport、`og:title`（值為 `title`）、`og:description`；有 `ogUrl`、`ogImage` 時再加 `og:url`、`og:image`。
    - Google Fonts 載入 Noto Sans TC 400/700/900。
    - `<link rel="stylesheet" href="${rel}css/site.css">`。
    - `scripts` 每個輸出成 `<script type="module" src="${rel}${s}">`。
  - `renderEntryMain({activities, rel}): string`

入口頁 `<main>` 由上到下的內容與固定文字：

1. **標題區：** `h1`「下個月辦什麼？」，副標「兄弟時光 16 個活動，回答 4 題幫你挑，或往下自己逛。」
2. **按鈕：** `<button id="open-quiz">幫我挑</button>`
3. **篩選列：**
   - 帶小孩：一個 chip「會帶小孩」。
   - 地點：「室內」「戶外」「☂ 下雨也能辦」。
   - 大家什麼時候有空：用 `SLOTS` 四個。
   - 共同興趣：用 `INTERESTS` 五個。
   - chip 用 `<button data-filter="kids|indoor|outdoor|rainOk|slots|interests" data-value="…">`。
4. **計數：** `<p id="match-count">`，初始值「符合的有 ${ready 數} 個」。
5. **活動牆：** 依 `order` 排序，每個活動一張卡 `<a class="act" data-id="${id}" href="${rel}a/${id}/">`。
   - 卡上有 `name`、`tagline`、興趣標籤、雨天標籤（`RAIN[tags.rain]`）。
   - `preparing` 的卡加 class `is-preparing` 和「準備中」徽章，沒有雨天標籤。
6. **資料：** `<script type="application/json" id="activities-data">`，只放 `{id, name, status, order, tags}`。

- [ ] **Step 1: 寫失敗的測試**：用 fixture 造 16 個活動，其中 3 個 ready、13 個 preparing。
  - 輸出含 16 個 `class="act` 和 13 個 `準備中`。
  - `match-count` 的初始文字是「符合的有 3 個」。
  - `activities-data` 解析出來的物件，key 只有 `id,name,status,order,tags`。
  - `page({...rel:'../../'})` 含 `href="../../css/site.css"` 和 `lang="zh-Hant-TW"`。
  - `page({..., ogImage:'https://x/y.jpg'})` 含 `property="og:image" content="https://x/y.jpg"`；沒傳 `ogImage` 時不含 `og:image`。
- [ ] **Step 2:** 執行 `npm test`，預期 FAIL。
- [ ] **Step 3:** 實作兩個模組，文字一樣要做 escape。
- [ ] **Step 4:** 執行 `npm test`，預期 PASS。
- [ ] **Step 5: Commit**：`feat: render entry page and shared layout`

### Task 8: Build 指令與樣式

**Files:**
- Create: `scripts/build.mjs`, `src/styles/site.css`, `content/site.json`, `tests/fixtures/content/`（含 `site.json`、`activities/` 一個 ready、一個 review、一個 preparing，以及對應的假卡片圖空檔 `tests/fixtures/public/cards/...`）
- Test: `tests/build.test.mjs`, `tests/content.test.mjs`

**Interfaces:**
- Consumes: Task 1–7 全部
- Produces:
  - `build({contentDir, publicDir, outDir, preview}): Promise<{pages: string[]}>`
  - CLI：`node scripts/build.mjs [--preview] [--out <dir>]`，`contentDir='content'`、`publicDir='public'`。

build 依序做這些事：

1. 讀 `site.json`、`activities/*.json`、`city-walk/routes.json`（檔案可以不存在）。
2. 算出實際狀態：正式版把 `review` 當成 `preparing`；預覽版把 `review` 當成 `ready`，並傳 `preview:true` 給 renderer。
3. 對原始資料跑 `validateAll`，`fileExists` 檢查 `publicDir`。有錯就把錯誤一行一行印出來，以 exit code 1 結束。
4. 清空 `outDir`，寫入：
   - `css/site.css`：`paletteCss()` 接上 `src/styles/site.css` 的內容。
   - `js/lib/*.mjs`：複製 `src/lib/`。
   - `js/entry.js`、`js/activity.js`：複製 `src/client/`。
   - 不複製 `vendor/`：QR code 在 build 時就產生成 SVG，瀏覽器用不到它。
   - `public/` 的內容原樣複製。
   - `.nojekyll`。
   - `index.html`：入口頁，rel 為 `''`，載入 `js/entry.js`。
   - `a/<id>/index.html`：rel 為 `'../../'`，`ogUrl` 是 `${baseUrl}a/${id}/`。ready 的活動載入 `js/activity.js`，preparing 的不載任何 script。
   - `a/<id>/cards/<cardId>/index.html`：只做 ready 活動的 story 卡。rel 為 `'../../../../'`，`ogUrl` 用 `cardPageUrl`，`ogImage` 用 `${baseUrl}cards/${id}/${cardId}-og.jpg`，`title` 用卡名。
5. 城市散步頁另外嵌入 `<script type="application/json" id="routes-data">`，放全部路線。

`content.test.mjs`：對真正的 `content/` 和 `public/` 跑 `validateAll`，必須回傳 `[]`，這樣內容出錯時 CI 會擋下來。

`site.css` 要做到：
- `body` 背景 `var(--paper)`、文字 `var(--ink)`、17px；`main` 最寬 560px、置中、左右 16px。
- 標題與數字用 `"Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif`，字重 900。
- 時間軸第 n 步的圓點用 `--step{n}`，文字用 `--step{n}-text`，從第 6 步起循環。
- `.act.is-preparing` 灰階並降低透明度；`.act.is-dim` 透明度 0.35。
- 按鈕最少 44px 高。
- 當天模式是全螢幕的 `#live` 圖層。
- 320px 寬不能橫向捲動，長字用 `overflow-wrap:anywhere`。

- [ ] **Step 1: 寫失敗的測試** `tests/build.test.mjs`：用 fixture content 和 `fs.mkdtemp` 產生的暫存資料夾。
  - 正式版：review 活動的頁面含 `這個活動還在準備中`；ready 活動的頁面含 `開始活動 ▶`。
  - 預覽版：review 活動的頁面含 `預覽：這個活動還沒上線`。
  - **相對路徑（Review Focus 5）：** 輸出的每個 `.html` 都不符合 `/(href|src)="\//`。
  - `dist/css/site.css` 含 `--paper:`；`js/lib/live.mjs` 存在。
  - fixture 少一張卡片圖時，`build` reject，錯誤訊息含 `cards/`。
  - 正式版會產生 ready 活動的 `a/<id>/cards/s1/index.html`，內含以 `-og.jpg` 結尾的 `og:image`；review 活動在正式版不會產生卡片頁。

  `tests/content.test.mjs` 這時 `content/` 還只有 `site.json`，應該通過。
- [ ] **Step 2:** 執行 `npm test`，預期 FAIL。
- [ ] **Step 3:** 實作 `build.mjs`、`site.css`，建立 `content/site.json`。
- [ ] **Step 4:** 執行 `npm test` 和 `npm run build`，都要成功。
- [ ] **Step 5: Commit**：`feat: add static build with preview mode and base styles`

### Task 9: 入口的互動

**Files:**
- Create: `src/client/entry.js`

**Interfaces:**
- Consumes: `./lib/filter.mjs`、`./lib/recommend.mjs`、`./lib/labels.mjs`（build 後在 `js/lib/`）、`#activities-data`、Task 7 的 DOM 結構

行為：

**篩選 chip**
- 點一下切換 `aria-pressed`，接著重算每張 ready 卡：不符合的加 `is-dim`，符合的拿掉。
- `#match-count` 更新成「符合的有 N 個」；N 為 0 時改顯示「沒有符合的活動，少選一個條件看看。」

**「幫我挑」**
- 打開全螢幕問答，一次一題，有「上一題」。題目和選項：
  1. 「這次會有人帶小孩嗎？」：會／不會／還不確定，對應 `yes`／`no`／`unsure`。
  2. 「區裡的夥伴，什麼時候比較有空？」：週末白天（週休二日）、平日下班後、一大早（上班前或下田前）、時間不固定（排休、輪班）。
  3. 「想在室內還是戶外？」：室內／戶外／都可以，並附註一行小字「戶外遇雨可能延期」。
  4. 「大家有共同興趣嗎？」：吃／動／聊／玩／手作／沒特別（`none`）。
- 結果頁：
  - 標題是「最適合你們區的 3 個」；不到 3 個時改成「符合的 N 個」。
  - 每個推薦顯示名稱、`reasons.join('・')`，連到活動頁。
  - 有 `note` 時顯示，並給「重新回答」按鈕。
  - 最下面是「看全部 16 個 →」，按了關閉問答、回到活動牆。

- [ ] **Step 1:** 實作 `entry.js`。
- [ ] **Step 2:** 用 Task 8 的 fixture content 跑 `node scripts/build.mjs --preview --out dist-preview`，然後 `npm run serve`。用 session 裡有的無頭瀏覽器工具（gstack `/browse` 或 puppeteer MCP）開 `http://localhost:8766/`，視窗 390×844，逐一確認並截圖：
  - 點「會帶小孩」後，不符合的卡變淡、計數跟著變。
  - 四題答完出現推薦和原因。
  - 條件太嚴時出現 `note`。
  - 「看全部 16 個 →」會回到活動牆。
- [ ] **Step 3:** 視窗改成 320×640 再截一次，確認沒有橫向捲動（`document.documentElement.scrollWidth <= 320`）。
- [ ] **Step 4: Commit**：`feat: wire wall filters and pick-for-me quiz`

### Task 10: 活動頁的當天模式與城市散步選區

**Files:**
- Create: `src/client/activity.js`

**Interfaces:**
- Consumes: `./lib/live.mjs`、`./lib/share.mjs`、`./lib/city-walk.mjs`、`#activity-data`、`#routes-data`（只有城市散步才有）、`#qr-participant`、`#staff-survey`、`#qr-card-<cardId>`；`site.baseUrl` 由 build 放進 `#activity-data` 的 `baseUrl` 欄位

**城市散步選區**（頁面上有 `#routes-data` 時才做）
- 時間軸上方放一個 `<select>`，用 `<optgroup>` 依圈分組，預設文字「先選你們區」。
- 選了之後：
  - 用 `history.replaceState` 寫進 `?d=<區名>`，並存到 localStorage 的 `brotime:district`（try/catch）。
  - 在選單下面顯示路線概要：集合點、停車、全長「X.X 公里」、走路約 N 分鐘（`legMinutes` 加總）、停留點一、終點、廁所、雨天備案、選配，以及「整條路線在 Google 地圖開啟」（`googleRouteUrl`）。
  - 用 `routeSteps` 重畫時間軸，帶入該區的故事卡縮圖。
- 還沒選區之前，「開始活動」維持 disabled，按鈕文字是「先選區，再開始活動」。
- 打開頁面時，先讀 `?d=`，沒有再讀 localStorage。

**當天模式**（按下 `#start-live` 之後）

1. **出發前畫面：** 標題「帶齊了嗎？」，列出 `preflightItems` 的勾選框（只是提醒，不會擋下一步），下面是按鈕「開始活動 ▶」。
2. **載入：** 按下後先顯示「載入中…」，用 `preload(imageUrlsFor(activity, steps), loadImage)` 把圖先載好。完成後（不管有沒有失敗）進第 1 步。
3. **每一步的畫面：**
   - 上方：`progressText`、`timerText`（每秒更新，用時間戳計算，不要累加）、進度條。
   - 中間：大字的 `time`、`title`，「說：」加 `say`，有 `readAloud` 就加「念這段：」區塊。
   - **用到故事卡（`kind:'story'`）的那一步：**
     - 顯示卡片圖。
     - 「分享故事卡」按鈕：有 `navigator.share` 時呼叫 `navigator.share({title, url: cardPageUrl(...)})`。沒有時換成兩顆按鈕，「分享到 LINE」連到 `shareFallbacks(...).lineUrl`，「複製連結」用 `navigator.clipboard.writeText(copyText)`，成功後按鈕文字改成「已複製」。
     - 旁邊放 `#qr-card-<cardId>` 的 QR code，標題「新朋友掃這裡」。
     - 下面一行小字：「沒有訊號的話，主持人直接念給大家聽。」
   - **用到話題卡（`kind:'topic'`）的那一步：** 改成抽卡畫面。
     - 上方是 `groupsOf` 的分類切換，沒有分類就不顯示。
     - 中間一張大卡，用卡片圖；圖沒載到就顯示題目文字。
     - 下方「換一張」，呼叫 `drawCard`。抽過的 id 存在記憶體裡，換步驟也不清空。
   - **其他卡片：** 點一下全螢幕放大，可以左右滑看這組其他卡。
   - 有 `mapsUrl` 就顯示按鈕，文字用 `mapsLabel`。
   - 按鈕「下一步：${下一步的 title} →」，加一個小的「上一步」。
   - 每次換步都 `saveSession`。
4. **最後一步：** 放 `#qr-participant` 的內容，再加一行「或點這裡開問卷」的連結（有連結時才放）。按鈕改成「活動結束」。
5. **結束畫面：** 「活動結束，辛苦了！」，下面放 `#staff-survey` 的內容，最後是「回到活動頁」。按下結束時 `clearSession`。
6. **恢復進度：** 打開活動頁時，`loadSession` 有資料就在最上方顯示「上次進行到第 N 步，要接著繼續嗎？」，提供「繼續」和「重新開始」。
7. **防休眠：** 用 `navigator.wakeLock.request('screen')`（瀏覽器支援才用），`visibilitychange` 回到前景時重新要一次。
8. **圖沒載到：** 卡片圖 `onerror` 時，換成一個寫著卡片 `title` 的方框。

- [ ] **Step 1:** 實作 `activity.js`。
- [ ] **Step 2:** 用 fixture 做預覽 build 並 `npm run serve`，用無頭瀏覽器在 390×844 依序確認並截圖：
  - 出發前清單 → 第 1 步計時開始 → 下一步 → 最後一步顯示「問卷連結準備中」→ 結束畫面。
  - 在第 2 步重新整理頁面，出現恢復提示，按「繼續」回到第 2 步，倒數沒有歸零。
- [ ] **Step 3:** 確認沒訊號時的行為：瀏覽器工具設離線，或把一張卡片圖檔先改名，確認還能開始，那張卡顯示標題方框。確認完把檔名改回來。
- [ ] **Step 4:** 確認分享與抽卡：
  - 用工具執行 `Object.defineProperty(navigator, 'share', {value: undefined})` 後回到念故事那一步，畫面出現「分享到 LINE」和「複製連結」，也看得到 QR code。
  - 在話題卡那一步按 3 次「換一張」，3 張都不一樣；切換分類後只出現那一類的卡。
- [ ] **Step 5: Commit**：`feat: add live mode with card sharing, topic draw and city-walk district picker`

### Task 11: 16 個活動的基本資料與標籤確認（使用者檢查點）

**Files:**
- Create: `content/activities/<id>.json` ×16（全部 `status:"preparing"`）、`docs/tags-review.md`

16 個活動。`tagline` 一字不差用企劃簡報第 13、14 頁的原句；`templates` 照括號裡的版型。

| order | id | name | edition | templates |
|---|---|---|---|---|
| 1 | brunch | 兄弟早午餐會 | metro | A |
| 2 | night-run | 河濱夜跑・單車 | metro | C |
| 3 | board-games | 桌遊之夜 | metro | B, E |
| 4 | dad-day | 爸爸帶娃日 | metro | D |
| 5 | city-walk | 城市散步 | metro | C |
| 6 | workplace | 職場人生對話 | metro | A, E |
| 7 | kitchen | 男人的廚房 | metro | C, D |
| 8 | new-year-visit | 新春拜年團 | metro | D |
| 9 | bbq | 田園烤肉會 | rural | D |
| 10 | family-feast | 家族辦桌拜年 | rural | D |
| 11 | farm | 農事體驗日 | rural | C, D |
| 12 | morning-hike | 清晨登山 | rural | C |
| 13 | fishing | 釣魚聊天會 | rural | A, C |
| 14 | craft | 師傅手藝教室 | rural | A, C |
| 15 | camping | 露營星空夜 | rural | D |
| 16 | tea | 巷口泡茶會 | rural | A |

- [ ] **Step 1:** 用 `pdftotext -layout ~/code/sokahan-propalsal-2026/兄弟時光/兄弟時光_2027年度企劃簡報_修訂版.pdf -` 抄出 16 句介紹，寫入 16 份 JSON。
- [ ] **Step 2:** 為 16 個活動提出標籤，寫成 `docs/tags-review.md`。表格欄位：活動｜帶小孩｜地點｜雨天（附 rainNote）｜適合時段｜興趣｜依據。「依據」要寫出是企劃案或簡報的哪一句。標籤先寫進各 JSON 的 `tags`。
- [ ] **Step 3:** 執行 `npm test && npm run build`，都要通過。
- [ ] **Step 4: Commit**：`feat: add 16 activity stubs with proposed tags`
- [ ] **Step 5: 停下來，請使用者確認 `docs/tags-review.md`。** 照使用者的修改更新 JSON 和表格後，再 commit：`fix: apply confirmed activity tags`。標籤確認前不要開始 Task 12。

### Task 12: 卡片圖工具與「兄弟早午餐會」內容（其他活動的範本）

**Files:**
- Create: `tools/cards.py`, `tools/cards/brunch.json`, `public/cards/brunch/*`, `public/files/brunch-plan.pdf`, `docs/content-notes/brunch.md`
- Modify: `content/activities/brunch.json`
- Test: `tests/cards-spec.test.mjs`

**Interfaces:**
- Produces:
  - `python3 tools/cards.py tools/cards/<id>.json`，spec 格式為 `{"activity": "<id>", "sets": {"<setKey>": {"pdf": "<絕對路徑>", "dpi": 200, "og": false, "cards": [{"id": "t02", "page": 1, "box": [x0, y0, x1, y1]}]}}}`。`box` 是頁面寬高的比例（0–1）；故事卡那組設 `"og": true`。
  - 輸出 `public/cards/<id>/<cardId>.webp`（寬 900px）和 `<cardId>-thumb.webp`（寬 240px），品質 80。
  - `og` 為 true 的組，另外輸出 `<cardId>-og.jpg`：1200×630，底色 `#f7f0e3`（跟 `PALETTE.paper` 相同），卡片等比例縮到高 570px、置中，JPEG 品質 85。LINE 的預覽不一定認得 WebP，所以用 JPEG。
  - 另外輸出 `$CLAUDE_JOB_DIR/tmp/<id>-contact.png`，把所有卡排成一張，方便檢查。
  - 用 `pdftoppm -r <dpi> -f <page> -l <page> -png` 轉頁，Pillow 裁切、縮放、存 webp。用本機 `python3` 執行，不要加 `-I`，因為 Pillow 裝在使用者的 site-packages。

**內容製作程序**（Task 13–19 都照這個做）

1. **讀企劃案：** `pandoc -t gfm "<最新企劃案.docx>" -o "$CLAUDE_JOB_DIR/tmp/<id>-plan.md"`，讀流程、準備、第一次主持、選配、雨天這幾段。`plan-builder/build_<活動>_lazy_pack_v1.py` 的 `SCHEDULE` 可以當起點，但內容以企劃案為準。
2. **做卡片圖：**
   - 卡片 PDF 用一般閱讀版，不用「雙面裁切版」「一次兩套」「不印底色」。
   - 寫好 `tools/cards/<id>.json` 後執行 `cards.py`。
   - 打開 contact sheet 圖，確認每張剛好是一整張卡，沒有切到邊或混到隔壁張。
   - 卡片的 `title` 用卡面上的題目或篇名。
3. **寫活動資料：**
   - 照「資料格式」寫完整的 JSON，`status` 設成 `"review"`。
   - `say` 有現成句子就用企劃案原句；沒有就照企劃案的意思寫一句。
   - `readAloud` 和任何引文只能抄故事卡上的字。
   - 故事卡的 `text`、`source`：一字不差抄卡片上的字。優先從 `plan-builder` 裡產生那張卡的 HTML 取，再用 `pdftotext` 跟 PDF 核對；直排的 PDF 抽出來順序常會亂，不能只靠它。
   - 話題卡的 `group` 照卡上印的分類。
   - `provided` 寫成「故事卡：在網站上，念故事時分享到群組」「話題卡：在網站上，主持人用手機帶大家抽」，再加上企劃室真的會提供的實體物品。
   - `preflight` 至少要有一項「手機有電，先連上網路」。
   - 把印刷用的雙面裁切版 PDF 複製到 `public/files/<id>-cards-story.pdf`、`<id>-cards-topic.pdf`，寫進 `printFiles`。
4. **寫內容筆記：** `docs/content-notes/<id>.md` 列出每一句 `say`，標明「企劃案原文」或「新寫」，再列出要請使用者決定的問題。
5. **企劃案 PDF：** `soffice --headless --convert-to pdf --outdir "$CLAUDE_JOB_DIR/tmp" "<docx>"`，然後搬到 `public/files/<id>-plan.pdf`。
6. **驗證：** `npm test`（`content.test.mjs` 會驗證新內容）、`npm run preview`、`npm run serve`，用無頭瀏覽器在 390×844 和 320×640 截整頁圖。確認：
   - 15 分鐘內讀得完（流程步驟原則上 5～7 步）。
   - 沒有橫向捲動。
   - 縮圖放在對的那一步。
7. **Commit**：`content: add <name> activity`（英文，例如 `content: add brunch activity`）

早午餐會的來源：
- 企劃案：`~/code/sokahan-propalsal-2026/兄弟早午餐會/2027年創價班_兄弟時光_兄弟早午餐會企劃案_v2.docx`
- 故事卡：`…/兄弟早午餐會/2027年創價班「兄弟早午餐會」故事卡_v1_報紙版.pdf`。A4 橫式 1 頁，右半是正面，左半是背面的直排內文。圖片只用正面，全文從 `plan-builder/brunch_cards_v1/故事卡_v1_報紙版.html` 抄。
- 話題卡：`…/2027年創價班「兄弟早午餐會」話題卡_v1_菜單版_雙面.pdf`。第 1 頁是 12 張正面，3 欄 × 4 列。
- 「一分鐘看懂」的對照：`…/一分鐘看懂_v3/`。

- [ ] **Step 1: 寫失敗的測試** `tests/cards-spec.test.mjs`：讀 `tools/cards/*.json`，檢查每個 `box` 的四個值都在 0 到 1 之間、`x0<x1`、`y0<y1`，而且每個 id 在 `content/activities/<activity>.json` 的 `cardSets` 裡都找得到。
- [ ] **Step 2:** 執行 `npm test`，預期 FAIL（還沒有 spec）。
- [ ] **Step 3:** 實作 `tools/cards.py`，再照「內容製作程序」1–6 完成早午餐會。
- [ ] **Step 4:** 執行 `npm test`，預期 PASS；預覽截圖要跟 `docs/mockups/before-and-during-v2.html` 的結構一致。
- [ ] **Step 5: Commit**：`content: add brunch activity and card extraction tool`

### Task 13–18: 另外六個已完成的活動

每個活動一個任務，照 Task 12 的「內容製作程序」做。來源都在 `~/code/sokahan-propalsal-2026/` 底下，卡片 PDF 都在同一個資料夾，挑一般閱讀版。

| Task | id | 最新企劃案 | 要特別注意的 |
|---|---|---|---|
| 13 | night-run | `河濱夜跑單車/…企劃案v3.docx` | 平日下班後；`tags.rain` 多半是 `postpone`，要寫 `rainNote` |
| 14 | morning-hike | `清晨登山/…企劃案v5.docx` | 比 60 分鐘長，正式程序嵌在登山裡；上下山步驟用 `minutes:null`；`flowTitle` 寫實際長度 |
| 15 | camping | `露營星空夜/…企劃案v5.docx` | 過夜，同樣用 `minutes:null` 和 `flowTitle`；`firstTime` 要放安全事項 |
| 16 | workplace | `職場人生對話/…企劃案.docx` | 平日下班後、室內 |
| 17 | kitchen | `男人的廚房火鍋版/…企劃案v4.docx`（不是「故事卡更新」那份） | 活動名稱用「男人的廚房」；火鍋版的器材放進 `todo` |
| 18 | dad-day | `爸爸帶娃日/2027年創價班「爸爸帶娃日」活動企劃案v6.docx` | 在需要脫鞋的乾淨室內空間辦，不用親子館或公園（使用者 2026-10-21 確認），`tags.place:"indoor"`、`tags.rain:"ok"`；孩子的安全事項放 `firstTime` |

每個任務的 Steps 都一樣：
- [ ] 照程序 1–6 做完
- [ ] 執行 `npm test`，PASS
- [ ] Commit：`content: add <id> activity`

### Task 19: 城市散步內容

**Files:**
- Create: `tools/cards/city-walk.json`, `public/cards/city-walk/*`, `public/files/city-walk-plan.pdf`, `docs/content-notes/city-walk.md`
- Modify: `content/activities/city-walk.json`

**Interfaces:**
- Consumes: Task 5 的 `content/city-walk/routes.json`、`routeSteps`；Task 10 的選區畫面

- [ ] **Step 1:** 重新執行 `node tools/import-city-walk.mjs`，取得最新路線。
- [ ] **Step 2:** 照內容製作程序 1–2 處理：
  - 企劃案：`城市散步/2027年創價班_兄弟時光_城市散步企劃案v9.docx`
  - 故事卡庫：`城市散步/2027年創價班「城市散步」故事卡_v2_速寫本.pdf`，16 頁。每張卡的 `id` 用路線資料裡的字母 `A`–`P`，對應關係照 PDF 上的卡名核對。全文從 `plan-builder/build_city_walk_story_cards_v2.py` 用的資料或它產生的 HTML 抄。
  - 話題卡：`城市散步/2027年創價班「城市散步」話題卡_v1_小景集章_雙面.pdf`
- [ ] **Step 3:** 寫 `city-walk.json`，`status:"review"`。`steps` 照企劃案的流程排：
  - 集合用 `routeStop:"start"`，兩段路用 `routeLeg:0`、`routeLeg:1`，停留點一用 `routeStop:"stop1"`，終點用 `routeStop:"end"`。
  - 終點固定的那張故事卡用 `cardIds` 寫死在 end 步驟。
  - `cardSets.story` 要含 `A`–`P` 全部 16 張。
- [ ] **Step 4:** 執行 `npm test`。`validateAll` 會檢查 61 條路線的 `storyCard` 都在卡片組裡；有路線取不到字母，就把區名記進 `docs/content-notes/city-walk.md`，請使用者處理，不要自己猜。
- [ ] **Step 5:** 預覽時挑三個區截圖：台北西區、一個鄉鎮區、一個東部的區。確認集合點、介紹詞、故事卡、「走到下一站」連結都對。點一個地圖連結，確認 Google 地圖開的是步行導航。
- [ ] **Step 6: Commit**：`content: add city-walk activity with per-district routes`

### Task 20: 上線設定與維護說明

**Files:**
- Create: `.github/workflows/pages.yml`, `README.md`

`pages.yml` 的內容：
- 觸發條件：`push` 到 `main`，以及 `pull_request`。
- `test` job：`actions/checkout`、`actions/setup-node`（node 24），再跑 `npm test` 和 `npm run build`。
- `deploy` job：只在 `main` 上執行。`actions/configure-pages`，`actions/upload-pages-artifact` 上傳 `dist`，再 `actions/deploy-pages`。
- permissions：`pages: write`、`id-token: write`。
- 各 action 用當時最新的 major 版本（寫這份計畫時是 checkout v4、setup-node v4、upload-pages-artifact v3、deploy-pages v4）。

`README.md`（中文、講人話）要寫：
- 怎麼新增或修改一個活動（改哪個 JSON、卡片圖怎麼產生）。
- `npm test`、`npm run preview`、`npm run serve` 各做什麼。
- 怎麼把 `review` 改成 `ready`。
- 路線改了要重跑 `tools/import-city-walk.mjs`。
- 之後換網域要改哪裡（加 `public/CNAME`）。

- [ ] **Step 1:** 寫兩個檔案，commit：`ci: deploy to GitHub Pages and add maintainer readme`
- [ ] **Step 2: 停下來問使用者**：要不要在 GitHub 組織 `twsokahan` 建公開 repo `brotime-portal`，以及首次推送 main。這是對外動作，一定要先得到同意。順便告訴使用者：組織是免費方案，只有公開 repo 能用 Pages，這會是組織裡第一個公開 repo（目前 8 個都是私人的）。
- [ ] **Step 3:** 得到同意後，照 `~/code/city-walk-review` 的做法，用 `gh` 的 HTTPS 認證（本機 SSH 金鑰是公司帳號）：
  - `gh repo create twsokahan/brotime-portal --public --source . --push`（本機 gh 登入的 cades 是組織 admin，token 有 repo、read:org）
  - `gh api -X POST repos/twsokahan/brotime-portal/pages -f build_type=workflow`
- [ ] **Step 4:** `gh run watch` 等部署完成，打開 `https://twsokahan.github.io/brotime-portal/`，確認入口和一個準備中頁面正常。這時 review 狀態的活動在正式站上應該顯示「準備中」。

### Task 21: 整體檢查、使用者確認內容、正式上線

- [ ] **Step 1:** 執行 `npm test && npm run build && npm run preview`，全部通過。
- [ ] **Step 2:** 用預覽站把 8 個 review 活動各走一遍：活動頁，以及當天模式從頭到尾。城市散步挑三個區。截圖存在 `$CLAUDE_JOB_DIR/tmp/qa/`。
- [ ] **Step 3:** 請使用者用手機看預覽：`npm run serve` 會綁 0.0.0.0，手機跟 Mac 連同一個 Wi-Fi，就能用 `http://<Mac 的區網 IP>:8766/` 打開。也請使用者把正式站連結傳到 LINE，用 LINE 內建瀏覽器打開，看準備中頁面和入口。
- [ ] **Step 4: 停下來，等使用者一個一個確認活動**（搭配 `docs/content-notes/<id>.md`）。照修改意見改內容；確認的活動把 `status` 改成 `"ready"`。每個活動一個 commit：`content: publish <id>`。
- [ ] **Step 5:** 開 branch、推上去、開 PR 給使用者 merge，merge 後 Actions 自動部署。之後的修改都走 PR，不直接推 main。
- [ ] **Step 6:** 部署完成後，確認正式站上已確認的活動可以完整使用。再把一個故事卡頁的連結傳到 LINE，確認預覽有卡名和卡片圖，點開後是橫排大字的全文。接著用 terminal-notifier（加 `-contentImage https://anthropic.gallerycdn.vsassets.io/extensions/anthropic/claude-code/2.0.15/1760464142032/Microsoft.VisualStudio.Services.Icons.Default`）和 Pushover（mcpm 的 `pushover_send`），用繁體中文通知使用者。
