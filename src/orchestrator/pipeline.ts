import { importExcalidrawScene, type ExcalidrawScene } from "../adapters/excalidraw/import.js";
import {
  exportDocumentToMiro,
  exportDocumentToMiroWebSdk,
  type MiroExportOptions,
  type MiroExportResult,
  type MiroWebSdkExportResult,
} from "../adapters/miro/export.js";
import {
  exportDocumentToOneNote,
  type OneNoteExportOptions,
  type OneNoteExportResult,
} from "../adapters/onenote/export.js";
import type { CanonicalDocument } from "../core/types.js";
import {
  getSourceAppDefinition,
  getTargetAppDefinition,
  type SourceAppId,
  type TargetAppId,
} from "./registry.js";
import { mergeFidelityLevels, type FidelityReport } from "../core/fidelity.js";

export interface ConversionRequest {
  sourceApp: SourceAppId;
  targetApp: TargetAppId;
  payload: unknown;
  options?: {
    documentId?: string;
    title?: string;
    pageId?: string;
    pageName?: string;
    miro?: MiroExportOptions;
    onenote?: OneNoteExportOptions;
  };
}

export type ConversionOutput =
  | MiroExportResult
  | MiroWebSdkExportResult
  | OneNoteExportResult;

export interface ConversionResponse {
  sourceApp: SourceAppId;
  targetApp: TargetAppId;
  canonical: CanonicalDocument;
  output: ConversionOutput;
}

export function convertBetweenApps(
  request: ConversionRequest,
): ConversionResponse {
  const source = getSourceAppDefinition(request.sourceApp);
  const target = getTargetAppDefinition(request.targetApp);

  if (!source) {
    throw new Error(`Unsupported source app: ${request.sourceApp}`);
  }

  if (!target) {
    throw new Error(`Unsupported target app: ${request.targetApp}`);
  }

  const importResult = importFromSource(request.sourceApp, request.payload, request.options);
  const output = exportToTarget(request.targetApp, importResult.document, request.options);

  // Merge import and export fidelity
  output.fidelity = {
    level: mergeFidelityLevels(importResult.fidelity.level, output.fidelity.level),
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

function importFromSource(
  sourceApp: SourceAppId,
  payload: unknown,
  options?: ConversionRequest["options"],
): { document: CanonicalDocument; fidelity: FidelityReport } {
  switch (sourceApp) {
    case "excalidraw": {
      return importExcalidrawScene(payload as ExcalidrawScene, {
        documentId: options?.documentId,
        title: options?.title,
        pageId: options?.pageId,
        pageName: options?.pageName,
      });
    }
    default:
      return assertNever(sourceApp);
  }
}

function exportToTarget(
  targetApp: TargetAppId,
  canonical: CanonicalDocument,
  options?: ConversionRequest["options"],
): ConversionOutput {
  switch (targetApp) {
    case "miro":
      return exportDocumentToMiro(canonical, options?.miro);
    case "miro-web-sdk":
      return exportDocumentToMiroWebSdk(canonical, options?.miro);
    case "onenote":
      return exportDocumentToOneNote(canonical, options?.onenote);
    default:
      return assertNever(targetApp);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled pipeline value: ${String(value)}`);
}
