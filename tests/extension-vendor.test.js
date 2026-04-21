import { test } from "node:test";
import assert from "node:assert/strict";

// Import directly from the vendor bundle the extension uses,
// to verify the copied dist files work correctly.
import {
  SOURCE_APPS,
  TARGET_APPS,
  convertBetweenApps,
} from "../extension/vendor/vectorbridge/index.js";

test("vendor bundle exports SOURCE_APPS with expected structure", () => {
  assert.ok(Array.isArray(SOURCE_APPS), "SOURCE_APPS should be an array");
  assert.ok(SOURCE_APPS.length > 0, "SOURCE_APPS should not be empty");

  const excalidraw = SOURCE_APPS.find((app) => app.id === "excalidraw");
  assert.ok(excalidraw, "SOURCE_APPS should include excalidraw");
  assert.equal(excalidraw.label, "Excalidraw");
});

test("vendor bundle exports TARGET_APPS with expected structure", () => {
  assert.ok(Array.isArray(TARGET_APPS), "TARGET_APPS should be an array");
  assert.ok(TARGET_APPS.length > 0, "TARGET_APPS should not be empty");

  const miro = TARGET_APPS.find((app) => app.id === "miro");
  assert.ok(miro, "TARGET_APPS should include miro");
  assert.equal(miro.label, "Miro REST API");

  const onenote = TARGET_APPS.find((app) => app.id === "onenote");
  assert.ok(onenote, "TARGET_APPS should include onenote");
});

test("vendor bundle convertBetweenApps converts Excalidraw to Miro", () => {
  const excalidrawPayload = {
    type: "excalidraw",
    version: 2,
    elements: [
      {
        id: "test-stroke-1",
        type: "freedraw",
        x: 10,
        y: 20,
        width: 100,
        height: 50,
        points: [
          [0, 0],
          [25, 10],
          [50, 5],
          [75, 30],
          [100, 50],
        ],
        strokeColor: "#1e1e1e",
        strokeWidth: 2,
        opacity: 100,
        strokeStyle: "solid",
      },
    ],
  };

  const response = convertBetweenApps({
    sourceApp: "excalidraw",
    targetApp: "miro",
    payload: excalidrawPayload,
    options: {
      title: "Extension Test",
      miro: {
        itemTitlePrefix: "Test Stroke",
      },
    },
  });

  assert.ok(response.output, "response should have output");
  assert.ok(response.output.items, "output should have items");
  assert.ok(response.output.items.length > 0, "should produce at least one Miro item");
  assert.ok(response.output.fidelity, "output should have fidelity report");
  assert.equal(response.sourceApp, "excalidraw");
  assert.equal(response.targetApp, "miro");
  assert.ok(response.canonical, "response should include canonical document");
});

test("vendor bundle convertBetweenApps converts Excalidraw to OneNote", () => {
  const excalidrawPayload = {
    type: "excalidraw",
    version: 2,
    elements: [
      {
        id: "test-stroke-2",
        type: "freedraw",
        x: 0,
        y: 0,
        width: 80,
        height: 40,
        points: [
          [0, 0],
          [40, 20],
          [80, 40],
        ],
        strokeColor: "#ff0000",
        strokeWidth: 3,
        opacity: 80,
        strokeStyle: "solid",
      },
    ],
  };

  const response = convertBetweenApps({
    sourceApp: "excalidraw",
    targetApp: "onenote",
    payload: excalidrawPayload,
    options: {
      title: "OneNote Extension Test",
      onenote: {
        pageTitle: "Test Page",
      },
    },
  });

  assert.ok(response.output, "response should have output");
  assert.ok(response.output.fidelity, "output should have fidelity report");
  assert.equal(response.sourceApp, "excalidraw");
  assert.equal(response.targetApp, "onenote");
});

test("vendor bundle convertBetweenApps throws for unsupported source app", () => {
  assert.throws(
    () =>
      convertBetweenApps({
        sourceApp: "unknown",
        targetApp: "miro",
        payload: {},
      }),
    /Unsupported source app/,
  );
});

test("vendor bundle convertBetweenApps handles mixed elements (shapes, text, lines)", () => {
  const excalidrawPayload = {
    type: "excalidraw",
    version: 2,
    elements: [
      {
        id: "rect-1",
        type: "rectangle",
        x: 100,
        y: 100,
        width: 200,
        height: 150,
        strokeColor: "#000000",
        strokeWidth: 2,
        backgroundColor: "#e3f2fd",
        opacity: 100,
        strokeStyle: "solid",
        roundness: null,
        angle: 0,
      },
      {
        id: "text-1",
        type: "text",
        x: 150,
        y: 130,
        width: 100,
        height: 25,
        text: "Hello World",
        fontSize: 20,
        fontFamily: 1,
        strokeColor: "#1e1e1e",
        strokeWidth: 1,
        opacity: 100,
        textAlign: "center",
        angle: 0,
      },
      {
        id: "line-1",
        type: "line",
        x: 50,
        y: 50,
        width: 200,
        height: 100,
        points: [
          [0, 0],
          [200, 100],
        ],
        strokeColor: "#333333",
        strokeWidth: 2,
        opacity: 100,
        strokeStyle: "solid",
        startArrowhead: null,
        endArrowhead: "arrow",
      },
    ],
  };

  const response = convertBetweenApps({
    sourceApp: "excalidraw",
    targetApp: "miro",
    payload: excalidrawPayload,
    options: {
      title: "Mixed Elements Test",
    },
  });

  assert.ok(response.output.items.length >= 3, "should produce items for all elements");

  const shapeItems = response.output.items.filter((item) => item.type === "shape");
  const textItems = response.output.items.filter((item) => item.type === "text");
  const connectorItems = response.output.items.filter((item) => item.type === "connector");

  assert.ok(shapeItems.length >= 1, "should have at least one shape item");
  assert.ok(textItems.length >= 1, "should have at least one text item");
  assert.ok(connectorItems.length >= 1, "should have at least one connector item");
});
