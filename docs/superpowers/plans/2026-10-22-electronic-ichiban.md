# 電子一番賞 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A page `a/<activity id>/ichiban/` where the host enters how many A–D prizes they prepared, passes the phone around, and each person picks a boarding pass and tears off its stub to see the prize.

**Architecture:** Pure round logic in `src/lib/ichiban.mjs` (shipped to the browser unchanged, unit-tested in Node). The page shell is rendered at build time by `src/render/ichiban.mjs` and pushed by `scripts/build.mjs` only for activities that are shown as ready and have an `ichiban` setting; everything that depends on the round (tickets, results) is drawn at run time by `src/client/ichiban.js` from localStorage. Activity data gains `ichiban` (default counts) and a step field `tool: "ichiban"` (where the live-mode button goes).

**Tech Stack:** Node 24 ESM, zero dependencies, `node:test` + `node:assert/strict`, plain browser JS modules, one CSS file.

**Spec:** `docs/superpowers/specs/2026-10-22-electronic-ichiban-design.md`

## Global Constraints

- Zero npm dependencies; nothing is bundled. `src/lib/*.mjs` is served to browsers as is: no `node:` imports, pure functions only.
- All `href`/`src` in generated HTML are relative; escape every inserted text with `escapeHtml` (`src/render/html.mjs`).
- Copy avoids the words banned by `tests/content.test.mjs` `OLD_EVENT_WORDING` (開始活動, 活動結束, 舉辦, 回到活動頁, 這個活動, 活動前, 活動後, 活動最後, 活動回報表, 主辦) — the test scans every page and every file in `src/client/` and `src/lib/`.
- Grades are fixed: `A`, `B`, `C`, `D`, plus a 最後賞 that is not a ticket. Per-grade count is an integer 0–99; total tickets 1–100.
- A saved round is stale when its `updatedAt` is more than 24 hours old.
- Storage key: `ichiban:<activity id>`.
- Before a seat is torn, its grade must not appear in that ticket's text, attributes, classes or styles; it enters the DOM only when torn.
- Colours from the printed board: A `#c8442d`, B `#1f2f52`, C `#2d6c8f`, D `#e0a33a`, 最後賞 `#121a2e`; ticket paper `#fbf6ea`, page cream from the existing palette. Boarding pass copy as on the printed card: 「新春一番賞」「BOARDING PASS」, 冬 ✈ 春, 航班 FLIGHT 2027, 日期 DATE 新春, 登機門 GATE 唱題會, stub header 「SEAT」.
- Exact UI copy (spec §5–6): 「開始抽」, 「共 N 張」, 「至少要 1 張」, 「最多 100 張」, 「獎品（可不填）」, 「最後賞」, 「選一張，按下去」, 「剩 N 張」, 「座位 01」 (two-digit seat numbers), 「手指按住右邊的存根，沿著虛線往下拉」, 「撕開」, 「交給下一位 →」, 「你抽到最後一張！再多拿一份最後賞」, 「全部抽完了」, 「重新開始」 → 「確定重來？」, activity page link 「電子一番賞（不用刮刮卡也能抽）」, live-mode button 「打開電子一番賞」, back link 「← 回到<activity name>」.
- No `window.confirm`/`alert`/`prompt`.
- Commit messages in English with the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; never `--no-verify`. The repo is public.

## Review Focus

1. Reload or reopen the page in the middle of a round → same seats, torn ones stay torn with their grade, counts on the board unchanged (Task 1 round-trip test; Task 4 browser check).
2. Tapping a seat that is already torn, or tapping 「撕開」 twice → nothing is torn twice and the board does not go negative (Task 1 `tearSeat` test; Task 4 guards).
3. Saved data from an older shape, hand-edited, or with seats that do not match the counts → treated as no save, page shows setup with defaults, no exception (Task 1 `parseSaved` tests).
4. localStorage unavailable (private mode, blocked site data, some in-app browsers) → the round still works for this page view, it just is not saved (Task 4 storage wrapper).
5. 100 tickets on a 320 px phone → no horizontal scroll, every seat reachable, tear target large enough for a thumb (Task 4 browser check).

---

### Task 1: Round logic

**Files:**
- Create: `src/lib/ichiban.mjs`
- Test: `tests/ichiban.test.mjs`

**Interfaces:**
- Produces (all exported from `src/lib/ichiban.mjs`):
  - `GRADES = ['A', 'B', 'C', 'D']`, `MAX_TICKETS = 100`, `MAX_PER_GRADE = 99`, `STALE_AFTER_MS = 86_400_000`
  - `ticketTotal(counts) -> number` — `counts` is `{ A, B, C, D }`.
  - `countsProblem(counts) -> null | 'bad-count' | 'empty' | 'too-many'` — `'bad-count'` when any grade is not an integer 0–99.
  - `shuffle(items, randomInt) -> items[]` — new array, Fisher–Yates; `randomInt(n)` returns an integer in `[0, n)`.
  - `cryptoRandomInt(n) -> number` — uses `globalThis.crypto.getRandomValues` with rejection sampling (no modulo bias).
  - `startRound({ counts, prizes, lastPrize }, randomInt, nowMs) -> Round` where `Round = { version: 1, counts, prizes: { A, B, C, D }, lastPrize, seats: Grade[], torn: boolean[], updatedAt }`; `prizes`/`lastPrize` are trimmed strings, `''` when empty.
  - `tearSeat(round, seatIndex, nowMs) -> { round, grade, isLast } | null` — `null` if the index is out of range or already torn; never mutates its input.
  - `remainingByGrade(round) -> { A, B, C, D }`, `ticketsLeft(round) -> number`.
  - `isStale(round, nowMs) -> boolean`.
  - `parseSaved(text) -> Round | null` — `null` for anything that is not a valid version-1 round (bad JSON, wrong types, seats whose grade tally differs from `counts`, `torn.length !== seats.length`, `countsProblem(counts) !== null`).
  - `settingsFrom(round, defaults) -> { counts, prizes, lastPrize }` — the round's settings when `round` is a valid round, else `defaults` counts with empty prizes.

- [ ] **Step 1: Write the failing tests** in `tests/ichiban.test.mjs` (style of `tests/live.test.mjs`):
  - `ticketTotal({ A: 1, B: 2, C: 3, D: 4 })` is `10`.
  - `countsProblem` is `null` for `{1,2,3,4}`; `'empty'` for all zeros; `'too-many'` for `{ A: 99, B: 2, C: 0, D: 0 }` (101); `'bad-count'` for `A: -1`, `A: 100`, `A: 1.5`, `A: '1'`.
  - `shuffle` with `randomInt = () => 0` returns a deterministic permutation of the same multiset and leaves the input untouched.
  - `cryptoRandomInt(3)` over 300 calls only returns 0, 1, 2 and returns each at least once.
  - `startRound` with counts `{1,2,3,4}`, a fixed `randomInt`, `nowMs = 1000` gives `seats.length === 10`, the grade tally equals the counts, every `torn` is `false`, `updatedAt === 1000`, prizes trimmed.
  - `tearSeat` on seat 0 returns that seat's grade, marks only seat 0 torn, sets `updatedAt` to the new `nowMs`, leaves the original round unchanged; tearing seat 0 again returns `null`; index `-1` and `10` return `null`.
  - Tearing all ten seats in any order: `isLast` is `true` only on the tenth; `ticketsLeft` goes 10 → 0; `remainingByGrade` never goes negative and ends all zero.
  - `parseSaved(JSON.stringify(round))` deep-equals `round` (also after three tears); returns `null` for `'not json'`, `'null'`, version 2, a seats array with one grade swapped so the tally differs, `torn` one shorter than `seats`, counts `{ A: 0, B: 0, C: 0, D: 0 }`.
  - `isStale` is `false` at `updatedAt + 86_400_000` and `true` at `updatedAt + 86_400_001`.
  - `settingsFrom(null, { A: 1, B: 2, C: 3, D: 4 })` returns those counts with prizes `{ A: '', B: '', C: '', D: '' }` and `lastPrize: ''`; with a valid round returns its counts, prizes and lastPrize.

- [ ] **Step 2: Run** `node --test tests/ichiban.test.mjs` — expected FAIL (module not found).

- [ ] **Step 3: Implement** the interfaces above in `src/lib/ichiban.mjs`. Match the style of `src/lib/live.mjs` (named exports, small pure functions, no classes).

- [ ] **Step 4: Run** `node --test tests/ichiban.test.mjs` — expected PASS; then `npm test` — all pass, no warnings.

- [ ] **Step 5: Commit** `feat: add the round logic for an electronic ichiban kuji`

### Task 2: Data — `ichiban` setting and the step `tool` field

**Files:**
- Modify: `src/lib/schema.mjs` (activity-level check near the other optional activity fields; step check in `checkStep`, after the `routeLeg` check around :209)
- Modify: `content/activities/new-year-daimoku.json`, `docs/content-notes/new-year-daimoku.md`
- Test: `tests/schema.test.mjs`

**Interfaces:**
- Consumes: `GRADES`, `countsProblem` from Task 1 (import from `./ichiban.mjs`).
- Produces: activity field `ichiban: { grades: { A, B, C, D } }`; step field `tool: 'ichiban'`.

- [ ] **Step 1: Write the failing tests** in `tests/schema.test.mjs`, using the existing fixture builders:
  - A ready activity with `ichiban: { grades: { A: 1, B: 2, C: 3, D: 4 } }` and one step with `tool: 'ichiban'` validates with no errors.
  - Errors (one test each, asserting an error path that names the field): `ichiban.grades` missing `D`; `C: 1.5`; all zeros (total 0); `{ A: 99, B: 2, C: 0, D: 0 }` (101); `ichiban` not an object.
  - A step with `tool: 'ichiban'` on an activity without `ichiban` → error on `steps[i].tool`.
  - A step with `tool: 'quiz'` → error on `steps[i].tool`.

- [ ] **Step 2: Run** `node --test tests/schema.test.mjs` — expected FAIL on the new tests.

- [ ] **Step 3: Implement** in `src/lib/schema.mjs`: when `activity.ichiban` is present, check it is an object whose `grades` has exactly the keys of `GRADES` and `countsProblem(grades) === null`; in `checkStep`, when `step.tool !== undefined`, `check.oneOf(step.tool, ['ichiban'], …)` and fail if the activity has no `ichiban` (pass what `checkStep` needs through `checkSteps`). Write the error messages in Chinese like the neighbouring checks.

- [ ] **Step 4: Content.** In `content/activities/new-year-daimoku.json` add `"ichiban": { "grades": { "A": 1, "B": 2, "C": 3, "D": 4 } }`; on step 2 (「新春一番賞」) add `"tool": "ichiban"` and add to its `do` one sentence that the area chooses printed scratch cards or the electronic version, and how the electronic one goes (host fills in the counts, passes the phone, everyone picks one and tears it). Keep `say` unchanged unless it contradicts. In the content notes add a decision line: 電子一番賞（使用者 2026-10-22）：實體刮刮卡或電子一番賞，各區自己決定.

- [ ] **Step 5: Run** `npm test` — all pass, no warnings.

- [ ] **Step 6: Commit** `feat: let an activity offer an electronic ichiban kuji`

### Task 3: Page shell, build and links

**Files:**
- Create: `src/render/ichiban.mjs`
- Modify: `scripts/build.mjs` (ready branch of `renderPages`, after the story-card pages around :188), `src/render/activity.mjs` (`renderPrepare`, after the 「企劃室提供」 box), `src/client/activity.js` (`showStep` view children, after the card sets around :486)
- Test: `tests/render-ichiban.test.mjs` (model: `tests/render-card.test.mjs`), `tests/render-activity.test.mjs`, `tests/build.test.mjs` or a `renderPages` test

**Interfaces:**
- Consumes: Task 2's `activity.ichiban.grades`, step `tool`.
- Produces: `renderIchibanMain({ activity, rel }) -> string` containing `<div id="ichiban-app"></div>`, a `<noscript>` line, `<script type="application/json" id="ichiban-data">` with `{ activityId, name, defaults }` (`defaults` = `activity.ichiban.grades`), and the back link `<div class="back"><a href="${rel}a/${id}/">← 回到${name}</a></div>`. The page is pushed as `a/<id>/ichiban/index.html` with `page({ title: '電子一番賞｜<name>', rel: '../../../', main, scripts: ['js/ichiban.js'], leaveLine: true, ogUrl })`.

- [ ] **Step 1: Write the failing tests:**
  - `renderIchibanMain` output contains `id="ichiban-app"`, `id="ichiban-data"` whose JSON parses to `{ activityId: 'brunch', name: <fixture name>, defaults: { A: 1, B: 2, C: 3, D: 4 } }`, and the back link; escapes an activity name containing `<`.
  - `renderPages` with a ready fixture activity that has `ichiban` returns a path `a/<id>/ichiban/index.html` whose HTML includes `<script type="module" src="../../../js/ichiban.js"></script>` and the leave-LINE script; the same activity with status `review` gets the page with `preview = true` and does not get it with `preview = false`; a ready activity without `ichiban` gets no such page.
  - The ready activity page (`renderActivityMain`) contains `<a href="ichiban/">電子一番賞（不用刮刮卡也能抽）</a>` only when `ichiban` is set.

- [ ] **Step 2: Run** the three test files — expected FAIL.

- [ ] **Step 3: Implement** `src/render/ichiban.mjs`, the push in `renderPages` (use the same shown status as the activity page), the link in `renderPrepare`, and in `showStep` the button `step.tool === 'ichiban' && externalLink('打開電子一番賞', 'ichiban/', 'ichiban-open')` (new tab, so live mode keeps its place). Create `src/client/ichiban.js` as an empty module so the page's script tag resolves; Task 4 fills it.

- [ ] **Step 4: Run** `npm test` and `npm run build` — pass; `dist/a/new-year-daimoku/ichiban/index.html` exists.

- [ ] **Step 5: Commit** `feat: add the electronic ichiban page and its links`

### Task 4: The browser app — setup, pick, tear

**Files:**
- Modify: `src/client/ichiban.js`, `src/styles/site.css`

**Interfaces:**
- Consumes: everything in Task 1; `#ichiban-app` and `#ichiban-data` from Task 3.

- [ ] **Step 1: Storage and state.** Read `#ichiban-data`; storage through a try/catch wrapper like `browserStorage()` in `src/client/activity.js` (no storage → keep the round in memory only). On load: `parseSaved` the key `ichiban:<activityId>`; a valid, non-stale round → pick screen; stale or none → setup prefilled with `settingsFrom(savedOrNull, defaults)`. Save after 「開始抽」 and after every tear (`updatedAt` comes from `startRound`/`tearSeat`).

- [ ] **Step 2: Setup screen** (spec §5.1): four rows A–D with the grade colour chip, a count input (`inputmode="numeric"`, 0–99) and a prize input (placeholder 「獎品（可不填）」), a 最後賞 row with a prize input, 「共 N 張」 updated on input, 「開始抽」 disabled with the reason from `countsProblem` (`'empty'` → 「至少要 1 張」, `'too-many'` → 「最多 100 張」, `'bad-count'` → mark the offending row). Do not rewrite what the user typed. 「開始抽」 → `startRound(settings, cryptoRandomInt, Date.now())`.

- [ ] **Step 3: Pick screen** (spec §5.2): the board (each grade's colour and `remainingByGrade`, plus 「剩 N 張」), the prompt 「選一張，按下去」, a grid of small boarding passes labelled 「座位 01」…; untorn tickets carry only the seat number; torn tickets are dimmed and show their grade. 「重新開始」 → first press relabels to 「確定重來？」, second press within a few seconds clears storage and shows setup prefilled from the round; any other action resets the label. When `ticketsLeft === 0` show 「全部抽完了」 above the grid.

- [ ] **Step 4: Tear screen** (spec §5.3): the selected boarding pass large, stub with 「SEAT」 and the seat number; pointer drag down on the stub moves it along the perforation; past a threshold on release → torn, otherwise it springs back; a 「撕開」 button tears directly (keyboard reachable); the hint 「手指按住右邊的存根，沿著虛線往下拉」. On tear: call `tearSeat` (ignore `null`), save, show the grade large in its colour plus the prize name if set, `navigator.vibrate?.(30)`, then 「交給下一位 →」 back to the pick screen. If `isLast`, after the grade show 「你抽到最後一張！再多拿一份最後賞」 with the 最後賞 prize if set. Under `prefers-reduced-motion: reduce` skip the animation.

- [ ] **Step 5: CSS** in `src/styles/site.css`: boarding pass, stub with dashed perforation, grid, board, colours from Global Constraints; at 320 px no horizontal scroll with 100 tickets; stub and buttons at least 44 px tall.

- [ ] **Step 6: Verify in a browser.** `npm test` (pristine), `npm run preview`, serve `dist-preview` on a free port, gstack browse (`$HOME/.claude/skills/gstack/browse/dist/browse`) at 390×844 and 320×640 on `a/new-year-daimoku/ichiban/`:
  - setup → 「開始抽」 with defaults → pick screen shows 10 tickets and the board A1 B2 C3 D4;
  - evaluate `[...document.querySelectorAll('#ichiban-app .ticket:not(.torn)')].some(t => /[ABCD]賞|grade/i.test(t.outerHTML))` → `false` (use whatever ticket class you chose);
  - tear one with 「撕開」, reload, the same seat is still torn and the board shows one fewer;
  - tear the rest → 最後賞 message, then 「全部抽完了」;
  - set A 99 → 「開始抽」 disabled with 「最多 100 張」; set 100 tickets (e.g. A 25 B 25 C 25 D 25) → `document.documentElement.scrollWidth` equals the viewport width at 320;
  - the activity page shows the link, and live mode's 「新春一番賞」 step shows 「打開電子一番賞」.
  Screenshots to the scratch dir; revert anything browse creates in the repo (`.gstack/`, `.gitignore`).

- [ ] **Step 7: Commit** `feat: draw the electronic ichiban kuji by tearing boarding passes`

### Task 5: Handoff note

**Files:**
- Modify: `HANDOFF.md`

- [ ] **Step 1:** Replace the line about the electronic 一番賞 being designed with what now exists (page path, `ichiban` setting, step `tool`, storage key, 24-hour staleness) in two or three lines, and add one line under the 之後改東西要記得 list: another activity can offer it by adding `ichiban` and a step `tool: "ichiban"`, but the boarding-pass copy is written for 新春唱題會.
- [ ] **Step 2: Run** `npm test` — pass. **Commit** `docs: describe the electronic ichiban kuji in the handoff`
