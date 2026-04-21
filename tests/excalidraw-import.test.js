import assert from "node:assert/strict";
import test from "node:test";

import mixedElementsScene from "../src/fixtures/excalidraw/mixed-elements.excalidraw.json" with { type: "json" };
import multiFreedrawScene from "../src/fixtures/excalidraw/multi-freedraw.excalidraw.json" with { type: "json" };
import singleFreedrawScene from "../src/fixtures/excalidraw/single-freedraw.excalidraw.json" with { type: "json" };
import { importExcalidrawScene } from "../dist/adapters/excalidraw/import.js";

test("imports a single freedraw element into one canonical stroke", () => {
  const result = importExcalidrawScene(singleFreedrawScene, {
    title: "Single Stroke Fixture",
  });

  assert.equal(Object.keys(result.document.objects).length, 1);
  assert.equal(result.document.title, "Single Stroke Fixture");
  assert.equal(result.fidelity.level, "editable");

  const stroke = result.document.objects["stroke-a"];

  assert.ok(stroke);
  assert.equal(stroke.kind, "stroke");
  assert.equal(stroke.points.length, 6);
  assert.deepEqual(stroke.points[0], {
    x: 120,
    y: 80,
    pressure: 0.35,
    t: 0,
  });
  assert.deepEqual(stroke.points.at(-1), {
    x: 172,
    y: 108,
    pressure: 0.58,
    t: 5,
  });
  assert.deepEqual(stroke.bounds, {
    x: 120,
    y: 80,
    width: 52,
    height: 28,
  });
  assert.equal(stroke.style.color, "#1e1e1e");
  assert.equal(stroke.style.width, 2);
});

test("imports multiple freedraw strokes and normalizes style values", () => {
  const result = importExcalidrawScene(multiFreedrawScene);

  assert.equal(Object.keys(result.document.objects).length, 2);
  assert.equal(result.fidelity.level, "editable");

  const blueStroke = result.document.objects["stroke-blue"];
  const redStroke = result.document.objects["stroke-red"];

  assert.ok(blueStroke);
  assert.ok(redStroke);
  assert.equal(blueStroke.style.dash, "solid");
  assert.equal(redStroke.style.dash, "dashed");
  assert.equal(redStroke.style.opacity, 0.85);
  assert.equal(redStroke.transform.rotation, 10);
  assert.equal(redStroke.points[0].x, 180);
  assert.equal(redStroke.points[0].y, 120);
});

test("imports mixed elements: freedraw, rectangle, and text", () => {
  const result = importExcalidrawScene(mixedElementsScene);

  // All 3 elements should now be imported
  assert.equal(Object.keys(result.document.objects).length, 3);
  assert.equal(result.fidelity.level, "editable");
  assert.equal(result.fidelity.issues.length, 0);

  // Verify the freedraw was imported as a stroke
  const stroke = result.document.objects["stroke-green"];
  assert.ok(stroke);
  assert.equal(stroke.kind, "stroke");

  // Verify the rectangle was imported as a shape
  const rect = result.document.objects["rect-1"];
  assert.ok(rect);
  assert.equal(rect.kind, "shape");
  assert.equal(rect.shapeType, "rectangle");
  assert.deepEqual(rect.bounds, { x: 140, y: 50, width: 120, height: 80 });

  // Verify the text was imported
  const text = result.document.objects["text-1"];
  assert.ok(text);
  assert.equal(text.kind, "text");
  assert.equal(text.text, "Unsupported");
  assert.equal(text.fontSize, 20);
});
