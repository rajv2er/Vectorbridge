import { getBoundsForPoints } from "../../core/bounds.js";
import { createEmptyFidelityReport, mergeFidelityLevels, } from "../../core/fidelity.js";
// --- Type guards ---
function isFreedrawElement(element) {
    return (element.type === "freedraw" &&
        "points" in element &&
        Array.isArray(element.points));
}
const SHAPE_TYPES = new Set(["rectangle", "ellipse", "diamond", "triangle"]);
function isShapeElement(element) {
    return (SHAPE_TYPES.has(element.type) &&
        typeof element.width === "number" &&
        typeof element.height === "number");
}
function isLineElement(element) {
    return ((element.type === "line" || element.type === "arrow") &&
        "points" in element &&
        Array.isArray(element.points));
}
function isTextElement(element) {
    return (element.type === "text" &&
        "text" in element &&
        typeof element.text === "string");
}
// --- Constants ---
const DEFAULT_TRANSFORM = {
    x: 0,
    y: 0,
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
};
// --- Main importer ---
export function importExcalidrawScene(scene, options) {
    const fidelity = createEmptyFidelityReport();
    const objects = {};
    const pageId = options?.pageId ?? "page-1";
    for (const element of scene.elements) {
        const result = importElement(element);
        if (result === null) {
            pushIssue(fidelity, {
                code: "EXCALIDRAW_UNSUPPORTED_ELEMENT",
                message: `Skipped unsupported Excalidraw element type "${element.type}".`,
                level: "unsupported",
                objectId: element.id,
            }, element.id);
            continue;
        }
        objects[result.id] = result;
        fidelity.objects.push({
            objectId: result.id,
            level: "editable",
            issues: [],
        });
    }
    const document = {
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
function importElement(element) {
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
function mapFreedrawElement(element) {
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
const EXCALIDRAW_TO_CANONICAL_SHAPE = {
    rectangle: "rectangle",
    ellipse: "ellipse",
    diamond: "diamond",
    triangle: "triangle",
};
function mapShapeElement(element) {
    const shapeType = EXCALIDRAW_TO_CANONICAL_SHAPE[element.type] ?? "rectangle";
    // Determine if rectangle has roundness
    const resolvedShape = shapeType === "rectangle" && element.roundness
        ? "round_rectangle"
        : shapeType;
    const bounds = {
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
function mapLineElement(element) {
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
const EXCALIDRAW_FONT_MAP = {
    1: "Virgil",
    2: "Helvetica",
    3: "Cascadia",
    4: "Assistant",
};
function mapTextElement(element) {
    const bounds = {
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
function mapFreedrawPoints(element) {
    const points = element.points.map((point, index) => {
        const x = point[0];
        const y = point[1];
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
            return null;
        }
        const pressureFromTuple = point.length >= 3 ? point[2] : undefined;
        const pressureFromArray = element.pressures?.[index];
        const pressure = typeof pressureFromTuple === "number"
            ? pressureFromTuple
            : pressureFromArray;
        return {
            x: element.x + x,
            y: element.y + y,
            pressure,
            t: index,
        };
    });
    return points.filter((point) => point !== null);
}
function mapLinePoints(element) {
    const points = element.points.map((point, index) => {
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
    return points.filter((point) => point !== null);
}
// --- Style helpers ---
function mapStrokeStyle(element) {
    return {
        color: element.strokeColor ?? "#000000",
        width: element.strokeWidth ?? 1,
        opacity: normalizeOpacity(element.opacity),
        dash: element.strokeStyle ?? "solid",
    };
}
function normalizeOpacity(opacity) {
    if (typeof opacity !== "number" || Number.isNaN(opacity)) {
        return 1;
    }
    if (opacity > 1) {
        return Math.max(0, Math.min(1, opacity / 100));
    }
    return Math.max(0, Math.min(1, opacity));
}
function parseElementIndex(index) {
    if (!index) {
        return 0;
    }
    const normalized = Number.parseInt(index, 36);
    return Number.isNaN(normalized) ? 0 : normalized;
}
function radiansToDegrees(radians) {
    return (radians * 180) / Math.PI;
}
function pushIssue(report, issue, objectId) {
    report.issues.push(issue);
    report.level = mergeFidelityLevels(report.level, issue.level);
    report.objects.push({
        objectId,
        level: issue.level,
        issues: [issue],
    });
}
//# sourceMappingURL=import.js.map