import { type BridgePayloadEnvelope, type BridgeStorageStrategy } from "../../core/bridgePayload.js";
import { type FidelityReport } from "../../core/fidelity.js";
import type { CanonicalDocument, CanonicalStroke } from "../../core/types.js";
export interface MiroImageItemCreateRequest {
    type: "image";
    data: {
        url: string;
        title?: string;
    };
    position: {
        x: number;
        y: number;
        origin: "center";
    };
    geometry: {
        width: number;
        height: number;
    };
}
export interface MiroShapeItemCreateRequest {
    type: "shape";
    data: {
        shape: string;
        content?: string;
    };
    style: {
        fillColor?: string;
        fillOpacity?: string;
        borderColor?: string;
        borderWidth?: string;
        borderOpacity?: string;
        borderStyle?: string;
    };
    position: {
        x: number;
        y: number;
        origin: "center";
    };
    geometry: {
        width: number;
        height: number;
        rotation?: number;
    };
}
export interface MiroTextItemCreateRequest {
    type: "text";
    data: {
        content: string;
    };
    style: {
        color?: string;
        fillColor?: string;
        fillOpacity?: string;
        fontFamily?: string;
        fontSize?: string;
        textAlign?: string;
    };
    position: {
        x: number;
        y: number;
        origin: "center";
    };
    geometry: {
        width: number;
        rotation?: number;
    };
}
export interface MiroConnectorCreateRequest {
    type: "connector";
    data: {
        shape: "straight" | "elbowed" | "curved";
    };
    style: {
        strokeColor?: string;
        strokeWidth?: string;
        strokeStyle?: string;
        startStrokeCap?: string;
        endStrokeCap?: string;
    };
    startPosition: {
        x: number;
        y: number;
    };
    endPosition: {
        x: number;
        y: number;
    };
}
export type MiroItemCreateRequest = MiroImageItemCreateRequest | MiroShapeItemCreateRequest | MiroTextItemCreateRequest | MiroConnectorCreateRequest;
export interface MiroWebSdkImageCreateRequest {
    url: string;
    title?: string;
    x: number;
    y: number;
    width: number;
    height: number;
    rotation?: number;
}
export interface MiroExportResult {
    items: MiroItemCreateRequest[];
    fidelity: FidelityReport;
    bridge?: MiroBridgeExportPlan;
}
export interface MiroWebSdkExportResult {
    items: MiroWebSdkImageCreateRequest[];
    fidelity: FidelityReport;
    bridge?: MiroBridgeExportPlan;
}
export interface MiroExportOptions {
    itemTitlePrefix?: string;
    strokePadding?: number;
    bridgeEditability?: "off" | "auto";
    bridgeMetadataKey?: string;
    maxInlineMetadataBytes?: number;
    appStorageKeyPrefix?: string;
}
export interface MiroBridgeMetadataBinding {
    itemIndex: number;
    objectIds: string[];
    metadataKey: string;
    value: Record<string, unknown>;
}
export interface MiroBridgeAppStorageRecord {
    key: string;
    value: string;
}
export interface MiroBridgeExportPlan {
    bridgeId: string;
    envelope: BridgePayloadEnvelope;
    serializedEnvelope: string;
    serializedEnvelopeBytes: number;
    storageStrategy: BridgeStorageStrategy;
    metadataKey: string;
    bindings: MiroBridgeMetadataBinding[];
    appStorageRecords: MiroBridgeAppStorageRecord[];
}
export declare function exportDocumentToMiro(document: CanonicalDocument, options?: MiroExportOptions): MiroExportResult;
export declare function exportDocumentToMiroWebSdk(document: CanonicalDocument, options?: MiroExportOptions): MiroWebSdkExportResult;
export declare function exportStrokeToMiroImage(stroke: CanonicalStroke, options?: MiroExportOptions): MiroImageItemCreateRequest;
//# sourceMappingURL=export.d.ts.map