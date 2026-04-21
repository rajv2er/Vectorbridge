import {
  SOURCE_APPS,
  TARGET_APPS,
  convertBetweenApps,
} from "../dist/index.js";
import sampleScene from "../src/fixtures/excalidraw/single-freedraw.excalidraw.json" with { type: "json" };

const STORAGE_KEY = "vectorbridge-demo-preferences";

const pipelineSummary = document.querySelector("#pipeline-summary");
const changePipelineButton = document.querySelector("#change-pipeline-button");
const pasteClipboardButton = document.querySelector("#paste-clipboard-button");
const loadFixtureButton = document.querySelector("#load-fixture-button");
const convertButton = document.querySelector("#convert-button");
const copyResultButton = document.querySelector("#copy-result-button");
const payloadInput = document.querySelector("#payload-input");
const fidelityOutput = document.querySelector("#fidelity-output");
const resultOutput = document.querySelector("#result-output");
const messageBox = document.querySelector("#message-box");
const setupDialog = document.querySelector("#setup-dialog");
const setupForm = document.querySelector("#setup-form");
const sourceAppSelect = document.querySelector("#source-app-select");
const targetAppSelect = document.querySelector("#target-app-select");

bootstrap();

function bootstrap() {
  populateSelect(sourceAppSelect, SOURCE_APPS);
  populateSelect(targetAppSelect, TARGET_APPS);

  const preferences = loadPreferences();

  if (preferences) {
    sourceAppSelect.value = preferences.sourceApp;
    targetAppSelect.value = preferences.targetApp;
    renderPipelineSummary(preferences);
  } else {
    openSetupDialog();
  }

  setupForm.addEventListener("submit", handleSetupSubmit);
  changePipelineButton.addEventListener("click", openSetupDialog);
  pasteClipboardButton.addEventListener("click", handlePasteClipboard);
  loadFixtureButton.addEventListener("click", handleLoadFixture);
  convertButton.addEventListener("click", handleConvert);
  copyResultButton.addEventListener("click", handleCopyResult);
}

function populateSelect(select, options) {
  select.innerHTML = "";

  for (const option of options) {
    const element = document.createElement("option");
    element.value = option.id;
    element.textContent = option.label;
    select.append(element);
  }
}

function loadPreferences() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function savePreferences(preferences) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
}

function openSetupDialog() {
  setupDialog.showModal();
}

function handleSetupSubmit(event) {
  event.preventDefault();

  const preferences = {
    sourceApp: sourceAppSelect.value,
    targetApp: targetAppSelect.value,
  };

  savePreferences(preferences);
  renderPipelineSummary(preferences);
  hideMessage();
  setupDialog.close();
}

function renderPipelineSummary(preferences) {
  const source = SOURCE_APPS.find((app) => app.id === preferences.sourceApp);
  const target = TARGET_APPS.find((app) => app.id === preferences.targetApp);

  pipelineSummary.textContent = source && target
    ? `${source.label} -> ${target.label}`
    : "Not configured";

  if (source) {
    payloadInput.placeholder = `Paste ${source.label} payload here`;
  }
}

function handleLoadFixture() {
  payloadInput.value = JSON.stringify(sampleScene, null, 2);
  hideMessage();
}

async function handlePasteClipboard() {
  if (!navigator.clipboard?.readText) {
    showMessage("Clipboard read is not available in this browser.");
    return;
  }

  try {
    const text = await navigator.clipboard.readText();

    if (!text.trim()) {
      showMessage("Clipboard is empty or does not contain text.");
      return;
    }

    payloadInput.value = text;
    hideMessage();
  } catch {
    showMessage(
      "Clipboard access was blocked. Allow clipboard permissions and try again.",
    );
  }
}

function handleConvert() {
  const preferences = loadPreferences();

  if (!preferences) {
    openSetupDialog();
    return;
  }

  const rawPayload = payloadInput.value.trim();

  if (!rawPayload) {
    showMessage("Paste a source payload first.");
    return;
  }

  let payload;

  try {
    payload = JSON.parse(rawPayload);
  } catch {
    showMessage("The current demo expects JSON payloads. Please paste valid JSON.");
    return;
  }

  try {
    const response = convertBetweenApps({
      sourceApp: preferences.sourceApp,
      targetApp: preferences.targetApp,
      payload,
      options: {
        title: "Clipboard Import",
        miro: {
          itemTitlePrefix: "Clipboard Stroke",
        },
        onenote: {
          pageTitle: "Clipboard Import",
        },
      },
    });

    hideMessage();
    fidelityOutput.textContent = JSON.stringify(response.output.fidelity, null, 2);
    resultOutput.textContent = JSON.stringify(response.output, null, 2);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Conversion failed.";
    showMessage(message);
  }
}

async function handleCopyResult() {
  if (!navigator.clipboard?.writeText) {
    showMessage("Clipboard write is not available in this browser.");
    return;
  }

  const resultText = resultOutput.textContent?.trim() ?? "";

  if (!resultText || resultText === "No conversion yet.") {
    showMessage("Run a conversion first, then copy the result.");
    return;
  }

  try {
    await navigator.clipboard.writeText(resultText);
    hideMessage();
  } catch {
    showMessage(
      "Clipboard write was blocked. Allow clipboard permissions and try again.",
    );
  }
}

function showMessage(message) {
  messageBox.hidden = false;
  messageBox.textContent = message;
}

function hideMessage() {
  messageBox.hidden = true;
  messageBox.textContent = "";
}
