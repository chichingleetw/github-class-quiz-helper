(function () {
  "use strict";

  const form = document.getElementById("teacherForm");
  const sheetUrlInput = document.getElementById("sheetUrlInput");
  const classIdInput = document.getElementById("classIdInput");
  const generatedArea = document.getElementById("generatedArea");
  const studentUrlOutput = document.getElementById("studentUrlOutput");
  const copyUrlButton = document.getElementById("copyUrlButton");
  const copyStatus = document.getElementById("copyStatus");
  const copySheetExampleButton = document.getElementById("copySheetExampleButton");
  const copySheetExampleStatus = document.getElementById("copySheetExampleStatus");
  const sheetExampleCopyText = document.getElementById("sheetExampleCopyText");
  const qrCodeBox = document.getElementById("qrcode");
  const sheetExampleRows = [
    ["題目ID", "題目", "選項A", "選項B", "選項C", "選項D", "開放作答", "公布答案", "正確答案"],
    ["Q001", "粒線體主要功能？", "製造能量", "儲存膽汁", "合成纖維素", "運輸氧氣", "T", "F", ""],
    ["Q002", "蛋白質基本單位？", "葡萄糖", "胺基酸", "脂肪酸", "核苷酸", "T", "F", ""]
  ];

  let qrCode = null;

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    const sheetUrl = sheetUrlInput.value.trim();
    const classId = classIdInput.value.trim();

    if (!sheetUrl) {
      sheetUrlInput.focus();
      return;
    }

    const studentUrl = buildStudentUrl(sheetUrl, classId);
    studentUrlOutput.value = studentUrl;
    generatedArea.classList.remove("hidden");
    copyStatus.textContent = "";
    renderQrCode(studentUrl);
  });

  copyUrlButton.addEventListener("click", async function () {
    if (!studentUrlOutput.value) return;

    try {
      await copyTextToClipboard(studentUrlOutput.value);
      copyStatus.textContent = "已複製學生網址。";
    } catch {
      studentUrlOutput.focus();
      studentUrlOutput.select();
      copyStatus.textContent = "請手動複製上方網址。";
    }
  });

  copySheetExampleButton.addEventListener("click", async function () {
    const exampleText = getSheetExampleText();
    if (!exampleText) return;

    sheetExampleCopyText.value = exampleText;
    sheetExampleCopyText.classList.add("hidden");

    try {
      await copyTextToClipboard(exampleText);
      copySheetExampleStatus.textContent = "已複製欄位名稱與範例題目，可直接貼到 Google Sheet。";
    } catch {
      sheetExampleCopyText.classList.remove("hidden");
      sheetExampleCopyText.focus();
      sheetExampleCopyText.select();
      try {
        const copied = document.execCommand("copy");
        copySheetExampleStatus.textContent = copied
          ? "已複製欄位名稱與範例題目，可直接貼到 Google Sheet。"
          : "瀏覽器阻擋自動複製，已選取下方內容，請按 Cmd/Ctrl + C 複製。";
      } catch {
        copySheetExampleStatus.textContent = "瀏覽器阻擋自動複製，已選取下方內容，請按 Cmd/Ctrl + C 複製。";
      }
    }
  });

  async function copyTextToClipboard(text) {
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return;
      } catch {
        // Fall through to the textarea fallback for browsers that block Clipboard API.
      }
    }

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.top = "0";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);

    try {
      const copied = document.execCommand("copy");
      if (!copied) throw new Error("Copy command failed.");
    } finally {
      textarea.remove();
    }
  }

  function getSheetExampleText() {
    return sheetExampleRows.map((row) => row.join("\t")).join("\n");
  }

  function buildStudentUrl(sheetUrl, classId) {
    const url = new URL("index.html", window.location.href);
    url.searchParams.set("sheetUrl", normalizeSheetUrl(sheetUrl));
    if (classId) url.searchParams.set("classId", classId);
    return url.toString();
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

  function renderQrCode(text) {
    qrCodeBox.innerHTML = "";
    qrCode = new QRCode(qrCodeBox, {
      text,
      width: 224,
      height: 224,
      colorDark: "#172026",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.M
    });
  }

  window.teacherQuizUtils = {
    buildStudentUrl,
    getSheetExampleText,
    normalizeSheetUrl
  };
})();
