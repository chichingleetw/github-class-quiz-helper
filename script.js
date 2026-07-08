(function () {
  "use strict";

  const allowChangeAnswer = false;
  const optionKeys = ["A", "B", "C", "D", "E", "F"];
  const columnAliases = {
    questionId: ["題目ID", "題目編號", "questionId"],
    questionText: ["題目", "題目文字", "questionText"],
    optionA: ["選項A", "optionA"],
    optionB: ["選項B", "optionB"],
    optionC: ["選項C", "optionC"],
    optionD: ["選項D", "optionD"],
    optionE: ["選項E", "optionE"],
    optionF: ["選項F", "optionF"],
    active: ["開放作答", "active"],
    answerRevealed: ["公布答案", "答案公布", "answerRevealed"],
    correctAnswer: ["正確答案", "correctAnswer"]
  };
  const columnLabels = {
    questionId: "題目ID",
    questionText: "題目",
    optionA: "選項A",
    optionB: "選項B",
    active: "開放作答",
    answerRevealed: "公布答案"
  };
  const requiredColumns = [
    "questionId",
    "questionText",
    "optionA",
    "optionB",
    "active",
    "answerRevealed"
  ];

  const els = {
    profileForm: document.getElementById("profileForm"),
    studentNameInput: document.getElementById("studentNameInput"),
    editNameButton: document.getElementById("editNameButton"),
    profileStatus: document.getElementById("profileStatus"),
    quizTitle: document.getElementById("quizTitle"),
    quizStatus: document.getElementById("quizStatus"),
    questionsList: document.getElementById("questionsList"),
    noticeBox: document.getElementById("noticeBox"),
    reloadButton: document.getElementById("reloadButton"),
    submitAnswersButton: document.getElementById("submitAnswersButton"),
    refreshPageButton: document.getElementById("refreshPageButton"),
    clearAnswersButton: document.getElementById("clearAnswersButton")
  };

  const params = new URLSearchParams(window.location.search);
  const sheetUrl = normalizeSheetUrl(params.get("sheetUrl") || "");
  const classId = sanitizeKey(params.get("classId") || "default");
  const answersKey = `classQuizAnswers_${classId}`;

  let activeQuestions = [];
  let selectedAnswers = {};
  let answersStore = loadAnswers();

  init();

  function init() {
    loadProfile();
    bindEvents();
    loadQuiz();
  }

  function bindEvents() {
    els.profileForm.addEventListener("submit", function (event) {
      event.preventDefault();
      saveProfile();
      renderCurrentState();
    });

    els.editNameButton.addEventListener("click", function () {
      els.studentNameInput.focus();
      els.studentNameInput.select();
    });

    els.reloadButton.addEventListener("click", loadQuiz);

    els.questionsList.addEventListener("click", function (event) {
      const optionButton = event.target.closest("[data-option-key]");

      if (optionButton) {
        const questionId = optionButton.dataset.questionId;
        selectedAnswers[questionId] = optionButton.dataset.optionKey;
        renderCurrentState();
      }
    });

    els.submitAnswersButton.addEventListener("click", submitSelectedAnswers);

    els.refreshPageButton.addEventListener("click", function () {
      window.location.reload();
    });

    els.clearAnswersButton.addEventListener("click", function () {
      const confirmed = window.confirm("確定要清除這個課程存在本機的作答紀錄嗎？");
      if (!confirmed) return;
      answersStore = { answers: {} };
      selectedAnswers = {};
      saveAnswers();
      renderCurrentState();
    });
  }

  async function loadQuiz() {
    resetQuizUi("讀取中...");

    if (!sheetUrl) {
      showError("沒有提供 sheetUrl。請向老師取得正確的學生網址，或使用老師工具頁產生 QR code。");
      return;
    }

    try {
      const csvText = await fetchSheetCsv(sheetUrl);
      const rows = parseCsv(csvText);
      const questions = normalizeQuestions(rows);
      activeQuestions = questions.filter((question) => question.active);

      if (activeQuestions.length === 0) {
        selectedAnswers = {};
        els.quizTitle.textContent = "目前尚未開放題目";
        els.questionsList.innerHTML = "";
        updateSubmitButton();
        setStatus("目前尚未開放題目，請等待老師。", "warning");
        return;
      }

      selectedAnswers = activeQuestions.reduce((result, question) => {
        const savedAnswer = getSavedAnswer(question.questionId);
        result[question.questionId] = savedAnswer?.answer || "";
        return result;
      }, {});

      hideNotice();
      renderCurrentState();
    } catch (error) {
      showError(error.message || "讀取題目時發生錯誤。");
    }
  }

  async function fetchSheetCsv(url) {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      throw new Error("無法讀取 Google Sheet CSV，請確認 CSV 連結已發布到網路。");
    }
    const text = await response.text();
    if (/^\s*<!doctype html/i.test(text) || /^\s*<html[\s>]/i.test(text)) {
      throw new Error("讀到的是 Google Sheet 網頁，不是 CSV。請在老師工具頁貼上 Google Sheet 網址後重新產生學生網址，或使用「發布到網路」的 CSV 連結。");
    }
    return text;
  }

  function parseCsv(text) {
    const rows = [];
    let row = [];
    let field = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i += 1) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (inQuotes) {
        if (char === '"' && nextChar === '"') {
          field += '"';
          i += 1;
        } else if (char === '"') {
          inQuotes = false;
        } else {
          field += char;
        }
        continue;
      }

      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        row.push(field);
        field = "";
      } else if (char === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else if (char !== "\r") {
        field += char;
      }
    }

    row.push(field);
    rows.push(row);

    const nonEmptyRows = rows.filter((item) => item.some((cell) => cell.trim() !== ""));
    if (nonEmptyRows.length === 0) {
      throw new Error("CSV 沒有資料。");
    }

    const rawHeaders = nonEmptyRows[0].map((header, index) => {
      const trimmed = header.trim();
      return index === 0 ? trimmed.replace(/^\uFEFF/, "") : trimmed;
    });
    const headers = rawHeaders.map(normalizeColumnHeader);
    const missingColumns = requiredColumns.filter((column) => !headers.includes(column));
    if (missingColumns.length > 0) {
      const missingLabels = missingColumns.map((column) => columnLabels[column] || column);
      const detectedHeaders = rawHeaders.filter(Boolean).slice(0, 6).join(", ") || "沒有偵測到欄位";
      throw new Error(`CSV 欄位格式錯誤，缺少：${missingLabels.join(", ")}。目前偵測到的第一列是：${detectedHeaders}`);
    }

    return nonEmptyRows.slice(1).map((cells) => {
      return headers.reduce((record, header, index) => {
        record[header] = (cells[index] || "").trim();
        return record;
      }, {});
    });
  }

  function normalizeColumnHeader(header) {
    const normalized = String(header || "").trim();
    const canonicalColumn = Object.keys(columnAliases).find((column) => {
      return columnAliases[column].includes(normalized);
    });
    return canonicalColumn || normalized;
  }

  function normalizeQuestions(rows) {
    return rows.map((row) => {
      const options = optionKeys
        .map((key) => ({
          key,
          text: row[`option${key}`] || ""
        }))
        .filter((option) => option.text.trim() !== "");

      return {
        questionId: row.questionId,
        questionText: row.questionText,
        options,
        active: parseBoolean(row.active),
        answerRevealed: parseBoolean(row.answerRevealed),
        correctAnswer: (row.correctAnswer || "").trim().toUpperCase()
      };
    });
  }

  function parseBoolean(value) {
    const normalized = String(value || "").trim().toLowerCase();
    return ["true", "t", "1", "是", "y", "yes"].includes(normalized);
  }

  function normalizeSheetUrl(value) {
    const rawUrl = String(value || "").trim();
    if (!rawUrl) return "";

    try {
      const url = new URL(rawUrl);
      if (url.hostname !== "docs.google.com") return rawUrl;
      if (!url.pathname.includes("/spreadsheets/d/")) return rawUrl;
      if (url.searchParams.get("output") === "csv") return rawUrl;

      const gid = url.searchParams.get("gid") || extractGidFromHash(url.hash);
      const pathParts = url.pathname.split("/").filter(Boolean);
      const documentId = pathParts[pathParts.indexOf("d") + 1];
      if (!documentId) return rawUrl;

      if (url.pathname.includes("/pubhtml")) {
        url.pathname = url.pathname.replace("/pubhtml", "/pub");
        url.search = "";
        url.hash = "";
        url.searchParams.set("output", "csv");
        if (gid) url.searchParams.set("gid", gid);
        return url.toString();
      }

      url.pathname = `/spreadsheets/d/${documentId}/export`;
      url.search = "";
      url.hash = "";
      url.searchParams.set("format", "csv");
      if (gid) url.searchParams.set("gid", gid);
      return url.toString();
    } catch {
      return rawUrl;
    }
  }

  function extractGidFromHash(hash) {
    const match = String(hash || "").match(/gid=(\d+)/);
    return match ? match[1] : "";
  }

  function submitSelectedAnswers() {
    const profile = getProfile();
    if (!profile.studentName) {
      setProfileMessage("請先輸入姓名。");
      els.studentNameInput.focus();
      return;
    }

    const unansweredQuestions = getUnansweredQuestions();
    const allUnansweredSelected = unansweredQuestions.every((question) => selectedAnswers[question.questionId]);
    if (unansweredQuestions.length === 0 || !allUnansweredSelected) {
      renderCurrentState();
      return;
    }

    const answeredAt = new Date().toISOString();
    unansweredQuestions.forEach((question) => {
      answersStore.answers[question.questionId] = {
        answer: selectedAnswers[question.questionId],
        answeredAt
      };
    });
    saveAnswers();
    renderCurrentState();
  }

  function renderCurrentState() {
    if (activeQuestions.length === 0) return;

    els.quizTitle.textContent = `已開放 ${activeQuestions.length} 題`;
    renderQuizSummary();
    els.questionsList.innerHTML = "";

    activeQuestions.forEach((question, index) => {
      els.questionsList.appendChild(renderQuestionCard(question, index));
    });
    updateSubmitButton();
  }

  function renderQuizSummary() {
    const invalidRevealedQuestion = activeQuestions.find((question) => question.answerRevealed && !question.correctAnswer);
    if (invalidRevealedQuestion) {
      setStatus(`題目 ${invalidRevealedQuestion.questionId} 已公布答案，但「正確答案」是空白。請老師確認 Google Sheet。`, "error");
      return;
    }

    const allAnswersRevealed = activeQuestions.every((question) => question.answerRevealed && question.correctAnswer);
    if (!allAnswersRevealed) {
      const answeredCount = activeQuestions.filter((question) => getSavedAnswer(question.questionId)).length;
      const selectedCount = getUnansweredQuestions().filter((question) => selectedAnswers[question.questionId]).length;
      const remainingCount = getUnansweredQuestions().length;
      if (remainingCount === 0) {
        setStatus(`已全部送出。\n等待老師公布答案。\n已送出：${answeredCount} / ${activeQuestions.length} 題`, "info");
        return;
      }
      setStatus(`請選擇答案後，按最下方「送出答案」。\n已送出：${answeredCount} / ${activeQuestions.length} 題\n尚未送出已選擇：${selectedCount} / ${remainingCount} 題`, "info");
      return;
    }

    const correctCount = activeQuestions.filter((question) => {
      const savedAnswer = getSavedAnswer(question.questionId);
      return savedAnswer && savedAnswer.answer === question.correctAnswer;
    }).length;

    setStatus(`答案已公布。\n答對：${correctCount} / ${activeQuestions.length} 題`, "success");
  }

  function renderQuestionCard(question, index) {
    const card = document.createElement("article");
    card.className = "question-card";
    card.dataset.questionId = question.questionId;

    const savedAnswer = getSavedAnswer(question.questionId);
    const locked = Boolean(savedAnswer) && !allowChangeAnswer;
    const selectedAnswer = selectedAnswers[question.questionId] || "";

    const optionsHtml = question.options
      .map((option) => {
        const pressed = selectedAnswer === option.key ? "true" : "false";
        const disabled = locked ? " disabled" : "";
        return `
          <button class="option-button" type="button" data-question-id="${escapeHtml(question.questionId)}" data-option-key="${escapeHtml(option.key)}" aria-pressed="${pressed}"${disabled}>
            <span class="option-key">${escapeHtml(option.key)}</span>
            <span>${escapeHtml(option.text)}</span>
          </button>
        `;
      })
      .join("");

    card.innerHTML = `
      <p class="eyebrow">第 ${index + 1} 題：${escapeHtml(question.questionId)}</p>
      <div class="question-text">${escapeHtml(question.questionText)}</div>
      <div class="options-grid">${optionsHtml}</div>
      <div class="status-box ${getStatusClass(question)}">${escapeHtml(getQuestionStatus(question))}</div>
    `;

    return card;
  }

  function getQuestionStatus(question) {
    const savedAnswer = getSavedAnswer(question.questionId);
    const selectedAnswer = selectedAnswers[question.questionId] || "";
    const correctAnswer = question.correctAnswer;

    if (question.options.length === 0) {
      return "開放作答的題目沒有可顯示的選項。";
    }

    if (question.answerRevealed && !correctAnswer) {
      return "「公布答案」為 T，但「正確答案」是空白。請老師確認 Google Sheet。";
    }

    if (!savedAnswer) {
      if (question.answerRevealed) {
        return `本題答案已公布。\n你尚未作答。\n正確答案：${correctAnswer}`;
      }
      return selectedAnswer ? `已選擇：${selectedAnswer}\n按最下方「送出答案」後才會儲存在本機。` : "請選擇一個答案。";
    }

    if (!question.answerRevealed) {
      return `你已作答：${savedAnswer.answer}\n等待老師公布答案。`;
    }

    const isCorrect = savedAnswer.answer === correctAnswer;
    return `你已作答：${savedAnswer.answer}\n正確答案：${correctAnswer}\n結果：${isCorrect ? "答對" : "答錯"}`;
  }

  function getStatusClass(question) {
    const savedAnswer = getSavedAnswer(question.questionId);
    if (question.options.length === 0) return "status-error";
    if (question.answerRevealed && !question.correctAnswer) return "status-error";
    if (!savedAnswer && question.answerRevealed) return "status-warning";
    if (!savedAnswer) return "";
    if (!question.answerRevealed) return "status-warning";
    return savedAnswer.answer === question.correctAnswer ? "status-success" : "status-error";
  }

  function resetQuizUi(message) {
    activeQuestions = [];
    selectedAnswers = {};
    els.quizTitle.textContent = message;
    els.questionsList.innerHTML = "";
    updateSubmitButton();
    hideNotice();
    setStatus("題目讀取中。", "info");
  }

  function showError(message) {
    els.quizTitle.textContent = "無法載入題目";
    els.questionsList.innerHTML = "";
    updateSubmitButton();
    setStatus(message, "error");
  }

  function getUnansweredQuestions() {
    return activeQuestions.filter((question) => {
      const savedAnswer = getSavedAnswer(question.questionId);
      return question.options.length > 0 && (!savedAnswer || allowChangeAnswer);
    });
  }

  function updateSubmitButton() {
    if (activeQuestions.length === 0) {
      els.submitAnswersButton.disabled = true;
      els.submitAnswersButton.textContent = "送出答案";
      return;
    }

    const unansweredQuestions = getUnansweredQuestions();
    const allUnansweredSelected = unansweredQuestions.every((question) => selectedAnswers[question.questionId]);
    const shouldEnable = unansweredQuestions.length > 0 && allUnansweredSelected;
    els.submitAnswersButton.disabled = !shouldEnable;
    els.submitAnswersButton.textContent = unansweredQuestions.length === 0 ? "已送出答案" : "送出答案";
  }

  function showNotice(message) {
    els.noticeBox.textContent = message;
    els.noticeBox.classList.remove("hidden");
  }

  function hideNotice() {
    els.noticeBox.textContent = "";
    els.noticeBox.classList.add("hidden");
  }

  function setStatus(message, type) {
    els.quizStatus.textContent = message;
    els.quizStatus.className = "status-box";
    if (type === "success") els.quizStatus.classList.add("status-success");
    if (type === "error") els.quizStatus.classList.add("status-error");
    if (type === "warning") els.quizStatus.classList.add("status-warning");
  }

  function loadProfile() {
    const profile = getProfile();
    els.studentNameInput.value = profile.studentName || "";
    setProfileMessage(profile.studentName ? `目前姓名：${profile.studentName}` : "請先輸入姓名。");
  }

  function getProfile() {
    try {
      return JSON.parse(localStorage.getItem("classQuizProfile")) || {};
    } catch {
      return {};
    }
  }

  function saveProfile() {
    const studentName = els.studentNameInput.value.trim();
    if (!studentName) {
      setProfileMessage("姓名不可空白。");
      return;
    }
    localStorage.setItem("classQuizProfile", JSON.stringify({ studentName }));
    setProfileMessage(`目前姓名：${studentName}`);
  }

  function setProfileMessage(message) {
    els.profileStatus.textContent = message;
  }

  function loadAnswers() {
    try {
      const parsed = JSON.parse(localStorage.getItem(answersKey));
      if (parsed && parsed.answers) return parsed;
    } catch {
      return { answers: {} };
    }
    return { answers: {} };
  }

  function saveAnswers() {
    localStorage.setItem(answersKey, JSON.stringify(answersStore));
  }

  function getSavedAnswer(questionId) {
    return answersStore.answers[questionId] || null;
  }

  function sanitizeKey(value) {
    return String(value || "default").trim().replace(/[^\w-]/g, "_") || "default";
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  window.classQuizUtils = {
    parseCsv,
    parseBoolean,
    normalizeSheetUrl,
    normalizeQuestions
  };
})();
