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
const inspectMiroButton = document.querySelector("#inspect-miro");
const copyResultButton = document.querySelector("#copy-result");
const captureStatus = document.querySelector("#capture-status");
const conversionOutput = document.querySelector("#conversion-output");
const fidelityOutput = document.querySelector("#fidelity-output");
const message = document.querySelector("#message");

let latestMiroClipboardHtml = "";
let latestExcalidrawJson = "";

initialize();

async function initialize() {
  populateSelect(sourceAppSelect, SOURCE_APPS);
  populateSelect(targetAppSelect, TARGET_APPS);

  const stored = await chrome.storage.local.get([PREFERENCES_KEY]);
  const preferences = stored[PREFERENCES_KEY] ?? {
    sourceApp: "excalidraw",
    targetApp: "miro-clipboard",
  };

  sourceAppSelect.value = preferences.sourceApp;
  targetAppSelect.value = preferences.targetApp;

  savePreferencesButton.addEventListener("click", savePreferences);
  convertButton.addEventListener("click", handleConvert);
  inspectMiroButton.addEventListener("click", handleInspectMiroCopy);
  copyResultButton.addEventListener("click", handleCopyResult);

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
  showMessage("Saved preference.");
}

async function populateClipboardPreview() {
  try {
    await new Promise((resolve) => setTimeout(resolve, 150));
    if (!document.hasFocus()) {
      captureStatus.textContent =
        "Clipboard preview will appear when you click 'Convert'.";
      return;
    }
    const text = await navigator.clipboard.readText();
    if (!text || !text.trim()) {
      captureStatus.textContent = "Clipboard is empty.";
      return;
    }
    const preview = text.length > 200 ? text.slice(0, 200) + "…" : text;
    let isJson = false;
    try {
      JSON.parse(text);
      isJson = true;
    } catch {}
    captureStatus.textContent = JSON.stringify(
      { ready: true, isJson, preview },
      null,
      2
    );
  } catch {
    captureStatus.textContent = "Click 'Convert' to read the clipboard.";
  }
}

async function handleConvert() {
  hideMessage();
  latestMiroClipboardHtml = "";
  latestExcalidrawJson = "";

  const sourceApp = sourceAppSelect.value;
  const targetApp = targetAppSelect.value;

  let payload;
  try {
    if (sourceApp === "miro-clipboard") {
      const snapshot = await readClipboardSnapshot();
      const encoded = findMiroPayload(snapshot);
      if (!encoded) {
        showMessage("No Miro data found in clipboard. Copy something from Miro first.");
        return;
      }
      payload = decodeMiroPayload(encoded);
    } else {
      const text = await navigator.clipboard.readText();
      if (!text || !text.trim()) {
        showMessage("Clipboard is empty.");
        return;
      }
      try {
        payload = JSON.parse(text);
      } catch {
        showMessage("Clipboard is not valid JSON — copy from Excalidraw first.");
        return;
      }
    }
  } catch (err) {
    showMessage(
      "Could not read clipboard: " +
        (err instanceof Error ? err.message : String(err))
    );
    return;
  }

  let response;
  try {
    response = convertBetweenApps({
      sourceApp,
      targetApp,
      payload,
      options: { title: "Clipboard Import" },
    });
  } catch (err) {
    showMessage(
      "Conversion failed: " + (err instanceof Error ? err.message : String(err))
    );
    return;
  }

  if (targetApp === "miro-clipboard" && response.output.html) {
    try {
      latestMiroClipboardHtml = response.output.html;
      await writeMiroHtmlToClipboard(latestMiroClipboardHtml);
      conversionOutput.textContent = JSON.stringify(
        {
          widgetCount: response.output.widgetCount,
          status: "Miro payload written to clipboard — go paste in Miro.",
        },
        null,
        2
      );
      showMessage("✓ Ready to paste in Miro.");
    } catch {
      latestMiroClipboardHtml = response.output.html;
      conversionOutput.textContent =
        "(Auto-copy failed — click Copy result, then paste in Miro.)";
      showMessage("Auto-copy failed. Use Copy result.");
    }
  } else if (targetApp === "excalidraw" && response.output.scene) {
    try {
      latestExcalidrawJson = JSON.stringify(response.output.scene);
      await navigator.clipboard.writeText(latestExcalidrawJson);
      conversionOutput.textContent = JSON.stringify(
        {
          elementCount: response.output.scene.elements.length,
          status: "Excalidraw scene written to clipboard — go paste in Excalidraw.",
        },
        null,
        2
      );
      showMessage("✓ Ready to paste in Excalidraw.");
    } catch {
      latestExcalidrawJson = JSON.stringify(response.output.scene);
      conversionOutput.textContent = "(Auto-copy failed — click Copy result.)";
      showMessage("Auto-copy failed. Use Copy result.");
    }
  } else {
    conversionOutput.textContent = JSON.stringify(response.output, null, 2);
    showMessage("Converted.");
  }

  fidelityOutput.textContent = response.output.fidelity
    ? JSON.stringify(response.output.fidelity, null, 2)
    : "No fidelity data.";
}

// Inspect the raw Miro clipboard payload for debugging.
async function handleInspectMiroCopy() {
  hideMessage();

  let snapshot;
  try {
    snapshot = await readClipboardSnapshot();
  } catch (err) {
    showMessage(err instanceof Error ? err.message : "Could not read clipboard.");
    return;
  }

  const encoded = findMiroPayload(snapshot);
  if (!encoded) {
    conversionOutput.textContent = JSON.stringify(
      {
        message: "No miro-data-v1 marker found.",
        clipboard: summarizeClipboardSnapshot(snapshot),
      },
      null,
      2
    );
    fidelityOutput.textContent =
      "Copy a selected Miro object, then click Inspect immediately.";
    showMessage("No Miro payload found — see clipboard summary below.");
    return;
  }

  try {
    const decoded = decodeMiroPayload(encoded);
    const objectSummaries =
      decoded.data?.objects?.map(summarizeMiroObject) ?? [];
    conversionOutput.textContent = JSON.stringify(
      {
        summary: { objectCount: objectSummaries.length, objects: objectSummaries },
        decoded,
      },
      null,
      2
    );
    fidelityOutput.textContent = "Decoded Miro clipboard payload.";
    showMessage("Decoded Miro clipboard payload.");
  } catch (err) {
    showMessage(
      err instanceof Error ? err.message : "Could not decode Miro payload."
    );
  }
}

async function handleCopyResult() {
  if (latestMiroClipboardHtml) {
    try {
      await writeMiroHtmlToClipboard(latestMiroClipboardHtml);
      showMessage("Re-copied Miro payload. Paste in Miro now.");
    } catch {
      showMessage("Clipboard write blocked by browser.");
    }
    return;
  }

  if (latestExcalidrawJson) {
    try {
      await navigator.clipboard.writeText(latestExcalidrawJson);
      showMessage("Re-copied Excalidraw scene. Paste in Excalidraw now.");
    } catch {
      showMessage("Clipboard write blocked by browser.");
    }
    return;
  }

  const result = conversionOutput.textContent?.trim() ?? "";
  if (!result || result === "No conversion yet.") {
    showMessage("Run a conversion first.");
    return;
  }
  try {
    await navigator.clipboard.writeText(result);
    showMessage("Copied.");
  } catch {
    showMessage("Clipboard write blocked by browser.");
  }
}

async function writeMiroHtmlToClipboard(html) {
  const htmlBlob = new Blob([html], { type: "text/html" });
  const plainBlob = new Blob(["VectorBridge Miro clipboard payload"], {
    type: "text/plain",
  });
  await navigator.clipboard.write([
    new ClipboardItem({ "text/html": htmlBlob, "text/plain": plainBlob }),
  ]);
}

async function readClipboardSnapshot() {
  if (!navigator.clipboard.read) {
    throw new Error("Rich clipboard reads are not supported in this browser.");
  }
  const items = await navigator.clipboard.read();
  const entries = [];
  for (const item of items) {
    const formats = {};
    for (const type of item.types) {
      try {
        const blob = await item.getType(type);
        formats[type] = { size: blob.size, text: await readBlobPreview(blob) };
      } catch (err) {
        formats[type] = {
          error: err instanceof Error ? err.message : "Could not read.",
        };
      }
    }
    entries.push({ types: item.types, formats });
  }
  return entries;
}

async function readBlobPreview(blob) {
  if (blob.type.startsWith("image/")) return `[${blob.type}, ${blob.size} bytes]`;
  return await blob.text();
}

function findMiroPayload(snapshot) {
  for (const entry of snapshot) {
    for (const format of Object.values(entry.formats)) {
      if (!format.text) continue;
      const p = extractMiroPayload(format.text);
      if (p) return p;
    }
  }
  return "";
}

function extractMiroPayload(value) {
  const normalized = decodeHtmlEntities(value);
  const match = normalized.match(
    /(?:<|&lt;)!?\s*--\s*\(miro-data-v1\)([\s\S]*?)\(\/miro-data-v1\)\s*--(?:>|&gt;)/
  );
  return match?.[1] ?? "";
}

function decodeHtmlEntities(value) {
  const el = document.createElement("textarea");
  el.innerHTML = value;
  return el.value;
}

function decodeMiroPayload(payload) {
  const shifted = Uint8Array.from(atob(payload), (c) => c.charCodeAt(0));
  const bytes = shifted.map((b) => (b - 59 + 256) % 256);
  return JSON.parse(new TextDecoder().decode(bytes));
}

function summarizeClipboardSnapshot(snapshot) {
  return snapshot.map((entry) => ({
    types: entry.types,
    formats: Object.fromEntries(
      Object.entries(entry.formats).map(([type, fmt]) => [
        type,
        {
          size: fmt.size,
          error: fmt.error,
          preview: fmt.text?.slice(0, 400),
          hasMiroMarker: fmt.text ? /miro-data-v1/.test(fmt.text) : false,
        },
      ])
    ),
  }));
}

function summarizeMiroObject(object, index) {
  const json = object.widgetData?.json ?? {};
  return {
    index,
    type: object.type,
    widgetType: object.widgetData?.type,
    shape: json.shape,
    hasText: typeof json.text === "string" && json.text.length > 0,
    keys: Object.keys(json).sort(),
  };
}

function showMessage(text) {
  message.hidden = false;
  message.textContent = text;
}

function hideMessage() {
  message.hidden = true;
  message.textContent = "";
}
