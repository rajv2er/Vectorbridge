export function createBridgePayloadEnvelope(canonical, options) {
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
export function serializeBridgePayloadEnvelope(envelope) {
    return JSON.stringify(envelope);
}
export function parseBridgePayloadEnvelope(value) {
    const parsed = JSON.parse(value);
    if (parsed.version !== "1.0" ||
        typeof parsed.bridgeId !== "string" ||
        typeof parsed.sourceApp !== "string" ||
        typeof parsed.capturedAt !== "string" ||
        typeof parsed.canonical !== "object" ||
        parsed.canonical === null) {
        throw new Error("Invalid bridge payload envelope.");
    }
    return parsed;
}
export function estimateSerializedSizeBytes(value) {
    return encodeURIComponent(value).replace(/%[A-F0-9]{2}/g, "x").length;
}
//# sourceMappingURL=bridgePayload.js.map