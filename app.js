const FALLBACK_API_BASE_URL = "https://YOUR_CLOUD_RUN_URL";
const API_BASE_URL_STORAGE_KEY = "AI_DETECTOR_API_BASE_URL";

const imageInput = document.querySelector("#imageInput");
const fileLabel = document.querySelector("#fileLabel");
const analyzeButton = document.querySelector("#analyzeButton");
const statusText = document.querySelector("#statusText");
const errorText = document.querySelector("#errorText");
const previewPanel = document.querySelector("#previewPanel");
const imagePreview = document.querySelector("#imagePreview");
const resultPanel = document.querySelector("#resultPanel");
const advancedPanel = document.querySelector("#advancedPanel");
const verdictValue = document.querySelector("#verdictValue");
const scoreValue = document.querySelector("#scoreValue");
const confidenceValue = document.querySelector("#confidenceValue");
const explanationText = document.querySelector("#explanationText");
const disclaimerText = document.querySelector("#disclaimerText");
const moduleScores = document.querySelector("#moduleScores");
const summaryBlock = document.querySelector("#summaryBlock");
const summaryReasons = document.querySelector("#summaryReasons");
const apiBaseUrlInput = document.querySelector("#apiBaseUrlInput");
const saveApiUrlButton = document.querySelector("#saveApiUrlButton");
const activeApiUrlText = document.querySelector("#activeApiUrlText");
const loadingOverlay = document.querySelector("#loadingOverlay");
const loadingMessage = document.querySelector("#loadingMessage");
const progressFill = document.querySelector("#progressFill");
const progressPercent = document.querySelector("#progressPercent");

let selectedFile = null;
let previewUrl = null;
let apiBaseUrl = getApiBaseUrl();
let progressTimer = null;
let progressValue = 0;

const PROGRESS_MESSAGES = [
  { min: 0, text: "Uploading image..." },
  { min: 25, text: "Analyzing image structure..." },
  { min: 55, text: "Checking edge and boundary signals..." },
  { min: 82, text: "Finalizing result..." },
];

const REASON_LABELS = {
  boundary: "unusual boundary behavior",
  patch_consistency: "locally consistent synthetic-looking structure",
  patch_repetition: "repeated fine texture patterns",
  edge: "unusual edge behavior",
  noise_rgb: "synthetic-looking noise patterns",
  frequency: "unusual frequency-domain patterns",
  texture: "unusual texture behavior",
  jpeg: "compression artifacts",
  metadata: "missing or unusual camera metadata",
};

const STRUCTURAL_MODULES = [
  "boundary",
  "patch_consistency",
  "patch_repetition",
  "edge",
  "noise_rgb",
  "frequency",
  "texture",
  "jpeg",
];

function getConfiguredApiBaseUrl() {
  return window.APP_CONFIG?.API_BASE_URL?.trim() || "";
}

function getStoredApiBaseUrl() {
  return localStorage.getItem(API_BASE_URL_STORAGE_KEY)?.trim() || "";
}

function getApiBaseUrl() {
  return getConfiguredApiBaseUrl() || getStoredApiBaseUrl() || FALLBACK_API_BASE_URL;
}

function normalizeApiBaseUrl(url) {
  return url.trim().replace(/\/+$/, "");
}

function updateApiSettingsDisplay() {
  apiBaseUrlInput.value = apiBaseUrl;
  activeApiUrlText.textContent = `Active API URL: ${apiBaseUrl}`;
}

function getProgressMessage(value) {
  return PROGRESS_MESSAGES.reduce((currentMessage, stage) => {
    if (value >= stage.min) {
      return stage.text;
    }

    return currentMessage;
  }, PROGRESS_MESSAGES[0].text);
}

function updateProgress(value) {
  progressValue = Math.max(0, Math.min(100, value));
  const roundedValue = Math.round(progressValue);
  progressFill.style.width = `${roundedValue}%`;
  progressPercent.textContent = `${roundedValue}%`;
  loadingMessage.textContent = getProgressMessage(progressValue);
}

function showLoadingOverlay() {
  loadingOverlay.classList.remove("is-hidden");
  updateProgress(5);

  progressTimer = window.setInterval(() => {
    const remaining = 90 - progressValue;
    const step = Math.max(0.4, remaining * 0.08);
    updateProgress(Math.min(90, progressValue + step));
  }, 450);
}

function hideLoadingOverlay() {
  if (progressTimer) {
    window.clearInterval(progressTimer);
    progressTimer = null;
  }

  loadingOverlay.classList.add("is-hidden");
  updateProgress(0);
}

function completeLoadingOverlay() {
  if (progressTimer) {
    window.clearInterval(progressTimer);
    progressTimer = null;
  }

  updateProgress(100);

  return new Promise((resolve) => {
    window.setTimeout(() => {
      hideLoadingOverlay();
      resolve();
    }, 350);
  });
}

function setLoading(isLoading) {
  imageInput.disabled = isLoading;
  analyzeButton.disabled = isLoading || !selectedFile;
  analyzeButton.textContent = isLoading ? "Analyzing..." : "Analyze";
  statusText.textContent = isLoading ? "Analyzing..." : "";
}

function showError(message) {
  errorText.textContent = message;
}

function clearResult() {
  resultPanel.classList.add("is-hidden");
  advancedPanel.classList.add("is-hidden");
  verdictValue.textContent = "";
  scoreValue.textContent = "";
  confidenceValue.textContent = "";
  explanationText.textContent = "";
  disclaimerText.textContent = "";
  moduleScores.replaceChildren();
  summaryReasons.replaceChildren();
  summaryBlock.classList.add("is-hidden");
}

function formatScore(value) {
  if (typeof value !== "number") {
    return String(value ?? "Unavailable");
  }

  return value.toFixed(4);
}

function renderModuleScores(scores) {
  moduleScores.replaceChildren();

  Object.entries(scores || {}).forEach(([name, value]) => {
    const row = document.createElement("div");
    const label = document.createElement("dt");
    const score = document.createElement("dd");

    label.textContent = name.replaceAll("_", " ");
    score.textContent = formatScore(value);

    row.append(label, score);
    moduleScores.append(row);
  });
}

function renderSummaryReasons(reasons) {
  summaryReasons.replaceChildren();

  if (!Array.isArray(reasons) || reasons.length === 0) {
    summaryBlock.classList.add("is-hidden");
    return;
  }

  reasons.forEach((reason) => {
    const item = document.createElement("li");
    item.textContent = reason;
    summaryReasons.append(item);
  });

  summaryBlock.classList.remove("is-hidden");
}

function parseReason(reason) {
  const separatorIndex = reason.indexOf(":");
  if (separatorIndex === -1) {
    return {
      moduleName: "",
      detail: reason.trim(),
    };
  }

  return {
    moduleName: reason.slice(0, separatorIndex).trim(),
    detail: reason.slice(separatorIndex + 1).trim(),
  };
}

function readableReason(parsedReason) {
  const moduleLabel = REASON_LABELS[parsedReason.moduleName];
  if (moduleLabel) {
    return moduleLabel;
  }

  return parsedReason.detail.toLowerCase().replace(/\.$/, "");
}

function buildUserExplanation(result) {
  const reasons = Array.isArray(result.summary_reasons) ? result.summary_reasons : [];
  const parsedReasons = reasons.map(parseReason).filter((reason) => reason.detail);
  const structuralReasons = parsedReasons.filter((reason) => STRUCTURAL_MODULES.includes(reason.moduleName));
  const preferredReasons = structuralReasons.length > 0
    ? structuralReasons
    : parsedReasons.filter((reason) => reason.moduleName === "metadata");
  const readableReasons = [...new Set(preferredReasons.map(readableReason))].slice(0, 2);

  if (readableReasons.length === 0) {
    return result.explanation || "The result is based on combined forensic image signals.";
  }

  if (readableReasons.length === 1) {
    return `The estimate is mainly based on ${readableReasons[0]}.`;
  }

  return `The estimate is mainly based on ${readableReasons[0]} and ${readableReasons[1]}.`;
}

function renderResult(result) {
  verdictValue.textContent = result.verdict ?? "Unavailable";
  scoreValue.textContent = formatScore(result.final_score);
  confidenceValue.textContent = result.confidence ?? "Unavailable";
  explanationText.textContent = buildUserExplanation(result);
  disclaimerText.textContent = result.disclaimer ?? "This is a forensic estimate, not absolute proof.";

  renderModuleScores(result.module_scores);
  renderSummaryReasons(result.summary_reasons);

  resultPanel.classList.remove("is-hidden");
  advancedPanel.classList.remove("is-hidden");
}

async function analyzeSelectedImage() {
  if (!selectedFile) {
    return;
  }

  clearResult();
  showError("");
  setLoading(true);
  showLoadingOverlay();

  const formData = new FormData();
  formData.append("file", selectedFile);

  try {
    const activeApiBaseUrl = normalizeApiBaseUrl(apiBaseUrl);
    const response = await fetch(`${activeApiBaseUrl}/analyze`, {
      method: "POST",
      body: formData,
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      const detail = payload?.detail || "Analysis failed. Please try another image.";
      throw new Error(detail);
    }

    await completeLoadingOverlay();
    renderResult(payload);
  } catch (error) {
    hideLoadingOverlay();
    showError(error.message || "Analysis failed. Please check the API URL and try again.");
  } finally {
    setLoading(false);
  }
}

imageInput.addEventListener("change", () => {
  selectedFile = imageInput.files?.[0] || null;
  clearResult();
  showError("");
  statusText.textContent = "";

  if (previewUrl) {
    URL.revokeObjectURL(previewUrl);
    previewUrl = null;
  }

  if (!selectedFile) {
    fileLabel.textContent = "Select an image";
    previewPanel.classList.add("is-hidden");
    imagePreview.removeAttribute("src");
    analyzeButton.disabled = true;
    return;
  }

  fileLabel.textContent = selectedFile.name;
  previewUrl = URL.createObjectURL(selectedFile);
  imagePreview.src = previewUrl;
  previewPanel.classList.remove("is-hidden");
  analyzeButton.disabled = false;
});

saveApiUrlButton.addEventListener("click", () => {
  const nextApiBaseUrl = normalizeApiBaseUrl(apiBaseUrlInput.value);

  if (!nextApiBaseUrl) {
    localStorage.removeItem(API_BASE_URL_STORAGE_KEY);
    apiBaseUrl = getConfiguredApiBaseUrl() || FALLBACK_API_BASE_URL;
  } else {
    localStorage.setItem(API_BASE_URL_STORAGE_KEY, nextApiBaseUrl);
    apiBaseUrl = nextApiBaseUrl;
  }

  updateApiSettingsDisplay();
  showError("");
  statusText.textContent = "API URL saved for this browser.";
});

analyzeButton.addEventListener("click", analyzeSelectedImage);
updateApiSettingsDisplay();
