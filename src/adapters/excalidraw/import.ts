import { getBoundsForPoints } from "../../core/bounds.js";
import {
  createEmptyFidelityReport,
  mergeFidelityLevels,
  type FidelityIssue,
  type FidelityReport,
} from "../../core/fidelity.js";
import type {
  Bounds,
  CanonicalDocument,
  CanonicalLine,
  CanonicalObject,
  CanonicalShape,
  CanonicalStroke,
  CanonicalText,
  Point,
  ShapeType,
  StrokeStyle,
  Transform,
} from "../../core/types.js";

type ExcalidrawPrimitivePoint = [number, number] | [number, number, number];

export interface ExcalidrawElementBase {
  id: string;
  type: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  angle?: number;
  opacity?: number;
  strokeColor?: string;
  strokeStyle?: "solid" | "dashed" | "dotted";
  strokeWidth?: number;
  backgroundColor?: string;
  fillStyle?: string;
  index?: string;
  seed?: number;
  version?: number;
  versionNonce?: number;
}

export interface ExcalidrawFreedrawElement extends ExcalidrawElementBase {
  type: "freedraw";
  points: ExcalidrawPrimitivePoint[];
  pressures?: number[];
  simulatePressure?: boolean;
  lastCommittedPoint?: ExcalidrawPrimitivePoint | null;
}

export interface ExcalidrawShapeElement extends ExcalidrawElementBase {
  type: "rectangle" | "ellipse" | "diamond" | "triangle";
  width: number;
  height: number;
  roundness?: { type: number; value?: number } | null;
}

export interface ExcalidrawLineElement extends ExcalidrawElementBase {
  type: "line" | "arrow";
  points: ExcalidrawPrimitivePoint[];
  startArrowhead?: string | null;
  endArrowhead?: string | null;
}

export interface ExcalidrawTextElement extends ExcalidrawElementBase {
  type: "text";
  text: string;
  fontSize: number;
  fontFamily: number;
  textAlign: "left" | "center" | "right";
  width: number;
  height: number;
}

export interface ExcalidrawScene {
  type?: string;
  version?: number;
  source?: string;
  elements: ExcalidrawElementBase[];
  appState?: Record<string, unknown>;
  files?: Record<string, unknown>;
}

export interface ImportResult {
  document: CanonicalDocument;
  fidelity: FidelityReport;
}

// --- Type guards ---

function isFreedrawElement(
  element: ExcalidrawElementBase,
): element is ExcalidrawFreedrawElement {
  return (
    element.type === "freedraw" &&
    "points" in element &&
    Array.isArray(
      (element as Partial<ExcalidrawFreedrawElement>).points,
    )
  );
}

const SHAPE_TYPES = new Set(["rectangle", "ellipse", "diamond", "triangle"]);

function isShapeElement(
  element: ExcalidrawElementBase,
): element is ExcalidrawShapeElement {
  return (
    SHAPE_TYPES.has(element.type) &&
    typeof element.width === "number" &&
    typeof element.height === "number"
  );
}

function isLineElement(
  element: ExcalidrawElementBase,
): element is ExcalidrawLineElement {
  return (
    (element.type === "line" || element.type === "arrow") &&
    "points" in element &&
    Array.isArray((element as Partial<ExcalidrawLineElement>).points)
  );
}

function isTextElement(
  element: ExcalidrawElementBase,
): element is ExcalidrawTextElement {
  return (
    element.type === "text" &&
    "text" in element &&
    typeof (element as Partial<ExcalidrawTextElement>).text === "string"
  );
}

// --- Constants ---

const DEFAULT_TRANSFORM: Transform = {
  x: 0,
  y: 0,
  scaleX: 1,
  scaleY: 1,
  rotation: 0,
};

// --- Main importer ---

export function importExcalidrawScene(
  scene: ExcalidrawScene,
  options?: {
    documentId?: string;
    title?: string;
    pageId?: string;
    pageName?: string;
  },
): ImportResult {
  const fidelity = createEmptyFidelityReport();
  const objects: CanonicalDocument["objects"] = {};
  const pageId = options?.pageId ?? "page-1";

  for (const element of scene.elements) {
    const result = importElement(element);

    if (result === null) {
      pushIssue(
        fidelity,
        {
          code: "EXCALIDRAW_UNSUPPORTED_ELEMENT",
          message: `Skipped unsupported Excalidraw element type "${element.type}".`,
          level: "unsupported",
          objectId: element.id,
        },
        element.id,
      );
      continue;
    }

    objects[result.id] = result;
    fidelity.objects.push({
      objectId: result.id,
      level: "editable",
      issues: [],
    });
  }

  const document: CanonicalDocument = {
    version: "1.0",
    id: options?.documentId ?? scene.source ?? "excalidraw-document",
    title: options?.title ?? "Imported Excalidraw Scene",
    objects,
    pages: [
      {
        id: pageId,
        name: options?.pageName ?? "Page 1",
        objectIds: Object.keys(objects),
      },
    ],
    activePageId: pageId,
    metadata: {
      sourceApp: "excalidraw",
      sourceVersion: scene.version,
      excalidraw: {
        type: scene.type,
        appState: scene.appState,
      },
    },
  };

  return { document, fidelity };
}

function importElement(element: ExcalidrawElementBase): CanonicalObject | null {
  if (isFreedrawElement(element)) {
    return mapFreedrawElement(element);
  }
  if (isShapeElement(element)) {
    return mapShapeElement(element);
  }
  if (isLineElement(element)) {
    return mapLineElement(element);
  }
  if (isTextElement(element)) {
    return mapTextElement(element);
  }
  return null;
}

// --- Freedraw mapping (existing) ---

function mapFreedrawElement(
  element: ExcalidrawFreedrawElement,
): CanonicalStroke | null {
  const points = mapFreedrawPoints(element);

  if (points.length === 0) {
    return null;
  }

  return {
    id: element.id,
    kind: "stroke",
    points,
    style: mapStrokeStyle(element),
    transform: {
      ...DEFAULT_TRANSFORM,
      rotation: radiansToDegrees(element.angle ?? 0),
    },
    bounds: getBoundsForPoints(points),
    zIndex: parseElementIndex(element.index),
    metadata: {
      sourceApp: "excalidraw",
      excalidraw: {
        seed: element.seed,
        version: element.version,
        versionNonce: element.versionNonce,
        simulatePressure: element.simulatePressure,
      },
    },
  };
}

// --- Shape mapping (NEW) ---

const EXCALIDRAW_TO_CANONICAL_SHAPE: Record<string, ShapeType> = {
  rectangle: "rectangle",
  ellipse: "ellipse",
  diamond: "diamond",
  triangle: "triangle",
};

function mapShapeElement(element: ExcalidrawShapeElement): CanonicalShape {
  const shapeType = EXCALIDRAW_TO_CANONICAL_SHAPE[element.type] ?? "rectangle";

  // Determine if rectangle has roundness
  const resolvedShape: ShapeType =
    shapeType === "rectangle" && element.roundness
      ? "round_rectangle"
      : shapeType;

  const bounds: Bounds = {
    x: element.x,
    y: element.y,
    width: element.width,
    height: element.height,
  };

  return {
    id: element.id,
    kind: "shape",
    shapeType: resolvedShape,
    style: mapStrokeStyle(element),
    fill: {
      color: element.backgroundColor ?? "transparent",
      opacity: normalizeOpacity(element.opacity),
    },
    transform: {
      ...DEFAULT_TRANSFORM,
      rotation: radiansToDegrees(element.angle ?? 0),
    },
    bounds,
    zIndex: parseElementIndex(element.index),
    label: undefined,
    metadata: {
      sourceApp: "excalidraw",
      excalidraw: {
        seed: element.seed,
        version: element.version,
        versionNonce: element.versionNonce,
        fillStyle: element.fillStyle,
      },
    },
  };
}

// --- Line / Arrow mapping (NEW) ---

function mapLineElement(element: ExcalidrawLineElement): CanonicalLine | null {
  const points = mapLinePoints(element);

  if (points.length < 2) {
    return null;
  }

  return {
    id: element.id,
    kind: "line",
    points,
    style: mapStrokeStyle(element),
    transform: {
      ...DEFAULT_TRANSFORM,
      rotation: radiansToDegrees(element.angle ?? 0),
    },
    bounds: getBoundsForPoints(points),
    zIndex: parseElementIndex(element.index),
    startArrow: element.type === "arrow" && !!element.startArrowhead,
    endArrow: element.type === "arrow" ? (element.endArrowhead !== null && element.endArrowhead !== undefined) : false,
    metadata: {
      sourceApp: "excalidraw",
      excalidraw: {
        seed: element.seed,
        version: element.version,
        versionNonce: element.versionNonce,
        startArrowhead: element.startArrowhead,
        endArrowhead: element.endArrowhead,
      },
    },
  };
}

// --- Text mapping (NEW) ---

const EXCALIDRAW_FONT_MAP: Record<number, string> = {
  1: "Virgil",
  2: "Helvetica",
  3: "Cascadia",
  4: "Assistant",
};

function mapTextElement(element: ExcalidrawTextElement): CanonicalText {
  const bounds: Bounds = {
    x: element.x,
    y: element.y,
    width: element.width,
    height: element.height,
  };

  return {
    id: element.id,
    kind: "text",
    text: element.text,
    fontSize: element.fontSize,
    fontFamily: EXCALIDRAW_FONT_MAP[element.fontFamily] ?? "Virgil",
    textAlign: element.textAlign ?? "left",
    style: mapStrokeStyle(element),
    transform: {
      ...DEFAULT_TRANSFORM,
      rotation: radiansToDegrees(element.angle ?? 0),
    },
    bounds,
    zIndex: parseElementIndex(element.index),
    metadata: {
      sourceApp: "excalidraw",
      excalidraw: {
        seed: element.seed,
        version: element.version,
        versionNonce: element.versionNonce,
      },
    },
  };
}

// --- Point mapping helpers ---

function mapFreedrawPoints(element: ExcalidrawFreedrawElement): Point[] {
  const points: Array<Point | null> = element.points.map((point, index) => {
      const x = point[0];
      const y = point[1];

      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        return null;
      }

      const pressureFromTuple = point.length >= 3 ? point[2] : undefined;
      const pressureFromArray = element.pressures?.[index];
      const pressure =
        typeof pressureFromTuple === "number"
          ? pressureFromTuple
          : pressureFromArray;

      return {
        x: element.x + x,
        y: element.y + y,
        pressure,
        t: index,
      };
    });

  return points.filter((point): point is Point => point !== null);
}

function mapLinePoints(element: ExcalidrawLineElement): Point[] {
  const points: Array<Point | null> = element.points.map((point, index) => {
    const x = point[0];
    const y = point[1];

    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return null;
    }

    return {
      x: element.x + x,
      y: element.y + y,
      t: index,
    };
  });

  return points.filter((point): point is Point => point !== null);
}

// --- Style helpers ---

function mapStrokeStyle(element: ExcalidrawElementBase): StrokeStyle {
  return {
    color: element.strokeColor ?? "#000000",
    width: element.strokeWidth ?? 1,
    opacity: normalizeOpacity(element.opacity),
    dash: element.strokeStyle ?? "solid",
  };
}

function normalizeOpacity(opacity?: number): number {
  if (typeof opacity !== "number" || Number.isNaN(opacity)) {
    return 1;
  }

  if (opacity > 1) {
    return Math.max(0, Math.min(1, opacity / 100));
  }

  return Math.max(0, Math.min(1, opacity));
}

function parseElementIndex(index?: string): number {
  if (!index) {
    return 0;
  }

  const normalized = Number.parseInt(index, 36);
  return Number.isNaN(normalized) ? 0 : normalized;
}

function radiansToDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

function pushIssue(
  report: FidelityReport,
  issue: FidelityIssue,
  objectId: string,
): void {
  report.issues.push(issue);
  report.level = mergeFidelityLevels(report.level, issue.level);
  report.objects.push({
    objectId,
    level: issue.level,
    issues: [issue],
  });
}
