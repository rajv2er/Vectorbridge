import type { CanonicalDocument } from "./types.js";
export type BridgeStorageStrategy = "miro_item_metadata" | "miro_app_storage" | "onenote_file_attachment" | "external_blob";
export interface BridgeStorageHint {
    targetApp: string;
    strategy: BridgeStorageStrategy;
    key: string;
    maxInlineBytes?: number;
}
export interface BridgePayloadEnvelope {
    version: "1.0";
    bridgeId: string;
    sourceApp: string;
    sourceFormat?: string;
    capturedAt: string;
    canonical: CanonicalDocument;
    storageHints?: BridgeStorageHint[];
}
export interface CreateBridgePayloadOptions {
    bridgeId: string;
    sourceApp: string;
    sourceFormat?: string;
    capturedAt?: string;
    storageHints?: BridgeStorageHint[];
}
export declare function createBridgePayloadEnvelope(canonical: CanonicalDocument, options: CreateBridgePayloadOptions): BridgePayloadEnvelope;
export declare function serializeBridgePayloadEnvelope(envelope: BridgePayloadEnvelope): string;
export declare function parseBridgePayloadEnvelope(value: string): BridgePayloadEnvelope;
export declare function estimateSerializedSizeBytes(value: string): number;
//# sourceMappingURL=bridgePayload.d.ts.map