import { importMiroClipboard } from "../adapters/miro/import.js";
import { exportDocumentToMiroClipboard } from "../adapters/miro/clipboard.js";
import { exportDocumentToExcalidraw } from "../adapters/excalidraw/export.js";
import { getSourceAppDefinition, getTargetAppDefinition } from "./registry.js";
import { mergeFidelityLevels } from "../core/fidelity.js";

export function convertBetweenApps(request) {
  const source = getSourceAppDefinition(request.sourceApp);
  const target = getTargetAppDefinition(request.targetApp);

  if (!source) throw new Error(`Unsupported source app: ${request.sourceApp}`);
  if (!target) throw new Error(`Unsupported target app: ${request.targetApp}`);

  const importResult = importFromSource(
    request.sourceApp,
    request.payload,
    request.options
  );
  const output = exportToTarget(
    request.targetApp,
    importResult.document,
    request.options
  );

  output.fidelity = {
    level: mergeFidelityLevels(
      importResult.fidelity.level,
      output.fidelity.level
    ),
    objects: [...importResult.fidelity.objects, ...output.fidelity.objects],
    issues: [...importResult.fidelity.issues, ...output.fidelity.issues],
  };

  return {
    sourceApp: request.sourceApp,
    targetApp: request.targetApp,
    canonical: importResult.document,
    output,
  };
}

function importFromSource(sourceApp, payload, options) {
  switch (sourceApp) {
    case "miro-clipboard":
      return importMiroClipboard(payload, {
        documentId: options?.documentId,
        title: options?.title,
        pageId: options?.pageId,
        pageName: options?.pageName,
      });

    default:
      throw new Error(`Unhandled source app: ${String(sourceApp)}`);
  }
}

function exportToTarget(targetApp, canonical, options) {
  switch (targetApp) {
    case "miro-clipboard":
      return exportDocumentToMiroClipboard(canonical);

    case "excalidraw":
      return exportDocumentToExcalidraw(canonical, options?.excalidraw);

    default:
      throw new Error(`Unhandled target app: ${String(targetApp)}`);
  }
}