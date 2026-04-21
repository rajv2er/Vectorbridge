import assert from "node:assert/strict";
import test from "node:test";

import multiFreedrawScene from "../src/fixtures/excalidraw/multi-freedraw.excalidraw.json" with { type: "json" };
import singleFreedrawScene from "../src/fixtures/excalidraw/single-freedraw.excalidraw.json" with { type: "json" };
import { importExcalidrawScene } from "../dist/adapters/excalidraw/import.js";
import { exportDocumentToOneNote } from "../dist/adapters/onenote/export.js";

test("exports a OneNote page payload for a single canonical stroke", () => {
  const imported = importExcalidrawScene(singleFreedrawScene, {
    title: "Single Stroke Fixture",
  });
  const exported = exportDocumentToOneNote(imported.document, {
    pageTitle: "OneNote Fixture Page",
  });

  assert.equal(exported.fidelity.level, "fallback");
  assert.equal(exported.request.parts.length, 1);
  assert.match(exported.request.presentationHtml, /<title>OneNote Fixture Page<\/title>/);
  assert.match(
    exported.request.presentationHtml,
    /data-absolute-enabled="true"/,
  );
  assert.match(
    exported.request.presentationHtml,
    /data-render-src="name:stroke-render-0"/,
  );

  const part = exported.request.parts[0];
  assert.equal(part.name, "stroke-render-0");
  assert.equal(part.contentType, "text/html");
  assert.match(part.content, /<svg/);
  assert.match(part.content, /stroke-width="2"/);
});

test("exports one OneNote rendered image part per stroke", () => {
  const imported = importExcalidrawScene(multiFreedrawScene);
  const exported = exportDocumentToOneNote(imported.document, {
    imageNamePrefix: "fixture-stroke",
  });

  assert.equal(exported.request.parts.length, 2);
  assert.equal(exported.fidelity.objects.length, 2);
  assert.ok(exported.fidelity.objects.every((item) => item.level === "fallback"));
  assert.match(exported.request.presentationHtml, /name:fixture-stroke-0/);
  assert.match(exported.request.presentationHtml, /name:fixture-stroke-1/);

  const dashedPart = exported.request.parts.find((part) =>
    part.name.includes("1"),
  );

  assert.ok(dashedPart);
  assert.match(dashedPart.content, /stroke-dasharray="12 8"/);
});
