/**
 * Converts a CanonicalDocument into an Excalidraw JSON scene that can be
 * pasted directly into Excalidraw via the clipboard.
 */
import { createEmptyFidelityReport } from "../../core/fidelity.js";

const CANONICAL_TO_EXCALIDRAW_SHAPE = {
  rectangle: "rectangle",
  round_rectangle: "rectangle",
  ellipse: "ellipse",
  diamond: "diamond",
};

export function exportDocumentToExcalidraw(document, options) {
  const fidelity = createEmptyFidelityReport();
  const elements = [];

  for (const object of Object.values(document.objects)) {
    const results = exportObject(object, fidelity);
    elements.push(...results);
  }

  elements.sort((a, b) => (a.__zIndex ?? 0) - (b.__zIndex ?? 0));
  for (const el of elements) delete el.__zIndex;

  const scene = {
    type: "excalidraw",
    version: 2,
    source: "vectorbridge",
    elements,
    appState: {
      viewBackgroundColor: "#ffffff",
      currentItemFontFamily: 1,
    },
    files: {},
  };

  return { scene, fidelity, elementCount: elements.length };
}

function exportObject(object, fidelity) {
  switch (object.kind) {
    case "shape":
      if (object.shapeType === "triangle") return [exportTriangle(object, fidelity)];
      return [exportShape(object, fidelity)];
    case "stroke":
      return [exportStroke(object, fidelity)];
    case "line":
      return [exportLine(object, fidelity)];
    case "text":
      return [exportText(object, fidelity)];
    default:
      fidelity.issues.push({
        code: "EXCALIDRAW_UNSUPPORTED_KIND",
        message: `Skipped unsupported canonical kind "${object.kind}".`,
        level: "unsupported",
        objectId: object.id,
      });
      return [];
  }
}

function exportShape(shape, fidelity) {
  fidelity.objects.push({ objectId: shape.id, level: "editable", issues: [] });

  const type = CANONICAL_TO_EXCALIDRAW_SHAPE[shape.shapeType] ?? "rectangle";
  const isRounded = shape.shapeType === "round_rectangle";

  return {
    id: shape.id,
    type,
    x: shape.bounds.x,
    y: shape.bounds.y,
    width: shape.bounds.width,
    height: shape.bounds.height,
    angle: degreesToRadians(shape.transform.rotation),
    strokeColor: shape.style.color,
    backgroundColor:
      shape.fill.color === "transparent" ? "transparent" : shape.fill.color,
    fillStyle: "solid",
    strokeWidth: shape.style.width,
    strokeStyle: shape.style.dash ?? "solid",
    roughness: 0,
    opacity: Math.round(shape.style.opacity * 100),
    roundness: isRounded ? { type: 3 } : null,
    seed: randomSeed(),
    version: 1,
    versionNonce: randomSeed(),
    isDeleted: false,
    groupIds: [],
    frameId: null,
    boundElements: [],
    updated: Date.now(),
    link: null,
    locked: false,
    __zIndex: shape.zIndex,
  };
}

// Excalidraw has no native triangle element — rendered as a closed line polygon.
function exportTriangle(shape, fidelity) {
  fidelity.objects.push({ objectId: shape.id, level: "editable", issues: [] });

  const { x, y, width, height } = shape.bounds;
  const points = [
    [round(width / 2), 0],
    [round(width), round(height)],
    [0, round(height)],
    [round(width / 2), 0],
  ];

  return {
    id: shape.id,
    type: "line",
    x,
    y,
    width,
    height,
    angle: degreesToRadians(shape.transform.rotation),
    strokeColor: shape.style.color,
    backgroundColor:
      shape.fill.color === "transparent" ? "transparent" : shape.fill.color,
    fillStyle: shape.fill.color === "transparent" ? "none" : "solid",
    strokeWidth: shape.style.width,
    strokeStyle: shape.style.dash ?? "solid",
    roughness: 0,
    opacity: Math.round(shape.style.opacity * 100),
    roundness: null,
    points,
    lastCommittedPoint: points[points.length - 1],
    startBinding: null,
    endBinding: null,
    startArrowhead: null,
    endArrowhead: null,
    seed: randomSeed(),
    version: 1,
    versionNonce: randomSeed(),
    isDeleted: false,
    groupIds: [],
    frameId: null,
    boundElements: [],
    updated: Date.now(),
    link: null,
    locked: false,
    __zIndex: shape.zIndex,
  };
}

function exportStroke(stroke, fidelity) {
  fidelity.objects.push({ objectId: stroke.id, level: "editable", issues: [] });

  const bounds = stroke.bounds;
  const relPoints = stroke.points.map((p) => [
    round(p.x - bounds.x),
    round(p.y - bounds.y),
    p.pressure ?? 0.5,
  ]);

  return {
    id: stroke.id,
    type: "freedraw",
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    angle: degreesToRadians(stroke.transform.rotation),
    strokeColor: stroke.style.color,
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: stroke.style.width,
    strokeStyle: stroke.style.dash ?? "solid",
    roughness: 0,
    opacity: Math.round(stroke.style.opacity * 100),
    points: relPoints,
    pressures: relPoints.map((p) => p[2]),
    simulatePressure: false,
    lastCommittedPoint: relPoints[relPoints.length - 1] ?? null,
    seed: randomSeed(),
    version: 1,
    versionNonce: randomSeed(),
    isDeleted: false,
    groupIds: [],
    frameId: null,
    boundElements: [],
    updated: Date.now(),
    link: null,
    locked: false,
    __zIndex: stroke.zIndex,
  };
}

function exportLine(line, fidelity) {
  fidelity.objects.push({ objectId: line.id, level: "editable", issues: [] });

  const start = line.points[0];
  const x = start.x;
  const y = start.y;
  const relPoints = line.points.map((p) => [round(p.x - x), round(p.y - y)]);
  const isArrow = line.startArrow || line.endArrow;

  return {
    id: line.id,
    type: isArrow ? "arrow" : "line",
    x,
    y,
    width: Math.abs(line.points[line.points.length - 1].x - x),
    height: Math.abs(line.points[line.points.length - 1].y - y),
    angle: 0,
    strokeColor: line.style.color,
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: line.style.width,
    strokeStyle: line.style.dash ?? "solid",
    roughness: 0,
    opacity: Math.round(line.style.opacity * 100),
    points: relPoints,
    lastCommittedPoint: relPoints[relPoints.length - 1] ?? null,
    startBinding: null,
    endBinding: null,
    startArrowhead: line.startArrow ? "arrow" : null,
    endArrowhead: line.endArrow ? "arrow" : null,
    seed: randomSeed(),
    version: 1,
    versionNonce: randomSeed(),
    isDeleted: false,
    groupIds: [],
    frameId: null,
    boundElements: [],
    updated: Date.now(),
    link: null,
    locked: false,
    __zIndex: line.zIndex,
  };
}

function exportText(text, fidelity) {
  fidelity.objects.push({ objectId: text.id, level: "editable", issues: [] });

  return {
    id: text.id,
    type: "text",
    x: text.bounds.x,
    y: text.bounds.y,
    width: text.bounds.width,
    height: text.bounds.height,
    angle: degreesToRadians(text.transform.rotation),
    strokeColor: text.style.color,
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 1,
    strokeStyle: "solid",
    roughness: 0,
    opacity: Math.round(text.style.opacity * 100),
    text: text.text,
    fontSize: text.fontSize,
    fontFamily: mapFontFamily(text.fontFamily),
    textAlign: text.textAlign ?? "left",
    verticalAlign: "top",
    baseline: Math.round(text.fontSize * 0.8),
    containerId: null,
    originalText: text.text,
    lineHeight: 1.25,
    seed: randomSeed(),
    version: 1,
    versionNonce: randomSeed(),
    isDeleted: false,
    groupIds: [],
    frameId: null,
    boundElements: [],
    updated: Date.now(),
    link: null,
    locked: false,
    __zIndex: text.zIndex,
  };
}

function mapFontFamily(family) {
  if (!family) return 1;
  const lower = family.toLowerCase();
  if (lower.includes("virgil") || lower.includes("hand")) return 1;
  if (lower.includes("helvetica") || lower.includes("arial")) return 2;
  if (lower.includes("cascadia") || lower.includes("mono") || lower.includes("code"))
    return 3;
  return 1;
}

function degreesToRadians(deg) {
  return (deg * Math.PI) / 180;
}

function round(value) {
  return Math.round(value * 1000) / 1000;
}

function randomSeed() {
  return Math.floor(Math.random() * 2147483647);
}
