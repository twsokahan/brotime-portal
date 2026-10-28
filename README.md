# 兄弟時光

創價班「兄弟時光」的活動網站。20 種活動，每個活動一頁：要準備什麼、當天怎麼帶、故事卡和話題卡都在上面。主持人當天打開手機照著走就好。

正式網址：https://kyodai-tokimitsu.twsokahan.org/

## 要先裝什麼

- **Node 24.2 以上**。不用 `npm install`，這個專案沒有任何套件。
- 城市散步的地圖用 Leaflet 1.9.4，檔案直接放在 `public/vendor/leaflet/`，不用 npm。底圖是國土測繪中心的臺灣通用電子地圖，不用金鑰。
- 只有要從 PDF 切卡片圖時，才需要 Python 3、Pillow（`pip install pillow`）和 `pdftoppm`（`brew install poppler`）。

## 常用指令

| 指令 | 做什麼 |
|---|---|
| `npm test` | 跑全部測試，也會檢查 `content/` 裡每個活動有沒有填對（漏了欄位、台詞太長、卡片圖找不到……）。改完內容一定先跑，錯的地方會用中文列出來。 |
| `npm run preview` | 產生預覽版到 `dist-preview/`。`review` 的活動在預覽版會像上線一樣顯示，給自己看內容用。 |
| `npm run serve` | 在自己電腦開 http://localhost:8766/ 看預覽版（先跑 `npm run preview`）。 |
| `npm run build` | 產生正式版到 `dist/`。GitHub 上線時跑的就是這個，平常不用自己跑。 |

`dist/`、`dist-preview/` 不進 git。

## 活動的三種狀態

每個活動 JSON 裡的 `status`：

- `preparing`：準備中。網站只顯示名稱，寫「準備中」。
- `review`：內容做好了，等人看過。正式站還是顯示「準備中」，預覽版才看得到內容。
- `ready`：上線。

### 把 `review` 改成 `ready`

1. `npm run preview`、`npm run serve`，在手機寬度把整頁看一遍，按「開始」把當天的每一步走一遍。
2. 打開 `content/activities/<id>.json`，把 `"status": "review"` 改成 `"status": "ready"`。
3. `npm test` 通過後 commit，推到 `main`，幾分鐘後就上線了。

`ready` 和 `review` 的檢查一模一樣，`review` 過得了，改成 `ready` 也會過。

## 新增或修改一個活動

一個活動一個檔：`content/activities/<id>.json`。20 個活動的檔案都已經在了，準備中的活動只有基本資料，照已上線的活動（例如 `brunch.json`）把內容補齊，再把 `status` 改成 `review`。`order` 最大是 20，要加第 21 個時把 `src/lib/schema.mjs` 的 `MAX_ORDER` 加大。

- `id` 跟檔名一樣，網址就是 `a/<id>/`。**定了就不要改**，不然已經分享出去的連結會壞掉。
- `name` 要跟三份問卷「活動」那一題的選項一字不差（網站會自動把活動名稱帶進問卷），測試會擋。要改名字，問卷選項也要一起改。
- `todo`（「你要做的」）每一項是 `{ "when": ..., "task": ..., "detail": ... }`：
  - `when`：什麼時候做，例如 `"3–4 週前"`。同一個時間的事會排在一起。
  - `task`：做什麼，**最多 20 個字**（標點也算）。
  - `detail`：可以不寫。補充說明放這裡，網站上收起來，點開才看得到。
- `steps` 是當天的每一步。`say`（「說這句就好」）只能一句、最多 45 個字。
- 故事卡**不放原文**（2026-10-27 起因為版權，《新・人間革命》的原文段落不能出現在網站上；放了 `text`，`npm test` 會擋）。每張故事卡改放翻書指引 `guide: { volume, chapter, page, steps: [{ label, text, note }], duration, tips }`，由 `~/code/sokahan-propalsal-2026/plan-builder/book_guide_back.py` 的 `portal_guide(guide(活動 id, 卡片 id))` 產生，不要手寫。網站照紙本背面的樣子顯示：第幾卷〈章〉、約第幾頁、從哪句念到哪句、跳讀、念多久；挑卡的縮圖下面寫「要帶第幾卷」，城市散步選好區後寫要帶哪兩本。卡名、出處、分享提問、`note` 照卡片正面一字不差。
- 活動頁開頭（基本資訊之後、「要準備」之前）有「要準備的《新・人間革命》」區塊，照各卡 `guide` 自動產生，不用另外填：只有一張卡或全在同一卷就寫「要帶第N卷〈章〉」；要挑一張就列出每一卷有哪幾張卡（同卷合併，例如「A、B 在第18卷」）；一天念兩張、其中一張要挑的（新春拜年團）寫「選 A：只帶…」「選 B：帶…」；城市散步寫要帶兩本，停留點一那本選好區才出現。沒有故事卡的（桌遊之夜）不顯示。規則在 `src/lib/book-guide.mjs` 的 `booksPlan`。
- 「你要做的」裡借書那項（task 含「借好」）的 `detail` 和「帶齊了嗎」的帶書項目，照 `~/code/sokahan-propalsal-2026/plan-builder/book_guide_v1/books_needed_v1.json` 的 `plan_sentence`、`item_row`（跟企劃案、一分鐘看懂同一套句子；帶書項目改成跟其他項目一樣以「帶了」收尾，例如「《新・人間革命》帶了（A、B 在第18卷，C 在第19卷）」）；`npm test` 會檢查借書那項有寫到每一卷，也會擋「看背面寫的是」。
- 改完內容要確認沒有原文：`python3 ~/code/sokahan-propalsal-2026/plan-builder/check_no_passages.py content/activities/*.json`，每個檔都要印出 clean。
- 企劃案 PDF（`planFile`）和想印實體卡的人下載的 PDF（`printFiles`）放在 `public/files/`。正式公開前，卡片 PDF（檔名不是 `-plan.pdf` 結尾的）要加浮水印再放進來：`python3 ~/code/sokahan-propalsal-2026/plan-builder/watermark.py 來源.pdf public/files/<檔名>`，沒加的話 `npm test` 會擋。
- 卡片可以帶 `reveal: { lead, text, source }`（桌遊之夜的情境卡）：當天模式點開那張卡時，下面有「投完票再揭曉」，點了才顯示池田先生的話。
- 只在某段期間才能約的（名畫小旅行只限 2027 年 10 月展期），加 `availability: { from, to, label, note }`：`from`、`to` 是 `YYYY-MM-DD`，`label` 像 `"2027 年 10 月"`，`note` 可以不寫。活動頁標題下會寫「只限 2027 年 10 月：（note）」，首頁卡片和「幫我挑」的結果標「限 2027 年 10 月」；「幫我挑」從 `from` 的前兩個月到 `to` 當天推薦它（提前幾個月是 `src/lib/recommend.mjs` 的 `DATED_LEAD_MONTHS`）。
- `extra30`（「想多留 30 分鐘」）每一項通常是一句話；要連到城市散步某一條路線時寫成 `{ "text": ..., "cityWalkRoute": "高雄北區" }`，後面會多一個「看路線」，打開城市散步頁並選好那條路線。`cityWalkRoute` 是路線 id（見下面「城市散步的路線」），寫錯 `npm test` 會擋。標題想換掉「想多留 30 分鐘（選配）」，加 `extraTitle`。
- 要讓主持人挑地點的（去創美走走的 12 個分館），加 `venues: { title, prompt, intro, link, places }`。活動頁在流程上面多一個選單，選了就展開那一館的地址、交通、吃飯喝咖啡（`food`）、順路走走（`walks`）、城市散步（`cityWalks`，每項 `{ text, cityWalkRoute }`）和出發前留意（`notes`，可以不寫）。`food`、`walks` 每項是 `{ name, what, hours, distance, why, mapsUrl }`（`why` 可以不寫）。每一館要有座標 `lat`、`lon`（國土測繪中心查門牌），選單下面的「用我的位置找最近的分館」用手機定位挑直線最近的一館（只在手機上算，位置不會傳出去；瀏覽器不支援定位就不出現）。選了哪一館記在網址 `?v=` 和手機裡。步驟加 `venueStop: "meet"` 時，當天模式那步會帶出那一館的地址和地圖按鈕；`venueStop: "sit"` 會列出附近吃飯喝咖啡的店。
- 話題卡加 `forKids: true`，當天模式抽卡會多一個「小朋友也能答」分類，只抽這些卡。
- 話題卡要跟著故事卡用的（看球就一起的深題，每張故事卡配三張），每張加 `storyCard: "<故事卡 id>"`，念故事之前聊的那張再加 `beforeStory: true`。同一步同時用到故事卡和這組卡時，當天模式不抽卡：選了哪張故事卡，就在故事卡上面放 `beforeStory` 的卡（「念故事之前先聊」），下面放其他的卡（「念完再聊」），換一張故事卡就跟著換。整組都沒有 `beforeStory` 時（露營星空夜、田園烤肉會、清晨登山的「故事念完、沒人接話時」），標題只寫組名 `label`。這組卡放在沒有故事卡的步驟時（清晨登山第 5 步），跟著前面最近一步選的那張故事卡，標題是「組名：〈故事卡標題〉」。
- 一步裡有不只一組卡時（田園烤肉會第 3 步兩疊話題卡、清晨登山第 3 步話題卡加故事卡），當天模式每一疊抽卡上面會顯示那組的 `label`，主持人才分得出是哪一疊。
- 有給第一次來的朋友看的小抄（看球就一起的新手小抄），加 `guide: { title, intro, sections: [{ heading, items }] }`（`intro` 可以不寫）。會多一頁 `a/<id>/guide/`（可以分享到 LINE，留在 LINE 裡開），活動頁「企劃室提供」下面有連結；步驟加 `tool: "guide"`，當天模式那步會有一個收起來的「新手小抄」，點開就看得到全文（不用網路）。
- `flowNote` 是流程標題下面的一行小字（去創美走走用來說「先吃飯再看展也可以」），可以不寫。
- 首頁的封面用第一組故事卡的第一張；沒有故事卡的活動（桌遊之夜）用 `cardSets` 第一組的第一張，所以盒子那組要排在最前面。

完整的欄位規則寫在 `src/lib/schema.mjs`，填錯的話 `npm test` 會告訴你哪個欄位要怎麼改。

### 卡片圖

網站上的卡片圖放在 `public/cards/<id>/`，每張卡有三種：

- `<卡片id>.webp`：大圖
- `<卡片id>-thumb.webp`：縮圖
- `<卡片id>-og.jpg`：只有故事卡有，分享到 LINE 時的預覽圖

這些圖用 `tools/cards.py` 從卡片 PDF 切出來，不用自己一張一張截：

1. 寫一份 `tools/cards/<id>.json`（照現有的抄）：每一組卡寫 PDF 在哪、解析度（`dpi`）、要不要做 LINE 預覽圖（故事卡 `"og": true`），再列出每張卡的 `id`、在第幾頁、`box`（卡片在頁面上的範圍，用頁面寬高的比例寫 `[左, 上, 右, 下]`）。
   要當首頁封面、但比例不是 4:5 的圖（例如盒蓋），加 `"pad": { "aspect": [4, 5], "color": "#2b1d14" }`，裁完會置中補底色到 4:5，首頁才不會切掉兩側。
2. 跑 `python3 tools/cards.py tools/cards/<id>.json`。
3. 它最後會印出一張檢查圖的位置，打開看每張卡有沒有切歪、切到別張。

卡片的 `id` 要跟活動 JSON `cardSets` 裡的一樣，`npm test` 會檢查每張圖都在。

正式公開前，`tools/watermark.json` 的 `enabled` 是 `true`：`cards.py` 會在每張圖的右下角加上創價班徽章＋twsokahan 的浮水印（角落有字時會挪到旁邊的空白處）（怕內部版本外流後被當成正式版），`npm test` 也會檢查卡片圖和卡片 PDF 都有浮水印。正式公開時把它改成 `false`，所有 `tools/cards/*.json` 重跑一次 `cards.py`，`public/files/` 的卡片 PDF 換回原檔。

## 城市散步的路線

`content/city-walk/routes.json` **不要手改**。它是從路線檢閱網站的資料匯入的：

```sh
node tools/import-city-walk.mjs
```

預設讀 `~/code/city-walk-review/data/routes.json`，放在別的地方就加 `--src <檔案路徑>`。路線有改就重跑一次，`npm test` 過了再 commit。匯入時會把只給企劃室看的待辦、警示、備註丟掉，不會上到網站。停車說明最後那句給企劃室的「（汽車、）機車停車位需實地確認」，會改成給主持人的「（汽車、）機車停哪裡，建議事先到現場看一下」，停車說明的其他文字不動。

## 問卷和回報表

三份 Google 表單的連結放在 `content/site.json` 的 `surveys`：

- `participant`：參加者問卷（活動最後秀 QR code 給大家掃）
- `staff`：工作人員問卷
- `report`：活動回報表（區負責人活動後一週內填）

每一項是 `{ "url": ..., "activityEntry": ... }`。`url` 是表單的公開填寫網址；`activityEntry` 是表單「活動」那一題的代號，像 `entry.313211030`，在表單的「取得預先填入的連結」產生的網址裡找得到。網站會用它把活動名稱先填好。還沒有表單的話填 `null`。

某個活動要用自己的表單，就在那個活動的 JSON 加 `surveys`，寫法一樣。

**這個 repo 是公開的**：只放公開填寫網址，表單的編輯網址、回覆試算表網址都不要放進來。個人信箱、電話、金鑰也一樣。

## 怎麼上線

推到 `main` 之後，GitHub Actions（`.github/workflows/pages.yml`）會跑 `npm test` 和 `npm run build`，兩個都過才把 `dist/` 部署到 GitHub Pages。測試沒過就不會上線，到 GitHub 上這個 repo 的 Actions 分頁看是哪裡錯。開 pull request 時只跑測試和 build，不會上線。

## 網域

正式網址是 **kyodai-tokimitsu.twsokahan.org**，設定在三個地方：

1. GitHub 這個 repo 的 Settings → Pages → Custom domain，並勾選 Enforce HTTPS。網域真正生效靠這裡。
2. `public/CNAME`：只有一行 `kyodai-tokimitsu.twsokahan.org`，跟著網站一起部署。
3. `content/site.json` 的 `baseUrl`：`https://kyodai-tokimitsu.twsokahan.org/`。分享出去的卡片連結、QR code、LINE 預覽都用它組成完整網址。

網站裡其他連結都是相對路徑，換網域時只要改上面三個地方，程式不用動。

**brotime.twsokahan.org 只是轉址**，放在另一個 repo `twsokahan/brotime-redirect`，會帶著原本的路徑轉到正式網址（例如 `brotime.twsokahan.org/a/brunch/` 轉到 `kyodai-tokimitsu.twsokahan.org/a/brunch/`）。分享連結和 QR code 一律用正式網址，不要用 brotime。

twsokahan.org 的 DNS 在 Google Cloud DNS，兩個子網域都是 CNAME 指到 `twsokahan.github.io.`。TXT 紀錄 `_github-pages-challenge-twsokahan.twsokahan.org` 是 GitHub 驗證網域用的，不要刪，刪了別人就可能接走子網域。
