import { createBridgePayloadEnvelope, estimateSerializedSizeBytes, serializeBridgePayloadEnvelope, } from "../../core/bridgePayload.js";
import { createEmptyFidelityReport, mergeFidelityLevels, } from "../../core/fidelity.js";
import { recognizeShape } from "../../core/recognize.js";
import { simplifyPath } from "../../core/simplify.js";
// --- Shape type mapping ---
const CANONICAL_SHAPE_TO_MIRO = {
    rectangle: "rectangle",
    round_rectangle: "round_rectangle",
    ellipse: "circle",
    diamond: "rhombus",
    triangle: "triangle",
};
// --- Main exporters ---
const DEFAULT_PADDING = 8;
const DEFAULT_BRIDGE_METADATA_KEY = "vectorbridge";
const DEFAULT_APP_STORAGE_PREFIX = "vectorbridge.bridge";
const DEFAULT_MAX_INLINE_METADATA_BYTES = 6144;
export function exportDocumentToMiro(document, options) {
    const fidelity = createEmptyFidelityReport();
    const exportedItems = [];
    for (const object of Object.values(document.objects)) {
        const results = exportObject(object, options, fidelity);
        exportedItems.push(...results);
    }
    const bridge = createBridgePlan(document, exportedItems, options);
    if (bridge) {
        applyBridgeEditabilityToFidelity(document, fidelity);
    }
    return {
        items: exportedItems.map((entry) => entry.item),
        fidelity,
        bridge,
    };
}
export function exportDocumentToMiroWebSdk(document, options) {
    const restExport = exportDocumentToMiro(document, options);
    // Web SDK currently only supports image items from our export
    const imageItems = restExport.items.filter((item) => item.type === "image");
    return {
        items: imageItems.map(mapRestImageToWebSdkImage),
        fidelity: restExport.fidelity,
        bridge: restExport.bridge,
    };
}
// --- Per-object export dispatch ---
function exportObject(object, options, fidelity) {
    switch (object.kind) {
        case "stroke":
            return exportStrokeSmart(object, options, fidelity);
        case "shape":
            return [{ item: exportShape(object, fidelity), objectIds: [object.id] }];
        case "line":
            return [{ item: exportLine(object, fidelity), objectIds: [object.id] }];
        case "text":
            return [{ item: exportText(object, fidelity), objectIds: [object.id] }];
        default:
            pushUnsupportedIssue(fidelity, object);
            return [];
    }
}
// --- Smart Stroke Export (3-tier strategy) ---
//
// Tier 1: Shape recognition — if the freedraw looks like a known shape
//         (rectangle, ellipse, diamond, triangle, line), export as the
//         corresponding native Miro item.  Fully editable.
//
// Tier 2: Thin-rectangle segmentation — simplify the path with
//         Douglas-Peucker, then create a thin rotated rectangle for
//         each line segment.  Each piece is a native Miro shape that
//         the user can move, recolor, or delete.
//
// Tier 3: SVG image fallback (only if segmentation produces nothing).
function exportStrokeSmart(stroke, options, fidelity) {
    // --- Tier 1: Shape recognition ---
    const recognition = recognizeShape(stroke.points);
    if (recognition.recognized && recognition.shapeType && recognition.bounds) {
        if (recognition.shapeType === "line") {
            // Recognized as a straight line → connector-like thin rectangle
            const first = stroke.points[0];
            const last = stroke.points[stroke.points.length - 1];
            const seg = createThinRectangleSegment(first, last, stroke.style.width, stroke.style.color, stroke.style.opacity, stroke.id);
            fidelity.objects.push({
                objectId: stroke.id,
                level: "editable",
                issues: [{
                        code: "MIRO_STROKE_RECOGNIZED_LINE",
                        message: `Freedraw stroke was recognized as a straight line (${Math.round(recognition.confidence * 100)}% confidence) and exported as an editable rectangle.`,
                        level: "approximate",
                        objectId: stroke.id,
                    }],
            });
            return [{ item: seg, objectIds: [stroke.id] }];
        }
        // Recognized as a geometric shape → native Miro shape
        const miroShape = CANONICAL_SHAPE_TO_MIRO[recognition.shapeType] ?? "rectangle";
        const b = recognition.bounds;
        const item = {
            type: "shape",
            data: { shape: miroShape },
            style: {
                fillColor: "transparent",
                fillOpacity: "1",
                borderColor: stroke.style.color,
                borderWidth: String(roundNumber(stroke.style.width)),
                borderOpacity: String(roundNumber(stroke.style.opacity)),
                borderStyle: mapDashToBorderStyle(stroke.style.dash),
            },
            position: {
                x: b.x + b.width / 2,
                y: b.y + b.height / 2,
                origin: "center",
            },
            geometry: {
                width: normalizeSize(b.width),
                height: normalizeSize(b.height),
            },
        };
        const issue = {
            code: "MIRO_STROKE_RECOGNIZED_SHAPE",
            message: `Freedraw stroke was recognized as "${recognition.shapeType}" (${Math.round(recognition.confidence * 100)}% confidence) and exported as an editable native Miro shape.`,
            level: "approximate",
            objectId: stroke.id,
        };
        fidelity.issues.push(issue);
        fidelity.objects.push({
            objectId: stroke.id,
            level: "approximate",
            issues: [issue],
        });
        fidelity.level = mergeFidelityLevels(fidelity.level, issue.level);
        return [{ item, objectIds: [stroke.id] }];
    }
    // --- Tier 2: Thin-rectangle segmentation ---
    const simplified = simplifyPath(stroke.points, 4);
    if (simplified.length >= 2) {
        const segments = createThinRectangleSegments(simplified, stroke.style.width, stroke.style.color, stroke.style.opacity, stroke.id);
        if (segments.length > 0) {
            const issue = {
                code: "MIRO_STROKE_SEGMENTED",
                message: `Freedraw stroke was decomposed into ${segments.length} editable rectangle segments.`,
                level: "approximate",
                objectId: stroke.id,
            };
            fidelity.issues.push(issue);
            fidelity.objects.push({
                objectId: stroke.id,
                level: "approximate",
                issues: [issue],
            });
            fidelity.level = mergeFidelityLevels(fidelity.level, issue.level);
            return segments.map((segment) => ({
                item: segment,
                objectIds: [stroke.id],
            }));
        }
    }
    // --- Tier 3: SVG image fallback ---
    const item = exportStrokeToMiroImage(stroke, options);
    const issue = {
        code: "MIRO_STROKE_FALLBACK_IMAGE",
        message: "Exported stroke as an SVG-backed image (not editable) as a last resort.",
        level: "fallback",
        objectId: stroke.id,
    };
    fidelity.issues.push(issue);
    fidelity.objects.push({
        objectId: stroke.id,
        level: "fallback",
        issues: [issue],
    });
    fidelity.level = mergeFidelityLevels(fidelity.level, issue.level);
    return [{ item, objectIds: [stroke.id] }];
}
// --- Thin-rectangle segment creation ---
function createThinRectangleSegments(points, strokeWidth, color, opacity, parentId) {
    const segments = [];
    for (let i = 0; i < points.length - 1; i++) {
        segments.push(createThinRectangleSegment(points[i], points[i + 1], strokeWidth, color, opacity, `${parentId}-seg${i}`));
    }
    return segments;
}
function createThinRectangleSegment(from, to, strokeWidth, color, opacity, id) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
    // Center of the segment
    const cx = (from.x + to.x) / 2;
    const cy = (from.y + to.y) / 2;
    // The rectangle's width = segment length, height = stroke thickness
    const height = Math.max(strokeWidth * 2, 4);
    return {
        type: "shape",
        data: { shape: "round_rectangle" },
        style: {
            fillColor: color,
            fillOpacity: String(roundNumber(opacity)),
            borderColor: color,
            borderWidth: "0",
            borderOpacity: "0",
            borderStyle: "normal",
        },
        position: {
            x: roundNumber(cx),
            y: roundNumber(cy),
            origin: "center",
        },
        geometry: {
            width: roundNumber(normalizeSize(length)),
            height: roundNumber(height),
            rotation: roundNumber(angle),
        },
    };
}
// --- Shape → Native Miro Shape (editable!) ---
function exportShape(shape, fidelity) {
    const miroShape = CANONICAL_SHAPE_TO_MIRO[shape.shapeType] ?? "rectangle";
    const cx = shape.bounds.x + shape.bounds.width / 2;
    const cy = shape.bounds.y + shape.bounds.height / 2;
    const fillColor = shape.fill.color === "transparent" ? "transparent" : shape.fill.color;
    fidelity.objects.push({
        objectId: shape.id,
        level: "editable",
        issues: [],
    });
    return {
        type: "shape",
        data: {
            shape: miroShape,
            content: shape.label ? `<p>${escapeXml(shape.label)}</p>` : undefined,
        },
        style: {
            fillColor,
            fillOpacity: String(roundNumber(shape.fill.opacity)),
            borderColor: shape.style.color,
            borderWidth: String(roundNumber(shape.style.width)),
            borderOpacity: String(roundNumber(shape.style.opacity)),
            borderStyle: mapDashToBorderStyle(shape.style.dash),
        },
        position: {
            x: cx,
            y: cy,
            origin: "center",
        },
        geometry: {
            width: normalizeSize(shape.bounds.width),
            height: normalizeSize(shape.bounds.height),
            rotation: roundNumber(shape.transform.rotation),
        },
    };
}
// --- Line / Arrow → Connector (editable!) ---
function exportLine(line, fidelity) {
    const startPoint = line.points[0];
    const endPoint = line.points[line.points.length - 1];
    // Multi-segment lines lose intermediate points when mapped to connectors
    if (line.points.length > 2) {
        const issue = {
            code: "MIRO_LINE_SIMPLIFIED",
            message: "Multi-segment line was simplified to a straight connector (start→end). Intermediate points were discarded.",
            level: "approximate",
            objectId: line.id,
        };
        fidelity.issues.push(issue);
        fidelity.objects.push({
            objectId: line.id,
            level: "approximate",
            issues: [issue],
        });
        fidelity.level = mergeFidelityLevels(fidelity.level, issue.level);
    }
    else {
        fidelity.objects.push({
            objectId: line.id,
            level: "editable",
            issues: [],
        });
    }
    return {
        type: "connector",
        data: {
            shape: "straight",
        },
        style: {
            strokeColor: line.style.color,
            strokeWidth: String(roundNumber(line.style.width)),
            strokeStyle: mapDashToStrokeStyle(line.style.dash),
            startStrokeCap: line.startArrow ? "filled_arrow" : "none",
            endStrokeCap: line.endArrow ? "filled_arrow" : "none",
        },
        startPosition: { x: startPoint.x, y: startPoint.y },
        endPosition: { x: endPoint.x, y: endPoint.y },
    };
}
// --- Text → Native Miro Text (editable!) ---
function exportText(text, fidelity) {
    const cx = text.bounds.x + text.bounds.width / 2;
    const cy = text.bounds.y + text.bounds.height / 2;
    fidelity.objects.push({
        objectId: text.id,
        level: "editable",
        issues: [],
    });
    return {
        type: "text",
        data: {
            content: `<p>${escapeXml(text.text)}</p>`,
        },
        style: {
            color: text.style.color,
            fillColor: "transparent",
            fillOpacity: "1",
            fontFamily: mapFontFamily(text.fontFamily),
            fontSize: String(Math.round(text.fontSize)),
            textAlign: text.textAlign,
        },
        position: {
            x: cx,
            y: cy,
            origin: "center",
        },
        geometry: {
            width: normalizeSize(text.bounds.width),
            rotation: roundNumber(text.transform.rotation),
        },
    };
}
// --- SVG image export for strokes (unchanged from before) ---
export function exportStrokeToMiroImage(stroke, options) {
    const padding = options?.strokePadding ?? DEFAULT_PADDING;
    const bounds = expandBounds(stroke.bounds, padding);
    const titlePrefix = options?.itemTitlePrefix ?? "VectorBridge Stroke";
    return {
        type: "image",
        data: {
            url: buildStrokeSvgDataUrl(stroke, bounds),
            title: `${titlePrefix} ${stroke.id}`,
        },
        position: {
            x: bounds.x + bounds.width / 2,
            y: bounds.y + bounds.height / 2,
            origin: "center",
        },
        geometry: {
            width: normalizeSize(bounds.width),
            height: normalizeSize(bounds.height),
        },
    };
}
function buildStrokeSvgDataUrl(stroke, bounds) {
    const points = stroke.points
        .map((point, index) => {
        const prefix = index === 0 ? "M" : "L";
        const x = roundNumber(point.x - bounds.x);
        const y = roundNumber(point.y - bounds.y);
        return `${prefix} ${x} ${y}`;
    })
        .join(" ");
    const dashArray = mapDashToSvg(stroke.style.dash, stroke.style.width);
    const svg = [
        `<svg xmlns="http://www.w3.org/2000/svg" width="${roundNumber(normalizeSize(bounds.width))}" height="${roundNumber(normalizeSize(bounds.height))}" viewBox="0 0 ${roundNumber(normalizeSize(bounds.width))} ${roundNumber(normalizeSize(bounds.height))}">`,
        `<path d="${points}" fill="none" stroke="${escapeXml(stroke.style.color)}" stroke-width="${roundNumber(stroke.style.width)}" stroke-opacity="${roundNumber(stroke.style.opacity)}" stroke-linecap="round" stroke-linejoin="round"${dashArray ? ` stroke-dasharray="${dashArray}"` : ""} />`,
        "</svg>",
    ].join("");
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
// --- Web SDK helper ---
function mapRestImageToWebSdkImage(item) {
    return {
        url: item.data.url,
        title: item.data.title,
        x: item.position.x,
        y: item.position.y,
        width: item.geometry.width,
        height: item.geometry.height,
    };
}
function createBridgePlan(document, exportedItems, options) {
    if ((options?.bridgeEditability ?? "auto") === "off" || exportedItems.length === 0) {
        return undefined;
    }
    const bridgeId = sanitizeBridgeId(document.id);
    const metadataKey = options?.bridgeMetadataKey ?? DEFAULT_BRIDGE_METADATA_KEY;
    const envelope = createBridgePayloadEnvelope(document, {
        bridgeId,
        sourceApp: getDocumentSourceApp(document),
        sourceFormat: "canonical-document",
        storageHints: [
            {
                targetApp: "miro",
                strategy: "miro_item_metadata",
                key: metadataKey,
                maxInlineBytes: options?.maxInlineMetadataBytes ?? DEFAULT_MAX_INLINE_METADATA_BYTES,
            },
            {
                targetApp: "miro",
                strategy: "miro_app_storage",
                key: `${options?.appStorageKeyPrefix ?? DEFAULT_APP_STORAGE_PREFIX}.${bridgeId}`,
            },
        ],
    });
    const serializedEnvelope = serializeBridgePayloadEnvelope(envelope);
    const serializedEnvelopeBytes = estimateSerializedSizeBytes(serializedEnvelope);
    const inlineLimit = options?.maxInlineMetadataBytes ?? DEFAULT_MAX_INLINE_METADATA_BYTES;
    const canInline = doesInlineMetadataFit(metadataKey, serializedEnvelope, exportedItems[0]?.objectIds ?? [], inlineLimit);
    if (canInline) {
        return {
            bridgeId,
            envelope,
            serializedEnvelope,
            serializedEnvelopeBytes,
            storageStrategy: "miro_item_metadata",
            metadataKey,
            bindings: exportedItems.map((entry, itemIndex) => ({
                itemIndex,
                objectIds: entry.objectIds,
                metadataKey,
                value: createInlineMetadataValue(bridgeId, serializedEnvelope, entry.objectIds),
            })),
            appStorageRecords: [],
        };
    }
    const appStorageKey = `${options?.appStorageKeyPrefix ?? DEFAULT_APP_STORAGE_PREFIX}.${bridgeId}`;
    return {
        bridgeId,
        envelope,
        serializedEnvelope,
        serializedEnvelopeBytes,
        storageStrategy: "miro_app_storage",
        metadataKey,
        bindings: exportedItems.map((entry, itemIndex) => ({
            itemIndex,
            objectIds: entry.objectIds,
            metadataKey,
            value: createPointerMetadataValue(bridgeId, appStorageKey, entry.objectIds),
        })),
        appStorageRecords: [
            {
                key: appStorageKey,
                value: serializedEnvelope,
            },
        ],
    };
}
function applyBridgeEditabilityToFidelity(document, fidelity) {
    let bridged = false;
    for (const objectFidelity of fidelity.objects) {
        const object = document.objects[objectFidelity.objectId];
        if (!object || object.kind !== "stroke") {
            continue;
        }
        if (objectFidelity.level !== "approximate" &&
            objectFidelity.level !== "fallback") {
            continue;
        }
        const issue = {
            code: "MIRO_BRIDGE_PAYLOAD_ATTACHED",
            message: "Attached a hidden VectorBridge payload plan so the original stroke can be recovered later even if the visible Miro representation is partial.",
            level: "bridge_editable",
            objectId: object.id,
        };
        objectFidelity.level = "bridge_editable";
        objectFidelity.issues.push(issue);
        fidelity.issues.push(issue);
        bridged = true;
    }
    if (bridged) {
        fidelity.level = mergeFidelityLevels(fidelity.level, "bridge_editable");
    }
}
function createInlineMetadataValue(bridgeId, payload, objectIds) {
    return {
        kind: "vectorbridge-envelope",
        version: "1.0",
        bridgeId,
        objectIds,
        payload,
    };
}
function createPointerMetadataValue(bridgeId, storageKey, objectIds) {
    return {
        kind: "vectorbridge-pointer",
        version: "1.0",
        bridgeId,
        objectIds,
        storage: {
            strategy: "miro_app_storage",
            key: storageKey,
        },
    };
}
function doesInlineMetadataFit(metadataKey, payload, objectIds, limitBytes) {
    const value = createInlineMetadataValue("size-check", payload, objectIds);
    const serialized = JSON.stringify({
        metadataKey,
        value,
    });
    return estimateSerializedSizeBytes(serialized) <= limitBytes;
}
function sanitizeBridgeId(value) {
    const normalized = value.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
    const collapsed = normalized.replace(/^-+|-+$/g, "");
    return collapsed || "document";
}
function getDocumentSourceApp(document) {
    const metadata = document.metadata;
    if (metadata &&
        typeof metadata === "object" &&
        typeof metadata.sourceApp === "string") {
        return metadata.sourceApp;
    }
    return "unknown";
}
// --- Utility functions ---
function mapDashToSvg(dash, width) {
    if (dash === "dashed") {
        return `${roundNumber(width * 3)} ${roundNumber(width * 2)}`;
    }
    if (dash === "dotted") {
        return `${roundNumber(width)} ${roundNumber(width * 1.5)}`;
    }
    return null;
}
function mapDashToBorderStyle(dash) {
    if (dash === "dashed")
        return "dashed";
    if (dash === "dotted")
        return "dotted";
    return "normal";
}
function mapDashToStrokeStyle(dash) {
    if (dash === "dashed")
        return "dashed";
    if (dash === "dotted")
        return "dotted";
    return "normal";
}
function mapFontFamily(family) {
    const lower = family.toLowerCase();
    if (lower.includes("helvetica") || lower.includes("arial"))
        return "arial";
    if (lower.includes("cascadia") || lower.includes("mono"))
        return "cursive";
    return "arial";
}
function pushUnsupportedIssue(fidelity, object) {
    const issue = {
        code: "MIRO_UNSUPPORTED_OBJECT",
        message: `Skipped unsupported canonical object kind "${String(object.kind)}".`,
        level: "unsupported",
        objectId: object.id,
    };
    fidelity.issues.push(issue);
    fidelity.objects.push({
        objectId: object.id,
        level: "unsupported",
        issues: [issue],
    });
    fidelity.level = mergeFidelityLevels(fidelity.level, issue.level);
}
function expandBounds(bounds, padding) {
    return {
        x: bounds.x - padding,
        y: bounds.y - padding,
        width: bounds.width + padding * 2,
        height: bounds.height + padding * 2,
    };
}
function normalizeSize(value) {
    return Math.max(1, value);
}
function roundNumber(value) {
    return Math.round(value * 1000) / 1000;
}
function escapeXml(value) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}
//# sourceMappingURL=export.js.map