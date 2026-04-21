import {
  SOURCE_APPS,
  TARGET_APPS,
  convertBetweenApps,
} from "./vendor/vectorbridge/index.js";

const PREFERENCES_KEY = "vectorbridge.preferences";

const sourceAppSelect = document.querySelector("#source-app");
const targetAppSelect = document.querySelector("#target-app");
const savePreferencesButton = document.querySelector("#save-preferences");
const convertButton = document.querySelector("#convert-button");
const copyResultButton = document.querySelector("#copy-result");
const captureStatus = document.querySelector("#capture-status");
const conversionOutput = document.querySelector("#conversion-output");
const fidelityOutput = document.querySelector("#fidelity-output");
const message = document.querySelector("#message");

initialize();

async function initialize() {
  populateSelect(sourceAppSelect, SOURCE_APPS);
  populateSelect(targetAppSelect, TARGET_APPS);
  sourceAppSelect.value = "excalidraw";

  const stored = await chrome.storage.local.get([PREFERENCES_KEY]);
  const preferences = stored[PREFERENCES_KEY] ?? {
    sourceApp: "excalidraw",
    targetApp: "miro",
  };

  sourceAppSelect.value = preferences.sourceApp;
  targetAppSelect.value = preferences.targetApp;

  savePreferencesButton.addEventListener("click", savePreferences);
  convertButton.addEventListener("click", handleConvert);
  copyResultButton.addEventListener("click", handleCopyResult);

  // Attempt to pre-read clipboard to show status
  populateClipboardPreview();
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

async function savePreferences() {
  await chrome.storage.local.set({
    [PREFERENCES_KEY]: {
      sourceApp: sourceAppSelect.value,
      targetApp: targetAppSelect.value,
    },
  });

  showMessage("Saved your target app preference.");
}

async function populateClipboardPreview() {
  try {
    // In Chrome extensions, navigator.clipboard.readText() can fail if 
    // the popup hasn't gained full focus yet. A small delay helps.
    await new Promise((resolve) => setTimeout(resolve, 150));
    
    // If it still doesn't have focus, we can't auto-read safely.
    if (!document.hasFocus()) {
       captureStatus.textContent = "Clipboard preview will appear when you click 'Convert capture'.";
       return;
    }

    const text = await navigator.clipboard.readText();
    if (!text || !text.trim()) {
      captureStatus.textContent = "Clipboard is empty or contains no text.";
      return;
    }

    const preview = text.length > 260 ? text.slice(0, 260) + "..." : text;
    let isJson = false;
    try {
      JSON.parse(text);
      isJson = true;
    } catch {
      // Not JSON
    }

    captureStatus.textContent = JSON.stringify(
      {
        ready: true,
        isJson: isJson,
        preview,
      },
      null,
      2,
    );
  } catch (error) {
    // This happens if the OS blocks clipboard access without a user gesture.
    captureStatus.textContent = "Click 'Convert capture' to read the clipboard and run the conversion.";
  }
}

async function handleConvert() {
  hideMessage();

  let clipboardData = "";
  try {
    clipboardData = await navigator.clipboard.readText();
  } catch {
    showMessage("Could not read clipboard. Ensure you have copied something and the extension has permission.");
    return;
  }

  if (!clipboardData || !clipboardData.trim()) {
    showMessage("The clipboard does not contain any text data.");
    return;
  }

  // Always use the current select values from the UI so the user
  // doesn't have to save preferences before every conversion.
  const sourceApp = sourceAppSelect.value;
  const targetApp = targetAppSelect.value;

  let payload;

  try {
    payload = JSON.parse(clipboardData);
  } catch {
    showMessage("Captured clipboard is not valid JSON.");
    return;
  }

  try {
    const response = convertBetweenApps({
      sourceApp,
      targetApp,
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

    conversionOutput.textContent = JSON.stringify(response.output, null, 2);
    fidelityOutput.textContent = response.output.fidelity
      ? JSON.stringify(response.output.fidelity, null, 2)
      : "No fidelity data.";
    showMessage("Successfully converted clipboard payload.");
  } catch (error) {
    showMessage(error instanceof Error ? error.message : "Conversion failed.");
  }
}

async function handleCopyResult() {
  const result = conversionOutput.textContent?.trim() ?? "";

  if (!result || result === "No conversion yet.") {
    showMessage("Run a conversion first.");
    return;
  }

  try {
    await navigator.clipboard.writeText(result);
    showMessage("Copied converted payload to the clipboard.");
  } catch {
    showMessage("Clipboard write was blocked by the browser.");
  }
}

function showMessage(text) {
  message.hidden = false;
  message.textContent = text;
}

function hideMessage() {
  message.hidden = true;
  message.textContent = "";
}
