const LOCAL_API_BASE_URL = "http://127.0.0.1:8080";
const PRODUCTION_API_BASE_URL = "https://ai-image-detector-api-12513320995.us-central1.run.app";
const API_BASE_URL_STORAGE_KEY = "AI_DETECTOR_API_BASE_URL";
const DEVICE_ID_STORAGE_KEY = "AI_DETECTOR_DEVICE_ID";
const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000;

const imageInput = document.querySelector("#imageInput");
const fileLabel = document.querySelector("#fileLabel");
const analyzeButton = document.querySelector("#analyzeButton");
const statusText = document.querySelector("#statusText");
const errorText = document.querySelector("#errorText");
const errorPanel = document.querySelector("#errorPanel");
const errorTitle = document.querySelector("#errorTitle");
const errorMessage = document.querySelector("#errorMessage");
const errorDetail = document.querySelector("#errorDetail");
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
const feedbackPanel = document.querySelector("#feedbackPanel");
const feedbackCorrectButton = document.querySelector("#feedbackCorrectButton");
const feedbackIncorrectButton = document.querySelector("#feedbackIncorrectButton");
const feedbackMessage = document.querySelector("#feedbackMessage");
const whyResultList = document.querySelector("#whyResultList");
const advancedToggleButton = document.querySelector("#advancedToggleButton");
const advancedContent = document.querySelector("#advancedContent");

let selectedFile = null;
let previewUrl = null;
let apiBaseUrl = resolveApiBaseUrl();
let deviceId = getOrCreateDeviceId();
let progressTimer = null;
let progressValue = 0;
let currentResult = null;
let feedbackSubmitted = false;
let inactivityTimer = null;

const PROGRESS_MESSAGES = [
  { min: 0, text: "Uploading image..." },
  { min: 25, text: "Analyzing image structure..." },
  { min: 55, text: "Checking edge and boundary signals..." },
  { min: 82, text: "Finalizing result..." },
];

const REASON_LABELS = {
  metadata: "camera-origin evidence is limited or missing",
  boundary: "unusual object and edge transition patterns",
  patch_consistency: "locally uniform or synthetic-looking structure",
  patch_repetition: "repeated fine texture patterns",
  noise_rgb: "unusual noise behavior",
  frequency: "unusual frequency-domain structure",
  jpeg: "compression-pattern irregularities",
  texture: "unusual texture statistics",
  edge: "unusual edge behavior",
};

const MODULE_LABELS = {
  metadata: "Camera metadata",
  noise_rgb: "Noise pattern",
  frequency: "Frequency structure",
  texture: "Texture statistics",
  patch_consistency: "Local structure consistency",
  patch_repetition: "Repeated pattern signal",
  boundary: "Boundary transition signal",
  edge: "Edge behavior",
  jpeg: "Compression pattern",
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

const ERROR_MESSAGES = {
  MISSING_FILENAME: {
    title: "Upload issue",
    message: "Please choose a supported and valid image file.",
  },
  UNSUPPORTED_FILE_TYPE: {
    title: "Unsupported file type",
    message: "Please choose a supported and valid image file.",
  },
  FILE_TOO_LARGE: {
    title: "File is too large",
    message: "Please choose a smaller image file and try again.",
  },
  INVALID_IMAGE: {
    title: "Invalid image",
    message: "Please choose a supported and valid image file.",
  },
  IMAGE_TOO_LARGE_DIMENSIONS: {
    title: "Image dimensions are too large",
    message: "Please choose a smaller image and try again.",
  },
  RATE_LIMITED: {
    title: "Too many requests",
    message: "Please wait a moment and try again.",
  },
  DAILY_LIMIT_REACHED: {
    title: "Daily pilot limit reached",
    message: "You have reached the daily pilot limit. Please try again tomorrow.",
  },
  ANALYSIS_FAILED: {
    title: "Service temporarily unavailable",
    message: "The analysis service is temporarily unavailable. Please try again shortly.",
  },
  SERVER_TEMPORARILY_UNAVAILABLE: {
    title: "Service temporarily unavailable",
    message: "The analysis service is temporarily unavailable. Please try again shortly.",
  },
};

function getConfiguredApiBaseUrl() {
  return window.APP_CONFIG?.API_BASE_URL?.trim() || "";
}

function getStoredApiBaseUrl() {
  return localStorage.getItem(API_BASE_URL_STORAGE_KEY)?.trim() || "";
}

function normalizeApiBaseUrl(url) {
  return url.trim().replace(/\/+$/, "");
}

function isPlaceholderApiBaseUrl(url) {
  if (!url) {
    return false;
  }

  return /your_cloud_run_url/i.test(url);
}

function getEnvironmentFallbackApiBaseUrl() {
  const hostname = window.location.hostname.toLowerCase();
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return LOCAL_API_BASE_URL;
  }

  return PRODUCTION_API_BASE_URL;
}

function resolveApiBaseUrl() {
  const configuredApiBaseUrl = normalizeApiBaseUrl(getConfiguredApiBaseUrl());
  if (configuredApiBaseUrl && !isPlaceholderApiBaseUrl(configuredApiBaseUrl)) {
    console.log(`[config] API base URL resolved: ${configuredApiBaseUrl}`);
    return configuredApiBaseUrl;
  }

  const storedApiBaseUrl = normalizeApiBaseUrl(getStoredApiBaseUrl());
  if (storedApiBaseUrl && !isPlaceholderApiBaseUrl(storedApiBaseUrl)) {
    console.log(`[config] API base URL resolved: ${storedApiBaseUrl}`);
    return storedApiBaseUrl;
  }

  const fallbackApiBaseUrl = getEnvironmentFallbackApiBaseUrl();
  console.log(`[config] API base URL resolved: ${fallbackApiBaseUrl}`);
  return fallbackApiBaseUrl;
}

function generateDeviceId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  const values = new Uint32Array(4);
  window.crypto.getRandomValues(values);
  return Array.from(values, (value) => value.toString(16).padStart(8, "0")).join("-");
}

function getOrCreateDeviceId() {
  const storedDeviceId = localStorage.getItem(DEVICE_ID_STORAGE_KEY);
  if (storedDeviceId) {
    return storedDeviceId;
  }

  const nextDeviceId = generateDeviceId();
  localStorage.setItem(DEVICE_ID_STORAGE_KEY, nextDeviceId);
  return nextDeviceId;
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

function hideError() {
  errorText.textContent = "";
  errorPanel.classList.add("is-hidden");
  errorTitle.textContent = "Analysis could not be completed";
  errorMessage.textContent = "";
  errorDetail.textContent = "";
}

function showError(message, title = "Analysis could not be completed", detail = "") {
  errorText.textContent = "";
  errorTitle.textContent = title;
  errorMessage.textContent = message;
  errorDetail.textContent = detail;
  errorPanel.classList.remove("is-hidden");
}

function buildBackendError(payload) {
  const errorCode = payload?.error_code;
  const backendDetail = payload?.detail || "";
  const mappedError = ERROR_MESSAGES[errorCode] || {
    title: "Analysis could not be completed",
    message: backendDetail || "Please try again shortly.",
  };

  return {
    title: mappedError.title,
    message: mappedError.message,
    detail: backendDetail,
  };
}

function buildNetworkError() {
  return {
    title: "Unable to reach server",
    message: "Unable to reach the analysis server. Please check your internet connection and try again.",
    detail: "",
  };
}

function buildInvalidResponseError() {
  return {
    title: "Invalid server response",
    message: "The server returned an invalid response. Please try again.",
    detail: "",
  };
}

function buildRenderError() {
  return {
    title: "Result display issue",
    message: "The analysis completed, but the result could not be displayed properly.",
    detail: "",
  };
}

function clearResult() {
  resultPanel.classList.add("is-hidden");
  advancedPanel.classList.add("is-hidden");
  feedbackPanel.classList.add("is-hidden");
  advancedContent.classList.add("is-hidden");
  advancedToggleButton.setAttribute("aria-expanded", "false");
  advancedToggleButton.textContent = "Show technical details";
  verdictValue.textContent = "";
  scoreValue.textContent = "";
  confidenceValue.textContent = "";
  explanationText.textContent = "";
  disclaimerText.textContent = "";
  feedbackMessage.textContent = "";
  whyResultList.replaceChildren();
  moduleScores.replaceChildren();
  summaryReasons.replaceChildren();
  summaryBlock.classList.add("is-hidden");
  currentResult = null;
  feedbackSubmitted = false;
  setFeedbackButtonsDisabled(false);
}

function clearAnalysisStateForNewRequest() {
  clearResult();
  hideError();
  hideLoadingOverlay();
  updateProgress(0);
  statusText.textContent = "";
}

function clearSelectedFile() {
  selectedFile = null;
  imageInput.value = "";
  fileLabel.textContent = "Select an image";
  analyzeButton.disabled = true;

  if (previewUrl) {
    URL.revokeObjectURL(previewUrl);
    previewUrl = null;
  }

  imagePreview.removeAttribute("src");
  previewPanel.classList.add("is-hidden");
}

function resetSessionDueToInactivity() {
  console.log("[session] reset due to inactivity");
  hideLoadingOverlay();
  setLoading(false);
  clearSelectedFile();
  clearResult();
  hideError();
  statusText.textContent = "Session reset due to inactivity.";
}

function resetInactivityTimer() {
  if (inactivityTimer) {
    window.clearTimeout(inactivityTimer);
  }

  inactivityTimer = window.setTimeout(resetSessionDueToInactivity, INACTIVITY_TIMEOUT_MS);
}

function registerActivityListeners() {
  ["mousedown", "touchstart", "keydown", "scroll", "click"].forEach((eventName) => {
    window.addEventListener(eventName, resetInactivityTimer, { passive: true });
  });
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
    const header = document.createElement("div");
    const label = document.createElement("span");
    const score = document.createElement("span");
    const level = document.createElement("span");
    const track = document.createElement("div");
    const fill = document.createElement("div");

    row.className = "signal-row";
    header.className = "signal-row-header";
    label.className = "signal-label";
    score.className = "signal-score";
    level.className = "signal-level";
    track.className = "signal-bar-track";
    fill.className = "signal-bar-fill";

    label.textContent = MODULE_LABELS[name] || name.replaceAll("_", " ");
    score.textContent = formatScore(value);
    level.textContent = getAnomalyLevel(value);
    fill.style.width = `${Math.max(0, Math.min(100, Number(value || 0) * 100))}%`;
    track.append(fill);
    header.append(label, score, level);
    row.append(header, track);
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

function getAnomalyLevel(value) {
  const numericValue = Number(value || 0);
  if (numericValue < 0.25) {
    return "Low";
  }
  if (numericValue < 0.45) {
    return "Moderate";
  }
  if (numericValue < 0.65) {
    return "Elevated";
  }
  return "High";
}

function buildReasonBullets(result) {
  const reasons = Array.isArray(result.summary_reasons) ? result.summary_reasons : [];
  const parsedReasons = reasons.map(parseReason).filter((reason) => reason.detail);
  const structuralReasons = parsedReasons.filter((reason) => STRUCTURAL_MODULES.includes(reason.moduleName));
  const metadataReasons = parsedReasons.filter((reason) => reason.moduleName === "metadata");
  const chosenReasons = [...structuralReasons.slice(0, 2)];

  if (chosenReasons.length < 3 && metadataReasons.length > 0) {
    chosenReasons.push(metadataReasons[0]);
  }

  const uniqueBullets = [...new Set(chosenReasons.map((reason) => buildReadableBullet(reason)))].slice(0, 3);
  return uniqueBullets.length > 0
    ? uniqueBullets
    : [
        "Multiple forensic signals were combined to estimate the result.",
        "This assessment should be treated as guidance rather than proof.",
      ];
}

function buildReadableBullet(parsedReason) {
  switch (parsedReason.moduleName) {
    case "boundary":
      return "Detected unusual edge and object transition behavior.";
    case "patch_consistency":
      return "Some local regions appear unusually uniform or synthetic-looking.";
    case "patch_repetition":
      return "Repeated fine-detail patterns appear across parts of the image.";
    case "edge":
      return "Edge behavior looks less natural than expected.";
    case "noise_rgb":
      return "Noise behavior does not fully match a typical camera image.";
    case "frequency":
      return "Underlying frequency structure appears unusual.";
    case "jpeg":
      return "Compression patterns show irregular behavior.";
    case "texture":
      return "Texture statistics look less natural than expected.";
    case "metadata":
      return "Camera-origin evidence is limited, which is treated as supporting evidence only.";
    default:
      return parsedReason.detail.replace(/\.$/, "") + ".";
  }
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
    return "This estimate is based on a combination of image-structure and authenticity signals.";
  }

  if (readableReasons.length === 1) {
    return `This result is primarily driven by ${readableReasons[0]}.`;
  }

  return `This result is primarily driven by ${readableReasons[0]} and ${readableReasons[1]}.`;
}

function renderResult(result) {
  currentResult = result;
  feedbackSubmitted = false;
  verdictValue.textContent = result.verdict ?? "Unavailable";
  scoreValue.textContent = formatScore(result.final_score);
  confidenceValue.textContent = result.confidence ?? "Unavailable";
  explanationText.textContent = buildUserExplanation(result);
  disclaimerText.textContent = result.disclaimer ?? "This is a forensic estimate, not absolute proof.";
  whyResultList.replaceChildren();
  buildReasonBullets(result).forEach((bulletText) => {
    const item = document.createElement("li");
    item.textContent = bulletText;
    whyResultList.append(item);
  });

  renderModuleScores(result.module_scores);
  renderSummaryReasons(result.summary_reasons);

  resultPanel.classList.remove("is-hidden");
  advancedPanel.classList.remove("is-hidden");
  feedbackPanel.classList.remove("is-hidden");
  feedbackMessage.textContent = "";
  setFeedbackButtonsDisabled(false);
}

function setFeedbackButtonsDisabled(isDisabled) {
  feedbackCorrectButton.disabled = isDisabled;
  feedbackIncorrectButton.disabled = isDisabled;
}

async function submitFeedback(feedbackValue) {
  if (!currentResult || feedbackSubmitted) {
    return;
  }

  const requestId = currentResult.request_id;
  const verdict = currentResult.verdict;

  if (!requestId || !verdict) {
    feedbackMessage.textContent = "Feedback is unavailable for this result.";
    return;
  }

  feedbackSubmitted = true;
  setFeedbackButtonsDisabled(true);
  feedbackMessage.textContent = "Sending feedback...";

  try {
    const activeApiBaseUrl = normalizeApiBaseUrl(apiBaseUrl);
    const response = await fetch(`${activeApiBaseUrl}/feedback`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        request_id: requestId,
        verdict,
        feedback: feedbackValue,
      }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new Error(payload?.detail || "Feedback could not be sent. Please try again.");
    }

    feedbackMessage.textContent = "Thank you for the feedback.";
  } catch (error) {
    feedbackSubmitted = false;
    setFeedbackButtonsDisabled(false);
    feedbackMessage.textContent = "Feedback could not be sent. Please try again.";
  }
}

async function analyzeSelectedImage() {
  if (!selectedFile) {
    return;
  }

  console.log("[analyze] request started", {
    filename: selectedFile.name,
    size: selectedFile.size,
  });

  clearAnalysisStateForNewRequest();
  setLoading(true);
  showLoadingOverlay();

  const formData = new FormData();
  formData.append("file", selectedFile);

  try {
    const activeApiBaseUrl = normalizeApiBaseUrl(apiBaseUrl);
    let response;

    try {
      response = await fetch(`${activeApiBaseUrl}/analyze`, {
        method: "POST",
        headers: {
          "X-Device-ID": deviceId,
        },
        body: formData,
      });
    } catch (error) {
      console.error("[analyze] request failed before response", error);
      const friendlyError = buildNetworkError();
      showError(friendlyError.message, friendlyError.title, friendlyError.detail);
      return;
    }

    console.log("[analyze] response received", {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
    });

    let responseText;
    try {
      responseText = await response.text();
    } catch (error) {
      console.error("[analyze] response text read failed", error);
      const friendlyError = buildNetworkError();
      showError(friendlyError.message, friendlyError.title, friendlyError.detail);
      return;
    }

    console.log("[analyze] response text read", {
      length: responseText.length,
    });

    let payload;
    try {
      payload = JSON.parse(responseText);
    } catch (error) {
      console.error("[analyze] JSON parse failed", error);
      const friendlyError = buildInvalidResponseError();
      showError(friendlyError.message, friendlyError.title, friendlyError.detail);
      return;
    }

    console.log("[analyze] JSON parsed", {
      hasErrorCode: Boolean(payload?.error_code),
      hasVerdict: Boolean(payload?.verdict),
      requestId: payload?.request_id || null,
    });

    if (!response.ok) {
      const friendlyError = buildBackendError(payload);
      showError(friendlyError.message, friendlyError.title, friendlyError.detail);
      return;
    }

    try {
      renderResult(payload);
    } catch (error) {
      console.error("[analyze] UI render failed", error);
      clearResult();
      const friendlyError = buildRenderError();
      showError(friendlyError.message, friendlyError.title, friendlyError.detail);
      return;
    }

    console.log("[analyze] UI rendered", {
      requestId: payload?.request_id || null,
      verdict: payload?.verdict || null,
    });
    await completeLoadingOverlay();
  } finally {
    hideLoadingOverlay();
    setLoading(false);
  }
}

imageInput.addEventListener("change", () => {
  resetInactivityTimer();
  selectedFile = imageInput.files?.[0] || null;
  clearResult();
  hideError();
  statusText.textContent = "";

  if (!selectedFile) {
    clearSelectedFile();
    return;
  }

  if (previewUrl) {
    URL.revokeObjectURL(previewUrl);
    previewUrl = null;
  }

  fileLabel.textContent = selectedFile.name;
  previewUrl = URL.createObjectURL(selectedFile);
  imagePreview.src = previewUrl;
  previewPanel.classList.remove("is-hidden");
  analyzeButton.disabled = false;
});

saveApiUrlButton.addEventListener("click", () => {
  resetInactivityTimer();
  const nextApiBaseUrl = normalizeApiBaseUrl(apiBaseUrlInput.value);

  if (!nextApiBaseUrl || isPlaceholderApiBaseUrl(nextApiBaseUrl)) {
    localStorage.removeItem(API_BASE_URL_STORAGE_KEY);
  } else {
    localStorage.setItem(API_BASE_URL_STORAGE_KEY, nextApiBaseUrl);
  }

  apiBaseUrl = resolveApiBaseUrl();
  updateApiSettingsDisplay();
  hideError();
  statusText.textContent = "API URL saved for this browser.";
});

feedbackCorrectButton.addEventListener("click", () => {
  resetInactivityTimer();
  submitFeedback("correct");
});
feedbackIncorrectButton.addEventListener("click", () => {
  resetInactivityTimer();
  submitFeedback("incorrect");
});
advancedToggleButton.addEventListener("click", () => {
  resetInactivityTimer();
  const isExpanded = advancedToggleButton.getAttribute("aria-expanded") === "true";
  advancedToggleButton.setAttribute("aria-expanded", String(!isExpanded));
  advancedToggleButton.textContent = isExpanded ? "Show technical details" : "Hide technical details";
  advancedContent.classList.toggle("is-hidden", isExpanded);
});
analyzeButton.addEventListener("click", () => {
  resetInactivityTimer();
  analyzeSelectedImage();
});
updateApiSettingsDisplay();
registerActivityListeners();
resetInactivityTimer();
