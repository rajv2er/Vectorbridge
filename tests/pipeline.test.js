import assert from "node:assert/strict";
import test from "node:test";

import singleFreedrawScene from "../src/fixtures/excalidraw/single-freedraw.excalidraw.json" with { type: "json" };
import {
  SOURCE_APPS,
  TARGET_APPS,
} from "../dist/orchestrator/registry.js";
import { convertBetweenApps } from "../dist/orchestrator/pipeline.js";

test("exposes the current supported source and target app registry", () => {
  assert.deepEqual(
    SOURCE_APPS.map((app) => app.id),
    ["excalidraw"],
  );
  assert.deepEqual(
    TARGET_APPS.map((app) => app.id),
    ["miro", "miro-web-sdk", "onenote"],
  );
});

test("converts from Excalidraw to Miro REST using a user-selected pipeline", () => {
  const result = convertBetweenApps({
    sourceApp: "excalidraw",
    targetApp: "miro",
    payload: singleFreedrawScene,
    options: {
      title: "Clipboard Import",
      miro: {
        itemTitlePrefix: "Clipboard Stroke",
      },
    },
  });

  assert.equal(result.sourceApp, "excalidraw");
  assert.equal(result.targetApp, "miro");
  assert.equal(result.canonical.title, "Clipboard Import");

  // The smart export should produce at least 1 item (native shapes, not images)
  assert.ok(result.output.items.length >= 1);

  // With the hidden bridge payload attached, the result should be
  // bridge_editable even if the visible Miro items are approximated.
  const level = result.output.fidelity.level;
  assert.ok(
    level === "editable" || level === "approximate" || level === "bridge_editable",
    `Expected editable, approximate, or bridge_editable, got ${level}`,
  );
  assert.ok(result.output.bridge);
});

test("converts from Excalidraw to OneNote using a user-selected pipeline", () => {
  const result = convertBetweenApps({
    sourceApp: "excalidraw",
    targetApp: "onenote",
    payload: singleFreedrawScene,
    options: {
      onenote: {
        pageTitle: "Clipboard Page",
      },
    },
  });

  assert.equal(result.targetApp, "onenote");
  assert.equal(result.output.request.parts.length, 1);
  assert.equal(result.output.fidelity.level, "fallback");
  assert.match(result.output.request.presentationHtml, /Clipboard Page/);
});

test("throws for unsupported source apps", () => {
  assert.throws(
    () =>
      convertBetweenApps({
        sourceApp: "excalidraw-does-not-exist",
        targetApp: "miro",
        payload: singleFreedrawScene,
      }),
    /Unsupported source app/,
  );
});
