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
  const sheetExampleTable = document.getElementById("sheetExampleTable");
  const qrCodeBox = document.getElementById("qrcode");

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

    try {
      await copyTextToClipboard(exampleText);
      copySheetExampleStatus.textContent = "已複製欄位名稱與範例題目，可直接貼到 Google Sheet。";
    } catch {
      copySheetExampleStatus.textContent = "無法自動複製，請手動選取表格內容後複製。";
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
    textarea.className = "visually-hidden";
    document.body.appendChild(textarea);
    textarea.select();

    try {
      const copied = document.execCommand("copy");
      if (!copied) throw new Error("Copy command failed.");
    } finally {
      textarea.remove();
    }
  }

  function getSheetExampleText() {
    if (!sheetExampleTable) return "";

    const rows = Array.from(sheetExampleTable.querySelectorAll("tr"));
    return rows
      .map((row) => {
        const cells = Array.from(row.querySelectorAll("th, td"));
        return cells.map((cell) => cell.textContent.trim()).join("\t");
      })
      .join("\n");
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
