(function () {
  "use strict";

  const allowChangeAnswer = false;
  const optionKeys = ["A", "B", "C", "D", "E", "F"];
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
    questionLabel: document.getElementById("questionLabel"),
    questionTitle: document.getElementById("questionTitle"),
    questionText: document.getElementById("questionText"),
    optionsGrid: document.getElementById("optionsGrid"),
    submitAnswerButton: document.getElementById("submitAnswerButton"),
    answerStatus: document.getElementById("answerStatus"),
    noticeBox: document.getElementById("noticeBox"),
    reloadButton: document.getElementById("reloadButton"),
    clearAnswersButton: document.getElementById("clearAnswersButton")
  };

  const params = new URLSearchParams(window.location.search);
  const sheetUrl = params.get("sheetUrl") || "";
  const classId = sanitizeKey(params.get("classId") || "default");
  const answersKey = `classQuizAnswers_${classId}`;

  let activeQuestion = null;
  let selectedAnswer = "";
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

    els.submitAnswerButton.addEventListener("click", function () {
      if (!activeQuestion || !selectedAnswer) return;
      const profile = getProfile();
      if (!profile.studentName) {
        setProfileMessage("請先輸入姓名。");
        els.studentNameInput.focus();
        return;
      }

      const existingAnswer = getSavedAnswer(activeQuestion.questionId);
      if (existingAnswer && !allowChangeAnswer) {
        renderCurrentState();
        return;
      }

      answersStore.answers[activeQuestion.questionId] = {
        answer: selectedAnswer,
        answeredAt: new Date().toISOString()
      };
      saveAnswers();
      renderCurrentState();
    });

    els.clearAnswersButton.addEventListener("click", function () {
      const confirmed = window.confirm("確定要清除這個課程存在本機的作答紀錄嗎？");
      if (!confirmed) return;
      answersStore = { answers: {} };
      saveAnswers();
      selectedAnswer = "";
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
      const activeQuestions = questions.filter((question) => question.active);

      if (activeQuestions.length === 0) {
        activeQuestion = null;
        selectedAnswer = "";
        els.questionTitle.textContent = "目前尚未開放題目";
        els.questionText.textContent = "目前尚未開放題目，請等待老師。";
        setStatus("目前尚未開放題目，請等待老師。", "warning");
        return;
      }

      activeQuestion = activeQuestions[0];
      selectedAnswer = getSavedAnswer(activeQuestion.questionId)?.answer || "";

      if (activeQuestions.length > 1) {
        showNotice(`偵測到 ${activeQuestions.length} 題 active = TRUE，目前只顯示第一題。`);
      } else {
        hideNotice();
      }

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
    return response.text();
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

    const headers = nonEmptyRows[0].map((header) => header.trim());
    const missingColumns = requiredColumns.filter((column) => !headers.includes(column));
    if (missingColumns.length > 0) {
      throw new Error(`CSV 欄位格式錯誤，缺少：${missingColumns.join(", ")}`);
    }

    return nonEmptyRows.slice(1).map((cells) => {
      return headers.reduce((record, header, index) => {
        record[header] = (cells[index] || "").trim();
        return record;
      }, {});
    });
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
    return ["true", "1", "是", "y", "yes"].includes(normalized);
  }

  function renderCurrentState() {
    if (!activeQuestion) return;

    els.questionLabel.textContent = `目前題目：${activeQuestion.questionId}`;
    els.questionTitle.textContent = activeQuestion.questionId;
    els.questionText.textContent = activeQuestion.questionText;

    if (activeQuestion.options.length === 0) {
      els.optionsGrid.innerHTML = "";
      els.submitAnswerButton.disabled = true;
      setStatus("active 題目沒有可顯示的選項。", "error");
      return;
    }

    renderOptions();
    renderAnswerStatus();
  }

  function renderOptions() {
    const savedAnswer = getSavedAnswer(activeQuestion.questionId);
    const locked = Boolean(savedAnswer) && !allowChangeAnswer;

    els.optionsGrid.innerHTML = "";
    activeQuestion.options.forEach((option) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "option-button";
      button.setAttribute("aria-pressed", selectedAnswer === option.key ? "true" : "false");
      button.disabled = locked;
      button.innerHTML = `<span class="option-key">${escapeHtml(option.key)}</span><span>${escapeHtml(option.text)}</span>`;
      button.addEventListener("click", function () {
        selectedAnswer = option.key;
        renderCurrentState();
      });
      els.optionsGrid.appendChild(button);
    });

    els.submitAnswerButton.disabled = locked || !selectedAnswer;
    els.submitAnswerButton.textContent = locked ? "已送出答案" : "送出答案";
  }

  function renderAnswerStatus() {
    const savedAnswer = getSavedAnswer(activeQuestion.questionId);
    const correctAnswer = activeQuestion.correctAnswer;

    if (activeQuestion.answerRevealed && !correctAnswer) {
      setStatus("answerRevealed 為 TRUE，但 correctAnswer 是空白。請老師確認 Google Sheet。", "error");
      return;
    }

    if (!savedAnswer) {
      if (activeQuestion.answerRevealed) {
        setStatus(`本題答案已公布。\n你尚未作答。\n正確答案：${correctAnswer}`, "warning");
      } else {
        setStatus(selectedAnswer ? `已選擇：${selectedAnswer}\n按下送出後才會儲存在本機。` : "請選擇一個答案。", "info");
      }
      return;
    }

    if (!activeQuestion.answerRevealed) {
      setStatus(`你已作答：${savedAnswer.answer}\n等待老師公布答案。`, "warning");
      return;
    }

    const isCorrect = savedAnswer.answer === correctAnswer;
    setStatus(
      `你已作答：${savedAnswer.answer}\n正確答案：${correctAnswer}\n結果：${isCorrect ? "答對" : "答錯"}`,
      isCorrect ? "success" : "error"
    );
  }

  function resetQuizUi(message) {
    activeQuestion = null;
    selectedAnswer = "";
    els.questionLabel.textContent = "目前題目";
    els.questionTitle.textContent = message;
    els.questionText.textContent = "";
    els.optionsGrid.innerHTML = "";
    els.submitAnswerButton.disabled = true;
    els.submitAnswerButton.textContent = "送出答案";
    hideNotice();
    setStatus("題目讀取中。", "info");
  }

  function showError(message) {
    els.questionTitle.textContent = "無法載入題目";
    els.questionText.textContent = "";
    els.optionsGrid.innerHTML = "";
    els.submitAnswerButton.disabled = true;
    setStatus(message, "error");
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
    els.answerStatus.textContent = message;
    els.answerStatus.className = "status-box";
    if (type === "success") els.answerStatus.classList.add("status-success");
    if (type === "error") els.answerStatus.classList.add("status-error");
    if (type === "warning") els.answerStatus.classList.add("status-warning");
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
    normalizeQuestions
  };
})();
