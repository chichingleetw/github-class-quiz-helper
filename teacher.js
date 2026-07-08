(function () {
  "use strict";

  const form = document.getElementById("teacherForm");
  const sheetUrlInput = document.getElementById("sheetUrlInput");
  const classIdInput = document.getElementById("classIdInput");
  const generatedArea = document.getElementById("generatedArea");
  const studentUrlOutput = document.getElementById("studentUrlOutput");
  const copyUrlButton = document.getElementById("copyUrlButton");
  const copyStatus = document.getElementById("copyStatus");
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
      await navigator.clipboard.writeText(studentUrlOutput.value);
      copyStatus.textContent = "已複製學生網址。";
    } catch {
      studentUrlOutput.focus();
      studentUrlOutput.select();
      copyStatus.textContent = "請手動複製上方網址。";
    }
  });

  function buildStudentUrl(sheetUrl, classId) {
    const url = new URL("index.html", window.location.href);
    url.searchParams.set("sheetUrl", sheetUrl);
    if (classId) url.searchParams.set("classId", classId);
    return url.toString();
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
    buildStudentUrl
  };
})();
