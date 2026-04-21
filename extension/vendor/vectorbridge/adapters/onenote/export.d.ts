import { type FidelityReport } from "../../core/fidelity.js";
import type { CanonicalDocument } from "../../core/types.js";
export interface OneNoteMultipartPart {
    name: string;
    contentType: "text/html";
    content: string;
}
export interface OneNotePageCreateRequest {
    presentationHtml: string;
    parts: OneNoteMultipartPart[];
}
export interface OneNoteExportResult {
    request: OneNotePageCreateRequest;
    fidelity: FidelityReport;
}
export interface OneNoteExportOptions {
    pageTitle?: string;
    strokePadding?: number;
    imageNamePrefix?: string;
}
export declare function exportDocumentToOneNote(document: CanonicalDocument, options?: OneNoteExportOptions): OneNoteExportResult;
//# sourceMappingURL=export.d.ts.map