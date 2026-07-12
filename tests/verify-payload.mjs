#!/usr/bin/env node
/**
 * Verification script: generates a mock Excalidraw scene with shapes + strokes,
 * runs it through the VectorBridge pipeline, decodes the output, and dumps
 * the widget structure so you can inspect exactly what gets pasted into Miro.
 *
 * Usage: node tests/verify-payload.mjs
 */
import { importExcalidrawScene } from "../extension/vendor/vectorbridge/adapters/excalidraw/import.js";
import { exportDocumentToMiroClipboard } from "../extension/vendor/vectorbridge/adapters/miro/clipboard.js";

// ── Mock Excalidraw scene: 2 shapes + 2 freehand strokes ──
const scene = {
  type: "excalidraw/clipboard",
  version: 2,
  source: "https://excalidraw.com",
  elements: [
    // Rectangle
    {
      id: "rect-1",
      type: "rectangle",
      x: 100,
      y: 100,
      width: 200,
      height: 120,
      angle: 0,
      strokeColor: "#1e1e1e",
      backgroundColor: "transparent",
      fillStyle: "solid",
      strokeWidth: 2,
      strokeStyle: "solid",
      roughness: 0,
      opacity: 100,
      index: "a0",
      seed: 12345,
      version: 1,
      versionNonce: 67890,
    },
    // Ellipse
    {
      id: "ellipse-1",
      type: "ellipse",
      x: 400,
      y: 100,
      width: 150,
      height: 150,
      angle: 0,
      strokeColor: "#1971c2",
      backgroundColor: "#a5d8ff",
      fillStyle: "solid",
      strokeWidth: 3,
      strokeStyle: "solid",
      roughness: 0,
      opacity: 100,
      index: "a1",
      seed: 11111,
      version: 1,
      versionNonce: 22222,
    },
    // Freehand stroke 1 (a wavy line)
    {
      id: "stroke-1",
      type: "freedraw",
      x: 100,
      y: 300,
      width: 300,
      height: 80,
      angle: 0,
      strokeColor: "#e03131",
      backgroundColor: "transparent",
      fillStyle: "solid",
      strokeWidth: 4,
      strokeStyle: "solid",
      roughness: 0,
      opacity: 100,
      index: "a2",
      seed: 33333,
      version: 1,
      versionNonce: 44444,
      points: Array.from({ length: 30 }, (_, i) => [
        i * 10,
        Math.sin(i * 0.4) * 30 + 40,
      ]),
      pressures: Array.from({ length: 30 }, () => 0.5),
      simulatePressure: false,
    },
    // Freehand stroke 2 (a tighter scribble)
    {
      id: "stroke-2",
      type: "freedraw",
      x: 500,
      y: 300,
      width: 100,
      height: 100,
      angle: 0,
      strokeColor: "#2f9e44",
      backgroundColor: "transparent",
      fillStyle: "solid",
      strokeWidth: 2,
      strokeStyle: "solid",
      roughness: 0,
      opacity: 100,
      index: "a3",
      seed: 55555,
      version: 1,
      versionNonce: 66666,
      points: Array.from({ length: 20 }, (_, i) => [
        50 + Math.cos(i * 0.6) * 40,
        50 + Math.sin(i * 0.6) * 40,
      ]),
      pressures: Array.from({ length: 20 }, () => 0.5),
      simulatePressure: false,
    },
  ],
  appState: { viewBackgroundColor: "#ffffff" },
};

// ── Run the pipeline ──
console.log("=== Importing Excalidraw scene ===");
const importResult = importExcalidrawScene(scene, {
  title: "Verification Test",
});
console.log(
  `Imported ${Object.keys(importResult.document.objects).length} objects`
);
console.log(`Import fidelity: ${importResult.fidelity.level}`);
console.log();

console.log("=== Exporting to Miro clipboard ===");
const exportResult = exportDocumentToMiroClipboard(importResult.document);
console.log(`Widget count: ${exportResult.widgetCount}`);
console.log(`Export fidelity: ${exportResult.fidelity.level}`);
console.log(`HTML length: ${exportResult.html.length} chars`);
console.log();

// ── Decode the payload and dump widget structure ──
console.log("=== Decoded widget structure ===\n");

const base64Match = exportResult.html.match(
  /(?:<!--\s*)?\(miro-data-v1\)([\s\S]*?)\(\/miro-data-v1\)/
);
if (!base64Match) {
  console.error("Could not extract base64 payload from HTML!");
  process.exit(1);
}

const b64 = base64Match[1];
const shifted = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
const bytes = shifted.map((b) => (b - 59 + 256) % 256);
const decoded = JSON.parse(new TextDecoder().decode(bytes));

console.log("Envelope:");
console.log(JSON.stringify({ ...decoded, data: undefined }, null, 2));
console.log();

console.log(`Objects (${decoded.data.objects.length} widgets):\n`);

for (const [i, widget] of decoded.data.objects.entries()) {
  const json = widget.widgetData?.json ?? {};
  const type = widget.widgetData?.type ?? "unknown";

  console.log(`Widget ${i}: type=${type}, id=${widget.id}, token=${widget.meta?.widgetToken}`);

  if (type === "shape") {
    const style = JSON.parse(json.style ?? "{}");
    console.log(`  shape: ${json.shape}`);
    console.log(`  size: ${json.size?.width}×${json.size?.height}`);
    console.log(`  pos: (${json._position?.offsetPx?.x}, ${json._position?.offsetPx?.y})`);
    console.log(`  _position.schema: ${json._position?.schema ?? "MISSING!"}`);
    console.log(`  style.st: ${style.st} ${style.st === 3 ? "✓" : "✗ SHOULD BE 3"}`);
    console.log(`  style.i: ${JSON.stringify(style.i)} ${style.i === 0 ? "✓" : "✗ SHOULD BE 0"}`);
    console.log(`  style.brr: ${style.brr} ${style.brr === 0 ? "✓" : "✗ SHOULD BE 0"}`);
    console.log(`  style.bc: ${style.bc} (fill)`);
  } else if (type === "line") {
    const style = JSON.parse(json.style ?? "{}");
    console.log(`  primary: (${json.primary?.point?.x}, ${json.primary?.point?.y})`);
    console.log(`  secondary: (${json.secondary?.point?.x}, ${json.secondary?.point?.y})`);
    console.log(`  style.lw: ${style.lw}, style.ls: ${style.ls}`);
  } else if (type === "paint") {
    const style = JSON.parse(json.style ?? "{}");
    console.log(`  points: ${json.points?.length ?? 0} points`);
    console.log(`  size: ${json.size?.width}×${json.size?.height}`);
    console.log(`  pos: (${json._position?.offsetPx?.x}, ${json._position?.offsetPx?.y})`);
    console.log(`  style.e: ${style.e} (brush thickness)`);
    console.log(`  style.lc: ${style.lc} (color)`);
    console.log(`  style.lo: ${style.lo} (opacity)`);
  }

  console.log();
}

// ── Checklist ──
console.log("=== Checklist ===");
const checks = [
  ["Shapes use st:3", decoded.data.objects.every((w) => {
    if (w.widgetData?.type !== "shape") return true;
    return JSON.parse(w.widgetData.json.style).st === 3;
  })],
  ["Shapes use i:0 (matches real Miro)", decoded.data.objects.every((w) => {
    if (w.widgetData?.type !== "shape") return true;
    return JSON.parse(w.widgetData.json.style).i === 0;
  })],
  ["Envelope has asPortalAmount:0", decoded.asPortalAmount === 0],
  ["Envelope has data.meta:{}", JSON.stringify(decoded.data.meta) === "{}"],
  ["No top-level meta.widgetToken", decoded.meta?.widgetToken === undefined],
  ["Shapes have brr:0", decoded.data.objects.every((w) => {
    if (w.widgetData?.type !== "shape") return true;
    return JSON.parse(w.widgetData.json.style).brr === 0;
  })],
  ["Shapes have schema:canvasOffsetPx", decoded.data.objects.every((w) => {
    if (w.widgetData?.type !== "shape") return true;
    return w.widgetData.json._position?.schema === "canvasOffsetPx";
  })],
  ["Strokes use paint widgets (not line segments)", decoded.data.objects.every((w) => {
    return w.widgetData?.type !== "line" || w.widgetData.json.line !== undefined;
  })],
  ["All widgets have meta.widgetToken", decoded.data.objects.every((w) =>
    typeof w.meta?.widgetToken === "number"
  )],
  ["Widget tokens are unique", new Set(decoded.data.objects.map((w) => w.meta?.widgetToken)).size === decoded.data.objects.length],
];

for (const [name, pass] of checks) {
  console.log(`  ${pass ? "✅" : "❌"} ${name}`);
}

if (checks.every(([, pass]) => pass)) {
  console.log("\n✅ All checks passed. Ready for real Miro paste test.");
} else {
  console.log("\n❌ Some checks failed. Review the widget dump above.");
}
