import { type MiroExportOptions, type MiroExportResult, type MiroWebSdkExportResult } from "../adapters/miro/export.js";
import { type OneNoteExportOptions, type OneNoteExportResult } from "../adapters/onenote/export.js";
import type { CanonicalDocument } from "../core/types.js";
import { type SourceAppId, type TargetAppId } from "./registry.js";
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
export type ConversionOutput = MiroExportResult | MiroWebSdkExportResult | OneNoteExportResult;
export interface ConversionResponse {
    sourceApp: SourceAppId;
    targetApp: TargetAppId;
    canonical: CanonicalDocument;
    output: ConversionOutput;
}
export declare function convertBetweenApps(request: ConversionRequest): ConversionResponse;
//# sourceMappingURL=pipeline.d.ts.map