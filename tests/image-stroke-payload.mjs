#!/usr/bin/env node
import assert from "node:assert/strict";
import { importExcalidrawScene } from "../extension/vendor/vectorbridge/adapters/excalidraw/import.js";
import { exportDocumentToMiroClipboard } from "../extension/vendor/vectorbridge/adapters/miro/clipboard.js";

const dataURL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB";
const scene = {
  type: "excalidraw/clipboard",
  version: 2,
  elements: [
    {
      id: "image-1",
      type: "image",
      fileId: "file-1",
      x: 100,
      y: 200,
      width: 320,
      height: 180,
      angle: Math.PI / 6,
      opacity: 80,
      scale: [1, 1],
      index: "a0",
    },
    {
      id: "stroke-1",
      type: "freedraw",
      x: 140,
      y: 240,
      width: 80,
      height: 40,
      angle: 0,
      strokeColor: "#e03131",
      strokeWidth: 4,
      strokeStyle: "solid",
      opacity: 100,
      index: "a1",
      points: [[0, 0], [40, 40], [80, 0]],
      pressures: [0.5, 0.5, 0.5],
    },
  ],
  files: {
    "file-1": {
      id: "file-1",
      dataURL,
      mimeType: "image/png",
      created: 0,
    },
  },
};

const imported = importExcalidrawScene(scene);
assert.equal(Object.keys(imported.document.objects).length, 2, "image and stroke must both be imported");
assert.equal(imported.document.objects["image-1"].kind, "image");
assert.equal(imported.document.objects["image-1"].dataURL, dataURL);

const output = exportDocumentToMiroClipboard(imported.document);
const decoded = decodePayload(output.payload);
const image = decoded.data.objects.find((widget) => widget.widgetData?.type === "image");
const paint = decoded.data.objects.find((widget) => widget.widgetData?.type === "paint");

assert.ok(image, "Miro payload must contain a native image widget");
assert.ok(paint, "Miro payload must retain the editable paint widget");
assert.equal(image.widgetData.json.url, dataURL);
assert.deepEqual(image.widgetData.json.size, { width: 320, height: 180 });
assert.equal(image.widgetData.json.rotation.rotation, 30);
assert.equal(output.widgetCount, 2);

const imageCenter = image.widgetData.json._position.offsetPx;
const paintPoints = absoluteMiroPaintPoints(paint.widgetData.json);
assert.deepEqual(imageCenter, { x: 0, y: 0 });
assert.deepEqual(paintPoints, [
  { x: -120, y: -50 },
  { x: -80, y: -10 },
  { x: -40, y: -50 },
]);

console.log("PASS: image and editable stroke are both present in the Miro payload");

function decodePayload(payload) {
  const shifted = Uint8Array.from(atob(payload), (character) => character.charCodeAt(0));
  const bytes = shifted.map((byte) => (byte - 59 + 256) % 256);
  return JSON.parse(new TextDecoder().decode(bytes));
}

function absoluteMiroPaintPoints(json) {
  const points = json.points;
  const minX = Math.min(...points.map((point) => point.x));
  const maxX = Math.max(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxY = Math.max(...points.map((point) => point.y));
  const localCenterX = (minX + maxX) / 2;
  const localCenterY = (minY + maxY) / 2;
  const center = json._position.offsetPx;
  return points.map((point) => ({
    x: center.x + point.x - localCenterX,
    y: center.y + point.y - localCenterY,
  }));
}
