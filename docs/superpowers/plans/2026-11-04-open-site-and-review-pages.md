# 網站全面開放、回顧頁改版：實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 內容頁全部不用登入；登入只留給 `stats/` 兩頁，改成「一場一張回顧卡」的樣子；Apps Script 拿掉回覆門檻、加主持人和補充名單。

**Architecture:** 靜態網站由 `scripts/build.mjs` 產生，`page({ signIn })` 決定一頁有沒有登入牆。回顧頁的畫面由瀏覽器端 `src/client/stats*.js` 用 `el()` 畫，可測的邏輯放在 `src/lib/stats-view.mjs`（node 測試）。Apps Script 的純邏輯在 `apps-script/*.mjs`（node 測試），`server.js` 是殼。

**Tech Stack:** Node（`node --test`）、原生 ES modules、Google Apps Script（clasp 3）、GitHub Pages。

**Spec:** `docs/superpowers/specs/2026-11-04-open-site-and-review-pages-design.md`

## Global Constraints

- 工作目錄：`~/code/brotime-portal/.claude/worktrees/task11`（分支 `task11-go-live`）。
- 網站文案照設計文件第 4、5、6、8 節逐字；不寫「企劃室」。
- 顏色只用 CSS 變數；新顏色加進 `src/lib/palette.mjs` 的 `paletteCss()`。
- `npm test`、`npm run build`、`npm run build:apps-script` 每個 task 結束都要過。
- 程式碼照 repo 現有風格：self-documenting，真的必要才寫註解；commit message 英文、結尾加 attribution 兩行。
- 改含 `'@'` 的程式碼用 Edit，不要用 perl。

## Review Focus

1. 問卷上的活動名稱對不到網站上的活動（改過名、舊名稱）→ 卡片照樣出現，沒有封面、活動名不可點，不報錯。（Task 4 測 `activityCover` 回 `null`）
2. 有人跳過某一題 → 那一題的點數比份數少，點只畫答了的人。（Task 4 測 `personDots`）
3. 合併權限的標籤「中和區、永和區」→ 標題「中和區、永和區的回顧」。（Task 4 測 `reviewTitle`）
4. 第一份回覆之後第 3 天才填的 → 另成一場；第 2 天填的 → 同一場。（Task 1 測）
5. 舊 API 回來的場次沒有 `answers` → 小卡只顯示份數、不畫點。（Task 4 測 `personDots(undefined, …)` 回 `[]`）

---

### Task 1: 回覆不設門檻，兩天內算同一場

**Files:**
- Modify: `apps-script/responses.mjs`（`MIN_RESPONSES`、`groupSessions`、`sessionStats`、`districtWants`）
- Test: `tests/responses.test.mjs`

**Interfaces:**
- Produces: `sessionStats(session)` 一律回 `{ id, date, district, activity, responses, answers, next }`（不再有 `enough`）。`districtWants(sessions, districts)` 沒有場次時照舊回 `null`，否則回 `{ sessions, responses, top }`（沒人勾「下一次想參加」時 `top` 是 `[]`）。`groupSessions(responses)` 的 `id` 是「第一份的日期|區|活動」，`date` 是第一份的日期。
- `statsFor(scope, sessions)` 介面不變。

- [ ] **Step 1: 改測試**
  - 刪 `a session with fewer than 3 replies shows no numbers`、改 `wants are not enough under 3 replies and null without sessions` 為 `wants list as soon as there is one reply and are null without sessions`：一份回覆的區，`top` 有一項、`count: 1`；沒有場次時 `districtWants` 仍是 `null`（照 `statsFor` 現在的行為）。
  - 新增 `a session with one reply still shows its answers`：`sessionStats` 一份回覆時 `answers.listened` 是 `{ 有: 1 }`、沒有 `enough` 欄位。
  - 新增 `replies of the same district and activity within two days of the first join one session`：同區同活動，日期 `2026-11-16`、`2026-11-17`、`2026-11-18` 三份 → 一場，`date` 是 `2026-11-16`、`id` 是 `2026-11-16|中和區|男人的廚房`、`responses.length === 3`。
  - 新增 `a reply three days after the first starts a new session`：`2026-11-16` 和 `2026-11-19` → 兩場，新的排前面。
  - 新增 `two days are counted from the first reply, not the latest`：`11-16`、`11-18`、`11-20` → 兩場（`11-16`＋`11-18`、`11-20`）。

- [ ] **Step 2: 跑測試確認失敗**

  Run: `node --test tests/responses.test.mjs`
  Expected: 新加的測試 FAIL（例如 `enough` 還在、兩天內被拆成兩場）。

- [ ] **Step 3: 實作**
  - 刪 `MIN_RESPONSES`（`api.mjs` 或別處有 import 的一起改）。
  - `groupSessions`：先依 `date` 由舊到新排，同一個「區|活動」的回覆，若跟那組最新一場的第一份日期相差 0～2 天就併進去，否則開新一場；最後照現有 `newestFirst` 排。日期差用 `Date.UTC` 換算 ISO 日期。常數 `SAME_SESSION_DAYS = 2`。
  - `sessionStats`、`districtWants` 拿掉 `enough` 分支。

- [ ] **Step 4: 跑測試確認通過**

  Run: `node --test tests/responses.test.mjs`
  Expected: PASS

- [ ] **Step 5: Commit** — `Show every session's answers, and join late replies to the session they follow`

### Task 2: 拿掉加主持人、補充名單和看不到任何一區的帳號

**Files:**
- Modify: `apps-script/api.mjs`（刪 `hosts`、`addHost`、`removeHost`、`newestHostsFirst`、`callerOf` 的 `needsDistrict` 和 `level === 'none'` 分支）
- Modify: `apps-script/allowlist.mjs`（刪 `parseSupplement`、`SUPPLEMENT_HEADERS`；`mergeAllowlist` 結果濾掉 `level === 'none'`）
- Modify: `apps-script/server.js`（刪 `supplementSheet_`、`withSupplementLock_`、`addSupplementRow_`、`removeSupplementRow_`、`createSupplementSheet`、`serverDeps_` 的 `supplement`、`readLists_` 的 `supplementEntries`、`REQUIRED_PROPERTIES` 的 `SUPPLEMENT_ID`；`checkSetup()` 刪補充名單那行與「看不到統計」，開頭註解的入口列表拿掉 `createSupplementSheet`）
- Test: `tests/api.test.mjs`、`tests/allowlist.test.mjs`、`tests/apps-script-bundle.test.mjs`

**Interfaces:**
- Produces: `mergeAllowlist(lists)` 只回有權限的人（`level` 是 `district`、`circle`、`all`）。`handleRequest` 只認 `signIn`、`me`、`stats`，其他 action 回 `{ ok: false, error: 'bad-request' }`。

- [ ] **Step 1: 改測試**
  - `api.test.mjs`：刪三個 host 測試；`stats are forbidden to the supplement list…` 改成 `stats are passed the caller's scope`；新增 `the host actions are gone`：`hosts`、`addHost`、`removeHost` 都回 `bad-request`。
  - `allowlist.test.mjs`：刪 `the supplement skips rows…`；新增 `people who can see no district are left off the merged list`：一筆 `NONE_SCOPE` ＋一筆區層級 → 合併後只有後者；同一信箱一筆 none 一筆 district → 留 district。
  - `apps-script-bundle.test.mjs`：入口檢查裡拿掉 `createSupplementSheet`，並斷言 bundle 不含 `SUPPLEMENT`。

- [ ] **Step 2: 跑測試確認失敗**

  Run: `node --test tests/api.test.mjs tests/allowlist.test.mjs tests/apps-script-bundle.test.mjs`
  Expected: 新測試 FAIL

- [ ] **Step 3: 照 Files 刪程式**（`npm run build:apps-script` 產生的 bundle 也要過）

- [ ] **Step 4: 跑測試確認通過**

  Run: `npm test && npm run build:apps-script`
  Expected: 全部 PASS、bundle 產生成功

- [ ] **Step 5: Commit** — `Drop the host list from the Apps Script now that hosts need no sign-in`

### Task 3: 部署 Apps Script

部署帳號、script ID、部署 ID 在本機記憶 `brotime-login-allowlist-sources.md`，不寫進 repo。

- [ ] **Step 1:** `npm run build:apps-script && cd apps-script && clasp push`
  Expected: `Pushed N files.`（若問要不要覆蓋 manifest，回 yes）
- [ ] **Step 2:** `clasp deploy -i <部署 ID> -d "No reply threshold, no host list"`
  Expected: 印出同一個部署 ID
- [ ] **Step 3:** `curl -sL -d '{"action":"me","session":"x"}' '<site.json 的 signIn.endpoint>'`（不要 `-X POST`）
  Expected: `{"ok":false,"error":"bad-session"}`
- [ ] **Step 4:** `curl -sL -d '{"action":"hosts"}' '<endpoint>'` → `{"ok":false,"error":"bad-request"}`

### Task 4: 只有回顧頁要登入，主持人頁和首頁登入的東西拿掉

**Files:**
- Modify: `scripts/build.mjs`（`readyActivityPage`、`preparingActivityPage`、`ichibanPage`、首頁、`all/` 不再傳 `signIn`；首頁 scripts 只剩 `js/home.js`；`statsPages` 刪 hosts 那頁、加 `noindex: true`、檢查範例卡封面）
- Modify: `src/render/layout.mjs`（`page({ …, noindex = false })` 加 `<meta name="robots" content="noindex">`；`renderSigninPanel({ rel })`）
- Modify: `src/render/signin.mjs`（文案照設計文件第 4 節；`not-listed` 畫面最後是 `<p class="home-link"><a href="${rel}">← 回到首頁</a></p>`，刪 `.signin-note`）
- Modify: `src/render/entry.mjs`（刪 `DISTRICT_WANTS_BLOCK`、`ACCOUNT_FOOT`、`districtWants` 參數；`export function coverThumbPath(activity)`，`renderCover` 改用它）
- Modify: `src/render/stats.mjs`（刪 `renderHostsMain`；`activityIdsScript` 換成 `activityIndexScript`）
- Modify: `src/render/privacy.mjs`（照設計文件第 8 節三處）
- Modify: `src/lib/stats-view.mjs`（刪 `HOSTS_PATH`、`NOT_ENOUGH_TEXT`、`WANTS_NOT_ENOUGH_TEXT`；加下面 Produces 的函式）
- Modify: `src/client/stats-data.js`（`activityIds()` 換成 `activityIndex()`；刪 `NO_STATS_TEXT`）
- Delete: `src/client/hosts.js`、`src/client/district-wants.js`
- Modify: `src/styles/site.css`（刪 `.host-*`、`.hosts-link`、`.stats-link`、首頁 `.district-wants` 規則）
- Test: `tests/build.test.mjs`、`tests/render-entry.test.mjs`、`tests/render-stats.test.mjs`、`tests/stats-view.test.mjs`

**Interfaces:**
- Produces（`src/render/entry.mjs`）：`coverThumbPath(activity) → string | null`，例如 `'cards/kitchen/A-thumb.webp'`。
- Produces（`src/render/stats.mjs`）：`activityIndexScript(activities)` 輸出 `<script type="application/json" id="activity-index">`，內容 `{ [name]: { id, cover } }`，`cover` 可能是 `null`。
- Produces（`src/client/stats-data.js`）：`activityIndex() → { [name]: { id, cover } }`。
- Produces（`src/lib/stats-view.mjs`）：
  - `activityHref(name, index, rel) → string | null`（改吃 index）
  - `activityCover(name, index, rel) → string | null`
  - `reviewTitle(scope) → string`：`all` → `全台的回顧`，其他 → `${scope.label}的回顧`
  - `dayParts(isoDate) → { day: '11/16', weekday: '週六' }`
  - `personDots(counts, choices) → number[]`：每人一個，值是選項索引，照選項順序排；`counts` 是 `undefined` 時回 `[]`
  - `summaryLine(sessions) → string`：`共 ${場數} 場、${份數} 份參加者問卷`
  - `districtsWithSessions(sessions, districts) → string[]`：照 `districts` 順序，只留有場次的
  - `CARD_ROWS`：`[{ key: 'listened', label: '有人認真聽他說話' }, { key: 'closer', label: '跟人變熟了' }, { key: 'again', label: '下次還想來' }]`（choices 從 `ANSWER_ROWS` 對 key 取）
  - `SAMPLE_SESSION`：`{ id: 'sample', date: '2026-11-14', district: '', activity: '男人的廚房', responses: 5, answers: { listened: { 有: 4, 普通: 1 }, closer: { 有: 3, 普通: 2 }, different: { 很不一樣: 2, 有點不一樣: 2, 差不多: 1 }, again: { 會: 4, 看時間: 1 } }, next: [] }`
  - `EMPTY_TEXT = '還沒有問卷回覆。主持人用當天模式帶完一場，最後一步請大家掃問卷 QR，填完的那一場就會出現在這裡。'`

- [ ] **Step 1: 改測試**
  - `build.test.mjs`：
    - `with signIn, entry, all, activity…` 改成 `with signIn only the two review pages carry the sign-in panel`：`stats/index.html`、`stats/session/index.html` 有 `SIGN_IN_PIECES`；其餘每一頁都不含 `signin`。
    - `…the home page loads the wants script` 改成 `the review pages are behind sign-in, load the account footer and are kept out of search`：兩頁含 `js/account.js`、`id="activity-index"`、`<meta name="robots" content="noindex">`；首頁不含 `district-wants`、`account.js`。
    - 刪 hosts 那個測試，新增 `no hosts page is built`：有沒有 `signIn` 都沒有 `hosts/index.html`。
    - 新增 `the build fails without a cover for the sample card`：`activityFiles` 裡沒有 `kitchen` 時，`renderPages` 丟出含 `kitchen` 的錯誤（fixture 沒有 kitchen 的話，在有 `signIn` 的 fixture 加一個）。
  - `render-entry.test.mjs`：刪三個 district wants／account footer 測試；新增 `coverThumbPath points at the first story card thumbnail`。
  - `render-stats.test.mjs`：刪 hosts 測試；`the stats page links to adding a host and back home` 改成不含 `hosts`；`activity ids are embedded…` 改成 `activity index carries id and cover and cannot close the script tag`。
  - `stats-view.test.mjs`：每個 Produces 的函式各一個測試，含 Review Focus 1、2、3、5（`activityCover('舊名字', index, '')` 是 `null`；`personDots({ 有: 2 }, ['有','普通','沒有'])` 是 `[0, 0]`；`personDots({ 有: 1, 沒有: 2, 普通: 1 }, …)` 是 `[0, 1, 2, 2]`；`reviewTitle({ level: 'district', label: '中和區、永和區' })` 是 `中和區、永和區的回顧`；`dayParts('2026-11-14')` 是 `{ day: '11/14', weekday: '週六' }`）。
  - 隱私權頁：`build.test.mjs` 的隱私權測試加斷言：不含「主持人」、含「創價班通訊錄和男子部幹部名單」。

- [ ] **Step 2: 跑測試確認失敗**

  Run: `npm test`
  Expected: 上面改過、新加的測試 FAIL

- [ ] **Step 3: 照 Files 實作**（`stats.js`、`stats-session.js` 暫時只改 import 讓它們能載入，畫面留給 Task 5、6）

- [ ] **Step 4: 跑測試確認通過**

  Run: `npm test && npm run build`
  Expected: 全部 PASS

- [ ] **Step 5: Commit** — `Open every content page and keep sign-in for the review pages only`

### Task 5: 每一場的回顧（回顧卡清單）

**Files:**
- Modify: `src/render/stats.mjs`（`renderStatsMain({ rel })`：`<header class="stats-head"><h1>每一場的回顧</h1><p class="lead"></p></header>`、`.stats-district`、`.stats-status`、`<section class="review-wants" hidden>`、`<div class="review-cards"></div>`、`<section class="review-empty" hidden>`、`<footer class="account-foot" hidden></footer>`；刪「回到推薦」以外不用的連結）
- Modify: `src/client/stats.js`（畫面照設計文件第 5 節）
- Create: `src/client/review-card.js`（`reviewCard(session, { index, rel, showDistrict, href }) → HTMLElement`，`href` 是 `null` 時整張不是連結；小卡和範例卡共用）
- Modify: `src/client/account.js`（只畫「已用 xxx 登入・登出」）
- Modify: `src/lib/palette.mjs`（`--dot-mid`）、`src/styles/site.css`（`.review-*`、`.dot`）
- Test: `tests/styles.test.mjs`、`tests/palette.test.mjs`（若有檢查變數清單）

**Interfaces:**
- Consumes: Task 4 的 `reviewTitle`、`dayParts`、`personDots`、`summaryLine`、`districtsWithSessions`、`CARD_ROWS`、`SAMPLE_SESSION`、`EMPTY_TEXT`、`activityIndex`、`activityCover`、`wantsHeading`、`wantsCaption`。
- Produces: `reviewCard`（Task 6 不用，但 class 名 `.dot`、`.dot-0`、`.dot-1`、`.dot-2` Task 6 共用）。

- [ ] **Step 1: 寫測試** — `styles.test.mjs` 新增 `answer dots use the theme colours`：`.dot-0` 用 `var(--step4)`、`.dot-1` 用 `var(--dot-mid)`、`.dot-2` 是空心（`background: transparent` 且有 `border`）；`.review-empty .review-card` 是 `border-style: dashed`。
- [ ] **Step 2:** `node --test tests/styles.test.mjs` → FAIL
- [ ] **Step 3: 實作**
  - 標題改成 `reviewTitle(record.scope)`（同時改 `document.title`）；`.lead` 放 `summaryLine(目前顯示的場次)`，沒有場次時放「參加者問卷的結果，一場一張卡。」。
  - 下拉：`districtsWithSessions` 超過一個才顯示，選項「全部」＋那些區，`?d=` 照舊。
  - 「你們區的人想約」：`wants` 有 `top` 而且不是空的才顯示，`<h2>` 用 `wantsHeading`、`<ol>` 每項「名稱・N 人」（名稱可點用 `activityHref`）、下面 `wantsCaption`。
  - 每場一張 `reviewCard`：封面（`activityCover`，沒有就不放 `<img>`）、`dayParts` 的大日期與週幾、活動名＋「N 份問卷」（`showDistrict` 時加「・區名」）、`CARD_ROWS` 三列點（`personDots`，`answers` 沒有時整塊不畫）。連到 `session/?id=…`，有 `?d=` 時帶上。
  - 沒有場次：`.review-empty` 顯示 `EMPTY_TEXT` ＋ `reviewCard(SAMPLE_SESSION, { href: null })`，卡上加「範例」標籤；不顯示下拉和「想約」。
  - 尺寸照模擬圖：封面 64px 寬 4:5、日期 26px 900、週幾 12px；點 14px、間距 4px、`flex-wrap: wrap`。
- [ ] **Step 4:** `npm test && npm run build` → PASS
- [ ] **Step 5: 看畫面** — `npm run preview`，用 Chrome 開 `http://localhost:8766/stats/`（已登入的話）。要看有資料的樣子：在 Console 把假資料寫進 `sessionStorage['brotime.stats:<登入信箱>']`（格式 `{ savedAt: Date.now(), stats: { wants, sessions } }`），重新整理。截圖確認：有資料、空白、多區（下拉）三種。
- [ ] **Step 6: Commit** — `Show each session as a review card with its answers at a glance`

### Task 6: 這一場的回顧

**Files:**
- Modify: `src/render/stats.mjs`（`renderSessionMain({ rel })`：最上面 `<p class="home-link"><a class="review-back" href="${rel}${STATS_PATH}">← 每一場的回顧</a></p>`、`.stats-status`、`<article class="session" hidden>`、`<footer class="account-foot" hidden>`）
- Modify: `src/client/stats-session.js`
- Modify: `src/styles/site.css`（`.session-hero`、`.legend`、`.answer` 改用點）

**Interfaces:**
- Consumes: Task 4 的 `ANSWER_ROWS`、`personDots`、`dayParts`、`reviewTitle`、`activityHref`、`activityCover`、`activityIndex`；Task 5 的 `.dot-*` class。

- [ ] **Step 1: 寫測試** — `render-stats.test.mjs` 新增 `the session page starts with a way back to the review list and ends with the account footer`。
- [ ] **Step 2:** `node --test tests/render-stats.test.mjs` → FAIL
- [ ] **Step 3: 實作**（照設計文件第 6 節）
  - 返回連結文字換成 `← ${reviewTitle(scope)}`，`?d=` 有值時帶回去。
  - 開頭：封面 92px、`dayParts` 日期 36px 900、活動名 `<h1>`（可點）、「區名・N 份參加者問卷」。
  - 圖例一行：每一題自己的三個選項各配一個點。四題各一段：題目、`personDots` 的點、「選項 數字」用「・」接（例如「有 4・普通 1・沒有 0」）。
  - 「下一次想參加哪一種」：每項小封面 40px、名稱、勾的人數個點（全用 `.dot-0`）；空的寫「沒有人勾。」。
  - 沒有 `answers`（舊 API）時只畫開頭那塊。
- [ ] **Step 4:** `npm test && npm run build` → PASS
- [ ] **Step 5: 看畫面** — 同 Task 5 Step 5 的假資料，點進一張卡截圖。
- [ ] **Step 6: Commit** — `Show one session's answers as one dot per person`

### Task 7: 全部驗證、使用者確認、上線

- [ ] **Step 1:** `npm test && npm run build && npm run build:apps-script` 全過；`npm run preview` 後確認 `dist-preview/` 只有 `stats/` 兩頁含 `signin`：`grep -rl signin dist-preview --include=index.html` 只列出那兩頁。
- [ ] **Step 2:** 請使用者在 `http://localhost:8766/` 看：首頁沒有任何登入字樣；`/stats/` 登入畫面的字；登入後的回顧頁（真實資料目前是空白，看範例卡）；隱私權頁新字。
- [ ] **Step 3:** 更新 `HANDOFF.md` 最上面那節（開放、回顧頁網址、補充名單已刪），commit。
- [ ] **Step 4:** `git -C ~/code/brotime-portal fetch && git -C ~/code/brotime-portal merge --ff-only origin/task11-go-live`（先 `git push origin task11-go-live`），`git -C ~/code/brotime-portal push origin main`，`gh run watch` 看 Actions 成功。
- [ ] **Step 5:** 請使用者用手機照設計文件第 12 節測正式網址，並問要不要刪 `SUPPLEMENT_ID` 屬性和補充名單試算表。
