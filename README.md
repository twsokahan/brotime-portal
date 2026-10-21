# 兄弟時光

創價班「兄弟時光」的活動網站。16 種活動，每個活動一頁：要準備什麼、當天怎麼帶、故事卡和話題卡都在上面。主持人當天打開手機照著走就好。

正式網址：https://kyodai-tokimitsu.twsokahan.org/

## 要先裝什麼

- **Node 24.2 以上**。不用 `npm install`，這個專案沒有任何套件。
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

一個活動一個檔：`content/activities/<id>.json`。16 個活動的檔案都已經在了，準備中的活動只有基本資料，照已上線的活動（例如 `brunch.json`）把內容補齊，再把 `status` 改成 `review`。

- `id` 跟檔名一樣，網址就是 `a/<id>/`。**定了就不要改**，不然已經分享出去的連結會壞掉。
- `name` 要跟三份問卷「活動」那一題的選項一字不差（網站會自動把活動名稱帶進問卷），測試會擋。要改名字，問卷選項也要一起改。
- `todo`（「你要做的」）每一項是 `{ "when": ..., "task": ..., "detail": ... }`：
  - `when`：什麼時候做，例如 `"3–4 週前"`。同一個時間的事會排在一起。
  - `task`：做什麼，**最多 20 個字**（標點也算）。
  - `detail`：可以不寫。補充說明放這裡，網站上收起來，點開才看得到。
- `steps` 是當天的每一步。`say`（「說這句就好」）只能一句、最多 45 個字。
- 故事卡的 `text` 要跟卡片一字不差。《新・人間革命》和御書的引文只用卡片上已經有的文字，不要自己改寫。
- 企劃案 PDF（`planFile`）和想印實體卡的人下載的 PDF（`printFiles`）放在 `public/files/`。

完整的欄位規則寫在 `src/lib/schema.mjs`，填錯的話 `npm test` 會告訴你哪個欄位要怎麼改。

### 卡片圖

網站上的卡片圖放在 `public/cards/<id>/`，每張卡有三種：

- `<卡片id>.webp`：大圖
- `<卡片id>-thumb.webp`：縮圖
- `<卡片id>-og.jpg`：只有故事卡有，分享到 LINE 時的預覽圖

這些圖用 `tools/cards.py` 從卡片 PDF 切出來，不用自己一張一張截：

1. 寫一份 `tools/cards/<id>.json`（照現有的抄）：每一組卡寫 PDF 在哪、解析度（`dpi`）、要不要做 LINE 預覽圖（故事卡 `"og": true`），再列出每張卡的 `id`、在第幾頁、`box`（卡片在頁面上的範圍，用頁面寬高的比例寫 `[左, 上, 右, 下]`）。
2. 跑 `python3 tools/cards.py tools/cards/<id>.json`。
3. 它最後會印出一張檢查圖的位置，打開看每張卡有沒有切歪、切到別張。

卡片的 `id` 要跟活動 JSON `cardSets` 裡的一樣，`npm test` 會檢查每張圖都在。

## 城市散步的路線

`content/city-walk/routes.json` **不要手改**。它是從路線檢閱網站的資料匯入的：

```sh
node tools/import-city-walk.mjs
```

預設讀 `~/code/city-walk-review/data/routes.json`，放在別的地方就加 `--src <檔案路徑>`。路線有改就重跑一次，`npm test` 過了再 commit。匯入時會把只給企劃室看的待辦、警示、備註丟掉，不會上到網站。

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
