/**
 * Converts a CanonicalDocument into Miro's miro-data-v1 clipboard format so
 * shapes, text, lines, and strokes can be pasted directly into a Miro board
 * as native, fully-editable widgets.
 *
 * Encoding: each byte of the serialized JSON is shifted by +59, Base64-encoded,
 * then wrapped in an HTML comment with miro-data-v1 markers.
 */
import {
  createEmptyFidelityReport,
  mergeFidelityLevels,
} from "../../core/fidelity.js";
const BYTE_SHIFT = 59;
const MIRO_WIDGET_TYPE = 14;

const CANONICAL_TO_MIRO_SHAPE = {
  rectangle: "3",
  round_rectangle: "rr",
  ellipse: "4",
  diamond: "8",
  triangle: "5",
};

function defaultStyle(strokeColor, fillColor, fontSize, strokeWidth) {
  const sc = parseColorToInt(strokeColor);
  const bc = fillColor === "transparent" ? -1 : parseColorToInt(fillColor);
  return JSON.stringify({
    st: 3,
    ss: 2,
    sc,
    bc,
    bo: 1,
    brc: sc,
    brw: Math.max(1, Math.round(strokeWidth ?? 2)),
    bro: 1,
    brs: 2,
    ffn: "Noto Sans",
    tc: sc,
    tsc: 1,
    ta: "c",
    tav: "m",
    fs: fontSize,
    b: 0,
    i: 0,
    u: 0,
    s: 0,
    bsc: 1,
    VER: 2.1,
    hl: "",
    brr: 0,
  });
}

function encodePayload(jsonString) {
  const bytes = stringToUtf8Bytes(jsonString);
  const shifted = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    shifted[i] = (bytes[i] + BYTE_SHIFT) % 256;
  }
  return uint8ToBase64(shifted);
}

function stringToUtf8Bytes(str) {
  const bytes = [];
  for (let i = 0; i < str.length; i++) {
    let code = str.charCodeAt(i);
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code < 0xd800 || code >= 0xe000) {
      bytes.push(
        0xe0 | (code >> 12),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f)
      );
    } else {
      i++;
      code =
        0x10000 + (((code & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff));
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f)
      );
    }
  }
  return new Uint8Array(bytes);
}

const BASE64_CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function uint8ToBase64(arr) {
  let result = "";
  for (let i = 0; i < arr.length; i += 3) {
    const a = arr[i];
    const b = i + 1 < arr.length ? arr[i + 1] : 0;
    const c = i + 2 < arr.length ? arr[i + 2] : 0;
    const triplet = (a << 16) | (b << 8) | c;
    result += BASE64_CHARS[(triplet >> 18) & 0x3f];
    result += BASE64_CHARS[(triplet >> 12) & 0x3f];
    result += i + 1 < arr.length ? BASE64_CHARS[(triplet >> 6) & 0x3f] : "=";
    result += i + 2 < arr.length ? BASE64_CHARS[triplet & 0x3f] : "=";
  }
  return result;
}

function wrapAsHtml(base64Payload) {
  return `<span data-meta="<--(miro-data-v1)${base64Payload}(/miro-data-v1)-->"></span>`;
}

function parseColorToInt(hex) {
  if (!hex || hex === "transparent") return -1;
  const n = parseInt(hex.replace("#", ""), 16);
  return isNaN(n) ? 0 : n;
}

function generateWidgetId() {
  let id = "3";
  for (let i = 0; i < 18; i++) {
    id += Math.floor(Math.random() * 10).toString();
  }
  return id;
}

// ── Shape widgets ──────────────────────────────────────────────────

function buildShapeWidget(shape, index) {
  const miroShape = CANONICAL_TO_MIRO_SHAPE[shape.shapeType] ?? "r";
  const cx = shape.bounds.x + shape.bounds.width / 2;
  const cy = shape.bounds.y + shape.bounds.height / 2;
  return {
    widgetData: {
      json: {
        _position: {
          offsetPx: { x: Math.round(cx), y: Math.round(cy) },
          schema: "canvasOffsetPx",
        },
        scale: { scale: 1 },
        relativeScale: 1,
        rotation: { rotation: Math.round(shape.transform.rotation) },
        relativeRotation: Math.round(shape.transform.rotation),
        size: {
          width: Math.max(1, Math.round(shape.bounds.width)),
          height: Math.max(1, Math.round(shape.bounds.height)),
        },
        _parent: null,
        text: shape.label ?? "",
        style: defaultStyle(shape.style.color, shape.fill.color, 14, shape.style.width),
        shape: miroShape,
      },
      type: "shape",
    },
    type: MIRO_WIDGET_TYPE,
    id: index,
    initialId: generateWidgetId(),
  };
}

// ── Text widgets ───────────────────────────────────────────────────

function buildTextWidget(text, index) {
  const cx = text.bounds.x + text.bounds.width / 2;
  const cy = text.bounds.y + text.bounds.height / 2;
  return {
    widgetData: {
      json: {
        _position: {
          offsetPx: { x: Math.round(cx), y: Math.round(cy) },
          schema: "canvasOffsetPx",
        },
        scale: { scale: 1 },
        relativeScale: 1,
        rotation: { rotation: Math.round(text.transform.rotation) },
        relativeRotation: Math.round(text.transform.rotation),
        size: {
          width: Math.max(1, Math.round(text.bounds.width)),
          height: Math.max(1, Math.round(text.bounds.height)),
        },
        _parent: null,
        text: `<p>${escapeHtml(text.text)}</p>`,
        style: defaultStyle(text.style.color, "transparent", Math.round(text.fontSize)),
        shape: "r",
      },
      type: "shape",
    },
    type: MIRO_WIDGET_TYPE,
    id: index,
    initialId: generateWidgetId(),
  };
}

// ── Line / Connector widgets ───────────────────────────────────────

function buildConnectorWidget(line, index) {
  const start = line.points[0];
  const end = line.points[line.points.length - 1];
  return {
    widgetData: {
      json: {
        points: [],
        primary: {
          point: { x: roundNumber(start.x), y: roundNumber(start.y) },
          positionType: 0,
          widgetIndex: -1,
        },
        secondary: {
          point: { x: roundNumber(end.x), y: roundNumber(end.y) },
          positionType: 0,
          widgetIndex: -1,
        },
        _position: null,
        _parent: null,
        style: JSON.stringify({
          lc: parseColorToInt(line.style.color),
          lw: Math.max(1, roundNumber(line.style.width)),
          lo: roundNumber(line.style.opacity),
          ls: mapDashToMiroLineStyle(line.style.dash),
          t: 2,
          lt: 0,
          a_start: line.startArrow ? 9 : 0,
          a_end: line.endArrow ? 9 : 0,
          VER: 2,
          jump: 0,
        }),
        line: { captions: [] },
      },
      type: "line",
    },
    type: MIRO_WIDGET_TYPE,
    id: index,
    initialId: generateWidgetId(),
  };
}

function mapDashToMiroLineStyle(dash) {
  if (dash === "dashed") return 1;
  if (dash === "dotted") return 3;
  return 2;
}

// ── Paint (freehand stroke) widgets ────────────────────────────────
//
// Each Excalidraw freehand stroke maps to ONE native Miro paint widget.
// NEVER split strokes into line segments — bulk line widgets overwhelm
// Miro's live paste handler and cause deferred rendering.

function buildPaintWidget(stroke, index) {
  const points = transformStrokePoints(stroke);
  const bounds = getPointBounds(points);
  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2;

  // Miro paint points are relative to the stroke's top-left corner, while
  // _position.offsetPx identifies the center of that local bounding box.
  // Keeping those two coordinate systems distinct prevents every stroke from
  // being displaced by half of its own width and height.
  const relPoints = points.map((p) => ({
    x: roundNumber(p.x - bounds.x),
    y: roundNumber(p.y - bounds.y),
  }));

  return {
    widgetData: {
      json: {
        _position: {
          offsetPx: { x: roundNumber(centerX), y: roundNumber(centerY) },
          schema: "canvasOffsetPx",
        },
        scale: { scale: 1 },
        relativeScale: 1,
        rotation: { rotation: roundNumber(stroke.transform.rotation ?? 0) },
        relativeRotation: roundNumber(stroke.transform.rotation ?? 0),
        _parent: null,
        points: relPoints,
        style: JSON.stringify({
          lc: parseColorToInt(stroke.style.color),
          t: 2,
          lo: roundNumber(stroke.style.opacity),
          e: roundNumber(Math.max(0.1, stroke.style.width / 11)),
        }),
      },
      type: "paint",
    },
    type: MIRO_WIDGET_TYPE,
    id: index,
    initialId: generateWidgetId(),
  };
}

// ── Image widgets ──────────────────────────────────────────────────

function buildImageWidget(image, index) {
  const centerX = image.bounds.x + image.bounds.width / 2;
  const centerY = image.bounds.y + image.bounds.height / 2;
  return {
    widgetData: {
      json: {
        _position: {
          offsetPx: { x: roundNumber(centerX), y: roundNumber(centerY) },
          schema: "canvasOffsetPx",
        },
        scale: { scale: 1 },
        relativeScale: 1,
        rotation: { rotation: roundNumber(image.transform.rotation ?? 0) },
        relativeRotation: roundNumber(image.transform.rotation ?? 0),
        size: {
          width: Math.max(1, roundNumber(image.bounds.width)),
          height: Math.max(1, roundNumber(image.bounds.height)),
        },
        _parent: null,
        url: image.dataURL,
        title: "",
        alt: "",
      },
      type: "image",
    },
    type: MIRO_WIDGET_TYPE,
    id: index,
    initialId: generateWidgetId(),
  };
}

// Miro's paint widget handles rotation via its own rotation field,
// so we pass the raw points through without applying rotation here.
// Applying rotation to the points AND setting the widget rotation
// would double-rotate the stroke.
function transformStrokePoints(stroke) {
  return stroke.points;
}

function getPointBounds(points) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

// ── Export ─────────────────────────────────────────────────────────

export function exportDocumentToMiroClipboard(document) {
  const fidelity = createEmptyFidelityReport();

  // Group objects by render priority: shapes/text first, then lines, then paint
  const shapes = [];
  const lines = [];
  const paints = [];
  const images = [];

  for (const object of Object.values(document.objects)) {
    const result = classifyAndConvert(object, fidelity);
    if (!result) continue;
    if (result.category === "shape") shapes.push(result.widget);
    else if (result.category === "line") lines.push(result.widget);
    else if (result.category === "paint") paints.push(result.widget);
    else if (result.category === "image") images.push(result.widget);
  }

  // Final ordered list
  const widgets = [...images, ...shapes, ...lines, ...paints];

  // Normalize positions: Miro's paste handler expects all widget coordinates
  // to be relative to the GROUP CENTER of the selection. This mirrors how
  // real Miro copies work — shapes and strokes use offsetPx values that are
  // negative/positive around a central origin point.
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const w of widgets) {
    const box = computeWidgetTopLeft(w);
    if (!box) continue;
    minX = Math.min(minX, box.x);
    minY = Math.min(minY, box.y);
    maxX = Math.max(maxX, box.x + box.width);
    maxY = Math.max(maxY, box.y + box.height);
  }
  if (minX !== Infinity) {
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    for (const w of widgets) {
      const pos = w.widgetData?.json?._position?.offsetPx;
      if (pos) {
        pos.x = roundNumber(pos.x - centerX);
        pos.y = roundNumber(pos.y - centerY);
      }
      // Lines use absolute primary/secondary endpoint coordinates
      const primary = w.widgetData?.json?.primary?.point;
      const secondary = w.widgetData?.json?.secondary?.point;
      if (primary) {
        primary.x = roundNumber(primary.x - centerX);
        primary.y = roundNumber(primary.y - centerY);
      }
      if (secondary) {
        secondary.x = roundNumber(secondary.x - centerX);
        secondary.y = roundNumber(secondary.y - centerY);
      }
    }
  }

  // Reassign sequential id and unique widgetToken AFTER sorting
  let token = 1;
  for (let i = 0; i < widgets.length; i++) {
    widgets[i].id = i;
    widgets[i].meta = { boardId: "", widgetToken: token++ };
  }

  const clipboardJson = {
    isProtected: false,
    boardId: "",
    data: { objects: widgets, meta: {} },
    version: 2,
    host: "miro.com",
    asPortalAmount: 0,
    copierType: "COPY",
  };

  const payload = encodePayload(JSON.stringify(clipboardJson));
  const html = wrapAsHtml(payload);
  return { html, payload, fidelity, widgetCount: widgets.length };
}

function classifyAndConvert(object, fidelity) {
  switch (object.kind) {
    case "shape":
      fidelity.objects.push({ objectId: object.id, level: "editable", issues: [] });
      return { category: "shape", widget: buildShapeWidget(object, 0) };

    case "text":
      fidelity.objects.push({ objectId: object.id, level: "editable", issues: [] });
      return { category: "shape", widget: buildTextWidget(object, 0) };

    case "line":
      fidelity.objects.push({ objectId: object.id, level: "editable", issues: [] });
      return { category: "line", widget: buildConnectorWidget(object, 0) };

    case "stroke": {
      const issue = {
        code: "MIRO_CLIPBOARD_STROKE_PAINT",
        message: "Freehand stroke exported as a native Miro paint widget.",
        level: "approximate",
        objectId: object.id,
      };
      fidelity.issues.push(issue);
      fidelity.objects.push({
        objectId: object.id,
        level: "approximate",
        issues: [issue],
      });
      fidelity.level = mergeFidelityLevels(fidelity.level, "approximate");
      return { category: "paint", widget: buildPaintWidget(object, 0) };
    }

    case "image":
      fidelity.objects.push({ objectId: object.id, level: "editable", issues: [] });
      return { category: "image", widget: buildImageWidget(object, 0) };

    default:
      return null;
  }
}

// Compute the top-left corner of a widget's bounding box in canvas coordinates.
// Shapes/text: _position.offsetPx is CENTER, subtract half of size.
// Paint: _position.offsetPx is the CENTER of the local points bounds.
// Lines: _position is null, use primary/secondary endpoints directly.
function computeWidgetTopLeft(w) {
  const json = w.widgetData?.json;
  if (!json) return null;
  const type = w.widgetData?.type;

  if (type === "line") {
    const p = json.primary?.point;
    const s = json.secondary?.point;
    if (!p || !s) return null;
    return {
      x: Math.min(p.x, s.x),
      y: Math.min(p.y, s.y),
      width: Math.abs(s.x - p.x),
      height: Math.abs(s.y - p.y),
    };
  }

  const pos = json._position?.offsetPx;
  if (!pos) return null;

  if (type === "paint") {
    const pts = json.points ?? [];
    let minDX = Infinity, minDY = Infinity;
    let maxDX = -Infinity, maxDY = -Infinity;
    for (const pt of pts) {
      minDX = Math.min(minDX, pt.x ?? 0);
      minDY = Math.min(minDY, pt.y ?? 0);
      maxDX = Math.max(maxDX, pt.x ?? 0);
      maxDY = Math.max(maxDY, pt.y ?? 0);
    }
    if (minDX === Infinity) return { x: pos.x, y: pos.y, width: 0, height: 0 };
    const width = maxDX - minDX;
    const height = maxDY - minDY;
    return {
      x: pos.x - width / 2,
      y: pos.y - height / 2,
      width,
      height,
    };
  }

  // Shape / text
  const size = json.size ?? { width: 0, height: 0 };
  return { x: pos.x - size.width / 2, y: pos.y - size.height / 2, width: size.width, height: size.height };
}

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function roundNumber(value, decimals = 3) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
