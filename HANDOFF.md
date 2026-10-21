# 交接：兄弟時光活動入口網站

2026-10-21 腦力激盪與規劃完成，使用者已核准設計文件與實作計畫，選擇逐任務交給新的 agent 執行（superpowers:subagent-driven-development）。

## 先讀

1. 設計文件：`docs/2026-10-21-brotime-portal-design.md`
2. 實作計畫：`docs/superpowers/plans/2026-10-21-brotime-portal-v1.md`（21 個任務）
3. 草圖：`docs/mockups/`（HTML 片段，排版靠當初的預覽伺服器，直接開會跑版，但內容看得懂）

## 現況

- 這個資料夾只有文件，還沒 `git init`，計畫的 Task 1 會做。
- 程式碼一行都還沒寫。

## 執行時要記得

- **三個使用者檢查點，一定要停下來問：**
  - Task 11 Step 5：確認 16 個活動的標籤
  - Task 20 Step 2：在 GitHub 組織 twsokahan 建公開 repo `twsokahan/brotime-portal`、首次推送 main
  - Task 21 Step 4：逐一確認活動內容後才改成 `ready`
- **subagent 的模型：** 派 review 類 subagent 時指定 `model: "sonnet"`，實作用預設模型（使用者的全域規則）。
- **review 最多兩輪：** 用三個閘門篩 finding，規則見 `~/CLAUDE.md`。不修的 low 級 finding 記在本檔最下面的「延後清單」。
- **GitHub 推送：** 本機 SSH 金鑰是公司帳號，推 GitHub 上的 repo 要用 `gh` 的 HTTPS 認證，做法同 `~/code/city-walk-review`。repo 開在組織 `twsokahan` 底下（不是個人帳號 cades）；本機 gh 登入的 cades 是組織 admin，token 有 repo、read:org。組織是免費方案，只有公開 repo 能用 Pages，這會是組織第一個公開 repo（目前 8 個都是私人的），問使用者時順便提。
- **不能動的內容規則：** 引文只能用故事卡上已有的文字，台詞和故事全文不要改寫。內容來源在 `~/code/sokahan-propalsal-2026/`。
- **城市散步路線：** 還在路線檢閱網站收意見，入口網站一律從 `~/code/city-walk-review/data/routes.json` 匯入，不要手抄。
- **整個 repo 會公開**（原始碼、docs/、本檔、docs/content-notes/ 都是）：不要寫個人信箱、電話、金鑰、token 或其他私人資料。部署方式已定案：公開的 `twsokahan/brotime-portal` 用 GitHub Actions 部署 Pages，不另開網站 repo。
- **完成通知：** 全部做完、test 和 build 都過之後，用 terminal-notifier 和 Pushover 以繁體中文通知使用者（參數見 `~/CLAUDE.md`）。

## 網域決定（2026-10-21，Task 20 上線時處理）

正式網址是 **kyodai-tokimitsu.twsokahan.org**，**brotime.twsokahan.org** 只當轉址。部署前不用改任何東西，計畫其他部分照舊。

背景：twsokahan.org 是創價班現有的網域（sokahan-web 在用），透過 Google Cloud Domains 註冊（gcloud 專案 sokahan），DNS 放在 Google Cloud DNS，2027-01-13 到期。網域續約在 Google Cloud Domains（專案 sokahan）自動進行，可用 `gcloud domains registrations list --project sokahan` 查。

上線前的預設網址是 `https://twsokahan.github.io/brotime-portal/`，`content/site.json` 的 `baseUrl` 先用這個（測試 fixture 裡的 cades.github.io 是假資料，不用改）。

Task 20 先用 github.io 確認部署成功，再依序做：

1. **DNS 與網域驗證已完成**（2026-10-21，規劃 session 處理，這步跳過）：
   - twsokahan.org 已在 GitHub 組織 twsokahan 驗證成功。TXT `_github-pages-challenge-twsokahan.twsokahan.org` **不要刪**。
   - `kyodai-tokimitsu.twsokahan.org` 和 `brotime.twsokahan.org` 都已 CNAME 到 `twsokahan.github.io.`（TTL 300），Google 權威 DNS 和 8.8.8.8 都查得到。
   - 在 Pages 設自訂網域之前，這兩個網址顯示 GitHub 的 404 是正常的。網域已驗證，別人沒辦法接走子網域。

2. **先用 `https://twsokahan.github.io/brotime-portal/` 確認部署成功，再做正式網站這邊：**
   - Pages 自訂網域設成 `kyodai-tokimitsu.twsokahan.org`，開強制 HTTPS
   - `content/site.json` 的 `baseUrl` 改成 `https://kyodai-tokimitsu.twsokahan.org/`
   - 加 `public/CNAME`，內容只有 `kyodai-tokimitsu.twsokahan.org`
   - README 的「換網域」段落照實際狀況更新
3. **轉址網站：** 另開小 repo `twsokahan/brotime-redirect`。跟 Task 20 Step 2 一樣，建公開 repo 前要先問使用者。
   - `CNAME` 檔：`brotime.twsokahan.org`
   - `index.html` 和 `404.html` 內容相同：用 `location.replace('https://kyodai-tokimitsu.twsokahan.org' + location.pathname + location.search + location.hash)` 保留路徑轉址，加上 meta refresh 轉到正式網址首頁當備援，以及指向正式網址的 canonical
   - 驗收：`brotime.twsokahan.org/a/brunch/` 會轉到 `kyodai-tokimitsu.twsokahan.org/a/brunch/`
4. **分享連結、QR code、LINE 預覽一律用正式網址**，不要用 brotime。

## 延後清單

（目前沒有）
