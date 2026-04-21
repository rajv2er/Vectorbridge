import { importExcalidrawScene } from "../adapters/excalidraw/import.js";
import { exportDocumentToMiro, exportDocumentToMiroWebSdk, } from "../adapters/miro/export.js";
import { exportDocumentToOneNote, } from "../adapters/onenote/export.js";
import { getSourceAppDefinition, getTargetAppDefinition, } from "./registry.js";
import { mergeFidelityLevels } from "../core/fidelity.js";
export function convertBetweenApps(request) {
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
function importFromSource(sourceApp, payload, options) {
    switch (sourceApp) {
        case "excalidraw": {
            return importExcalidrawScene(payload, {
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
function exportToTarget(targetApp, canonical, options) {
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
function assertNever(value) {
    throw new Error(`Unhandled pipeline value: ${String(value)}`);
}
//# sourceMappingURL=pipeline.js.map