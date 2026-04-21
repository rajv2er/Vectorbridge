import assert from "node:assert/strict";
import test from "node:test";

import singleFreedrawScene from "../src/fixtures/excalidraw/single-freedraw.excalidraw.json" with { type: "json" };
import { importExcalidrawScene } from "../dist/adapters/excalidraw/import.js";
import {
  createBridgePayloadEnvelope,
  estimateSerializedSizeBytes,
  parseBridgePayloadEnvelope,
  serializeBridgePayloadEnvelope,
} from "../dist/core/bridgePayload.js";

test("creates and parses a bridge payload envelope around a canonical document", () => {
  const imported = importExcalidrawScene(singleFreedrawScene, {
    title: "Bridge Payload Fixture",
  });

  const envelope = createBridgePayloadEnvelope(imported.document, {
    bridgeId: "bridge-123",
    sourceApp: "excalidraw",
    sourceFormat: "clipboard-json",
    capturedAt: "2026-04-15T00:00:00.000Z",
    storageHints: [
      {
        targetApp: "miro",
        strategy: "miro_item_metadata",
        key: "vectorbridge.payload",
        maxInlineBytes: 6144,
      },
    ],
  });

  const serialized = serializeBridgePayloadEnvelope(envelope);
  const parsed = parseBridgePayloadEnvelope(serialized);

  assert.equal(parsed.version, "1.0");
  assert.equal(parsed.bridgeId, "bridge-123");
  assert.equal(parsed.sourceApp, "excalidraw");
  assert.equal(parsed.canonical.title, "Bridge Payload Fixture");
  assert.equal(parsed.storageHints?.[0]?.strategy, "miro_item_metadata");
  assert.ok(estimateSerializedSizeBytes(serialized) > 0);
});
