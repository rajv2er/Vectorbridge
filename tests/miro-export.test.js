import assert from "node:assert/strict";
import test from "node:test";

import multiFreedrawScene from "../src/fixtures/excalidraw/multi-freedraw.excalidraw.json" with { type: "json" };
import singleFreedrawScene from "../src/fixtures/excalidraw/single-freedraw.excalidraw.json" with { type: "json" };
import { importExcalidrawScene } from "../dist/adapters/excalidraw/import.js";
import {
  exportDocumentToMiro,
  exportDocumentToMiroWebSdk,
} from "../dist/adapters/miro/export.js";

test("exports canonical strokes to Miro using smart strategy", () => {
  const imported = importExcalidrawScene(singleFreedrawScene);
  const exported = exportDocumentToMiro(imported.document);

  // The single-freedraw fixture is a nearly straight diagonal line,
  // so smart export should either recognize it as a line or segment it
  // into thin rectangles — not fall back to SVG images.
  assert.ok(exported.items.length >= 1);

  // All exported items should be native shapes (not images)
  for (const item of exported.items) {
    assert.equal(item.type, "shape");
  }

  assert.ok(
    exported.fidelity.level === "editable" ||
      exported.fidelity.level === "bridge_editable",
  );
  assert.ok(exported.bridge);
  assert.equal(exported.bridge.storageStrategy, "miro_item_metadata");
  assert.equal(exported.bridge.bindings.length, exported.items.length);
  assert.equal(exported.bridge.appStorageRecords.length, 0);
});

test("exports multiple strokes as segmented editable rectangles", () => {
  const imported = importExcalidrawScene(multiFreedrawScene);
  const exported = exportDocumentToMiro(imported.document, {
    itemTitlePrefix: "Fixture Stroke",
  });

  // Should have multiple items (thin rectangles from segmentation)
  assert.ok(exported.items.length >= 2);

  // All items should be native shapes
  for (const item of exported.items) {
    assert.equal(item.type, "shape");
  }

  assert.ok(exported.bridge);
  assert.equal(exported.bridge.bindings.length, exported.items.length);
});

test("exports Web SDK image payloads from the same canonical document", () => {
  const imported = importExcalidrawScene(singleFreedrawScene);
  const exported = exportDocumentToMiroWebSdk(imported.document, {
    itemTitlePrefix: "SDK Stroke",
  });

  // Web SDK only gets image items, which are now 0 because smart
  // export converts strokes to shapes instead of images.
  // This is expected — shapes are only available via REST API.
  assert.equal(exported.items.length, 0);
  assert.ok(exported.fidelity);
  assert.ok(exported.bridge);
});

test("falls back to app-storage pointers when bridge metadata exceeds inline limits", () => {
  const imported = importExcalidrawScene(singleFreedrawScene);
  const exported = exportDocumentToMiro(imported.document, {
    maxInlineMetadataBytes: 10,
  });

  assert.ok(exported.bridge);
  assert.equal(exported.bridge.storageStrategy, "miro_app_storage");
  assert.equal(exported.bridge.appStorageRecords.length, 1);
  assert.equal(exported.bridge.bindings[0]?.value.kind, "vectorbridge-pointer");
});
