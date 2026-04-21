import type { CanonicalDocument } from "./types.js";

export type BridgeStorageStrategy =
  | "miro_item_metadata"
  | "miro_app_storage"
  | "onenote_file_attachment"
  | "external_blob";

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

export function createBridgePayloadEnvelope(
  canonical: CanonicalDocument,
  options: CreateBridgePayloadOptions,
): BridgePayloadEnvelope {
  return {
    version: "1.0",
    bridgeId: options.bridgeId,
    sourceApp: options.sourceApp,
    sourceFormat: options.sourceFormat,
    capturedAt: options.capturedAt ?? new Date().toISOString(),
    canonical,
    storageHints: options.storageHints,
  };
}

export function serializeBridgePayloadEnvelope(
  envelope: BridgePayloadEnvelope,
): string {
  return JSON.stringify(envelope);
}

export function parseBridgePayloadEnvelope(
  value: string,
): BridgePayloadEnvelope {
  const parsed = JSON.parse(value) as Partial<BridgePayloadEnvelope>;

  if (
    parsed.version !== "1.0" ||
    typeof parsed.bridgeId !== "string" ||
    typeof parsed.sourceApp !== "string" ||
    typeof parsed.capturedAt !== "string" ||
    typeof parsed.canonical !== "object" ||
    parsed.canonical === null
  ) {
    throw new Error("Invalid bridge payload envelope.");
  }

  return parsed as BridgePayloadEnvelope;
}

export function estimateSerializedSizeBytes(value: string): number {
  return encodeURIComponent(value).replace(/%[A-F0-9]{2}/g, "x").length;
}
