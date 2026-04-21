/**
 * Converts a decoded miro-data-v1 clipboard payload into a CanonicalDocument.
 *
 * Miro shape codes (verified from real clipboard inspection):
 *   "3" = rectangle, "4" = ellipse, "5" = triangle, "8" = diamond
 *
 * Miro line type (lt) values:
 *   0 = straight, 1 = elbow, 2 = curved, 9 = block arrow
 *   Elbow and curved connectors are imported as straight lines since
 *   intermediate waypoints are not present in the clipboard payload.
 */
import { getBoundsForPoints } from "../../core/bounds.js";
import { createEmptyFidelityReport, mergeFidelityLevels } from "../../core/fidelity.js";

const MIRO_SHAPE_TO_CANONICAL = {
  "3": "rectangle",
  "4": "ellipse",
  "5": "triangle",
  "8": "diamond",
  r: "rectangle",
  rr: "round_rectangle",
  h: "diamond",
  tr: "triangle",
  triangle: "triangle",
  circle: "ellipse",
  rhombus: "diamond",
};

function resolveShapeType(miroCode) {
  return MIRO_SHAPE_TO_CANONICAL[miroCode] ?? null;
}

const DEFAULT_TRANSFORM = { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 };

export function importMiroClipboard(payload, options) {
  const fidelity = createEmptyFidelityReport();
  const objects = {};
  const pageId = options?.pageId ?? "page-1";
  const widgets = payload?.data?.objects ?? [];

  for (const widget of widgets) {
    const id = String(widget.initialId ?? widget.id ?? generateId());
    const result = importWidget(widget, id, widgets);

    if (!result) {
      pushIssue(
        fidelity,
        {
          code: "MIRO_UNSUPPORTED_WIDGET",
          message: `Skipped unsupported Miro widget type "${widget.widgetData?.type ?? "unknown"}".`,
          level: "unsupported",
          objectId: id,
        },
        id
      );
      continue;
    }

    if (result.__unknownShapeCode !== undefined) {
      pushIssue(
        fidelity,
        {
          code: "MIRO_UNKNOWN_SHAPE_CODE",
          message:
            `Skipped shape with unknown Miro code "${result.__unknownShapeCode}". ` +
            `Use "Inspect Miro copy" to see the raw code and report it so the mapping can be added.`,
          level: "unsupported",
          objectId: result.__id,
        },
        result.__id
      );
      continue;
    }

    objects[result.id] = result;
    fidelity.objects.push({ objectId: result.id, level: "editable", issues: [] });
  }

  const document = {
    version: "1.0",
    id: options?.documentId ?? `miro-${Date.now()}`,
    title: options?.title ?? "Imported from Miro",
    objects,
    pages: [
      {
        id: pageId,
        name: options?.pageName ?? "Page 1",
        objectIds: Object.keys(objects),
      },
    ],
    activePageId: pageId,
    metadata: { sourceApp: "miro" },
  };

  return { document, fidelity };
}

function importWidget(widget, id, allWidgets) {
  const wType = widget.widgetData?.type;
  const json = tryParseJson(widget.widgetData?.json);
  if (!json) return null;

  switch (wType) {
    case "shape": {
      const result = importShapeWidget(json, id);
      if (!result) return { __unknownShapeCode: json.shape ?? "?", __id: id };
      return result;
    }
    case "paint":
      return importPaintWidget(json, id);
    case "line":
      return importLineWidget(json, id, allWidgets);
    case "divider":
      return importDividerWidget(json, id);
    default:
      return null;
  }
}

function importShapeWidget(json, id) {
  const miroShape = json.shape ?? "";
  const shapeType = resolveShapeType(miroShape);
  if (!shapeType) return null;

  const pos = json._position?.offsetPx ?? { x: 0, y: 0 };
  const size = json.size ?? { width: 100, height: 100 };
  const style = tryParseJson(json.style) ?? {};

  const x = pos.x - size.width / 2;
  const y = pos.y - size.height / 2;
  const bounds = { x, y, width: size.width, height: size.height };
  const plainText = stripHtml(json.text ?? "").trim();

  const strokeColor = intToHex(style.sc ?? style.brc ?? 0);
  const fillColor = style.bc === -1 ? "transparent" : intToHex(style.bc ?? 0xffffff);
  const strokeWidth = typeof style.brw === "number" ? style.brw : 2;
  const opacity = typeof style.bro === "number" ? style.bro : 1;
  const rotation = json.rotation?.rotation ?? json.relativeRotation ?? 0;

  return {
    id,
    kind: "shape",
    shapeType,
    style: { color: strokeColor, width: strokeWidth, opacity, dash: "solid" },
    fill: { color: fillColor, opacity },
    transform: { ...DEFAULT_TRANSFORM, rotation },
    bounds,
    zIndex: 0,
    label: plainText || undefined,
    metadata: { sourceApp: "miro" },
  };
}

function importPaintWidget(json, id) {
  const pos = json._position?.offsetPx ?? { x: 0, y: 0 };
  const size = json.size ?? { width: 10, height: 10 };
  const rawPts = json.points ?? [];
  const style = tryParseJson(json.style) ?? {};

  if (rawPts.length < 2) return null;

  const originX = pos.x - size.width / 2;
  const originY = pos.y - size.height / 2;

  const points = rawPts.map((p, i) => ({
    x: originX + (p.x ?? 0),
    y: originY + (p.y ?? 0),
    t: i,
  }));

  const strokeWidth = typeof style.e === "number" ? Math.max(1, style.e * 11) : 2;
  const strokeColor = intToHex(style.lc ?? 0);
  const opacity = typeof style.lo === "number" ? style.lo : 1;
  const rotation = json.rotation?.rotation ?? json.relativeRotation ?? 0;

  return {
    id,
    kind: "stroke",
    points,
    style: { color: strokeColor, width: strokeWidth, opacity, dash: "solid" },
    transform: { ...DEFAULT_TRANSFORM, rotation },
    bounds: getBoundsForPoints(points),
    zIndex: 0,
    metadata: { sourceApp: "miro" },
  };
}

function importLineWidget(json, id, allWidgets) {
  const style = tryParseJson(json.style) ?? {};
  const primary = json.primary;
  const secondary = json.secondary;

  if (!primary || !secondary) return null;

  const start = resolveEndpoint(primary, allWidgets);
  const end = resolveEndpoint(secondary, allWidgets);

  if (!start || !end) return null;

  const points = [
    { x: start.x, y: start.y, t: 0 },
    { x: end.x, y: end.y, t: 1 },
  ];

  const strokeColor = intToHex(style.lc ?? style.sc ?? 0);
  const strokeWidth = typeof style.lw === "number" ? style.lw : 2;
  const opacity = typeof style.lo === "number" ? style.lo : 1;
  const dash = miroLineStyleToDash(style.ls);
  const lt = style.lt ?? 0;

  const endArrow = lt !== 9 && (style.a_end ?? 0) !== 0;
  const startArrow = lt !== 9 && (style.a_start ?? 0) !== 0;

  return {
    id,
    kind: "line",
    points,
    style: { color: strokeColor, width: strokeWidth, opacity, dash },
    transform: { ...DEFAULT_TRANSFORM },
    bounds: getBoundsForPoints(points),
    zIndex: 0,
    startArrow,
    endArrow,
    metadata: {
      sourceApp: "miro",
      miroLineType: miroLineTypeName(lt),
      simplified: lt !== 0,
    },
  };
}

function importDividerWidget(json, id) {
  const pos = json._position?.offsetPx ?? { x: 0, y: 0 };
  const size = json.size ?? { width: 100, height: 1 };
  const style = tryParseJson(json.style) ?? {};

  const halfW = size.width / 2;
  const points = [
    { x: pos.x - halfW, y: pos.y, t: 0 },
    { x: pos.x + halfW, y: pos.y, t: 1 },
  ];

  const strokeColor = intToHex(style.brc ?? 0);
  const strokeWidth = typeof style.brw === "number" ? style.brw : 1;
  const opacity = typeof style.bro === "number" ? style.bro : 1;
  const rotation = json.rotation?.rotation ?? json.relativeRotation ?? 0;

  return {
    id,
    kind: "line",
    points,
    style: { color: strokeColor, width: strokeWidth, opacity, dash: "solid" },
    transform: { ...DEFAULT_TRANSFORM, rotation },
    bounds: getBoundsForPoints(points),
    zIndex: 0,
    startArrow: false,
    endArrow: false,
    metadata: { sourceApp: "miro", miroType: "divider" },
  };
}

function miroLineTypeName(lt) {
  switch (lt) {
    case 0:
      return "straight";
    case 1:
      return "elbow";
    case 2:
      return "curved";
    case 9:
      return "block";
    default:
      return `unknown_lt_${lt}`;
  }
}

function resolveEndpoint(endpoint, allWidgets) {
  const pt = endpoint?.point;
  if (!pt) return null;

  if ((endpoint.widgetIndex ?? -1) < 0) {
    return { x: pt.x, y: pt.y };
  }

  const targetWidget = allWidgets[endpoint.widgetIndex];
  if (!targetWidget) return { x: pt.x, y: pt.y };

  const wJson = tryParseJson(targetWidget.widgetData?.json);
  if (!wJson) return { x: pt.x, y: pt.y };

  const pos = wJson._position?.offsetPx ?? { x: 0, y: 0 };
  const size = wJson.size ?? { width: 0, height: 0 };
  const left = pos.x - size.width / 2;
  const top = pos.y - size.height / 2;

  return {
    x: left + pt.x * size.width,
    y: top + pt.y * size.height,
  };
}

function tryParseJson(value) {
  if (!value) return null;
  if (typeof value === "object") return value;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
  return null;
}

function intToHex(n) {
  if (typeof n !== "number" || n < 0) return "#000000";
  return `#${n.toString(16).padStart(6, "0")}`;
}

function stripHtml(html) {
  return html.replace(/<[^>]+>/g, "");
}

function miroLineStyleToDash(ls) {
  if (ls === 1) return "dashed";
  if (ls === 3) return "dotted";
  return "solid";
}

function generateId() {
  return `miro-${Math.random().toString(36).slice(2, 10)}`;
}

function pushIssue(report, issue, objectId) {
  report.issues.push(issue);
  report.level = mergeFidelityLevels(report.level, issue.level);
  report.objects.push({ objectId, level: issue.level, issues: [issue] });
}
