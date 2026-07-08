# 課堂單選作答系統

這是一個純前端的課堂單選作答工具，適合部署在 GitHub Pages。老師用 Google Sheet 管理題目、選項與答案公布狀態；學生掃 QR code 進入網頁後作答，答案只儲存在學生自己的瀏覽器 localStorage。

## 系統限制

- 不使用 Apps Script、Firebase、Supabase、資料庫或任何自架後端。
- 不需要學生登入。
- 不會收集學生答案到雲端。
- 老師無法看到全班答對率或學生個別答案。
- 不適合正式考試、防作弊測驗或需要集中保存答案的情境。

## 快速開始

1. 開啟 `teacher.html`。
2. 貼上 Google Sheet 網址。可以貼一般編輯/分享網址，也可以貼發布到網路後的 CSV URL。
3. 可選擇填入課程代號，例如 `bio101`。
4. 產生學生網址與 QR code。
5. 學生用手機進入學生網址，在 `index.html` 作答。

本機測試可以使用這兩份檔案：

- `sample.csv`：答案尚未公布。
- `sample-revealed.csv`：答案已公布，正確答案為 B。

## Google Sheet 欄位格式

第一列必須是欄位名稱：

```csv
questionId,questionText,optionA,optionB,optionC,optionD,optionE,optionF,active,answerRevealed,correctAnswer
```

範例：

```csv
Q001,下列何者是粒線體主要功能？,光合作用,能量產生,儲存膽汁,合成纖維素,,,TRUE,FALSE,
```

`active` 和 `answerRevealed` 支援 `TRUE/FALSE`、`true/false`、`1/0`、`是/否`、`Y/N`、`yes/no`。

## 老師操作流程

1. 在 Google Sheet 填入題目與選項。
2. 將目前題目的 `active` 設為 `TRUE`，其他題目設為 `FALSE`。
3. 學生作答期間，將 `answerRevealed` 設為 `FALSE`。
4. 若不想讓懂技術的學生提前看到答案，公布前請讓 `correctAnswer` 保持空白。
5. 公布答案時，填入 `correctAnswer`，例如 `B`，並將 `answerRevealed` 改為 `TRUE`。
6. 請學生按「重新讀取題目」或重新整理頁面。

## 學生操作流程

1. 第一次進入時輸入姓名。
2. 選擇目前題目的答案。
3. 按「送出答案」。
4. 在答案公布前，畫面會顯示等待老師公布答案。
5. 答案公布後，重新讀取題目即可看到自己的答案、正確答案與答對/答錯。

## GitHub Pages 部署

1. 將本專案檔案上傳到 GitHub repository。
2. 進入 repository 的 Settings → Pages。
3. Source 選擇 main branch。
4. Folder 選擇 root。
5. 發布完成後，用 GitHub Pages 網址開啟 `teacher.html` 產生學生網址。

如果學生頁出現「讀到的是 Google Sheet 網頁，不是 CSV」，請確認 Google Sheet 已發布到網路，或至少已設定為知道連結者可檢視，然後回老師工具頁重新產生學生網址。

## 隱私說明

學生姓名存在 `classQuizProfile`。作答紀錄依課程代號存在 `classQuizAnswers_${classId}`，沒有課程代號時使用 `classQuizAnswers_default`。這些資料都只存在學生自己的瀏覽器。

如果學生更換手機、清除瀏覽器資料或使用無痕模式，原本的姓名與作答紀錄可能會消失。

## 常見問題

### 為什麼老師更新答案後學生還沒看到？

Google Sheet 公開 CSV 可能有快取延遲。請學生按「重新讀取題目」或稍等後再重新整理。

### 可以讓學生改答案嗎？

第一版預設每題只能作答一次。若要允許修改，可在 `script.js` 將 `allowChangeAnswer` 改為 `true`。

### 學生會不會提前看到答案？

如果 `correctAnswer` 已經寫在公開 CSV 中，懂技術的學生可能看到原始 CSV。真正避免提前洩漏答案的方法，是公布前不要把 `correctAnswer` 寫進 Sheet。
