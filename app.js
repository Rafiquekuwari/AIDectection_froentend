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

let selectedFile = null;
let previewUrl = null;
let apiBaseUrl = getApiBaseUrl();

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

function renderResult(result) {
  verdictValue.textContent = result.verdict ?? "Unavailable";
  scoreValue.textContent = formatScore(result.final_score);
  confidenceValue.textContent = result.confidence ?? "Unavailable";
  explanationText.textContent = result.explanation ?? "The result is based on combined forensic image signals.";
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

    renderResult(payload);
  } catch (error) {
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
