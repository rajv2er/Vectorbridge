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
import { simplifyPath } from "../../core/simplify.js";

const BYTE_SHIFT = 59;
const MIRO_WIDGET_TYPE = 14;
const MAX_STROKE_SEGMENTS = 8;
const STROKE_SIMPLIFY_EPSILON = 6;

const CANONICAL_TO_MIRO_SHAPE = {
  rectangle: "3",
  round_rectangle: "rr",
  ellipse: "4",
  diamond: "8",
  triangle: "5",
};

function defaultStyle(strokeColor, fillColor, fontSize) {
  const sc = parseColorToInt(strokeColor);
  const bc = fillColor === "transparent" ? -1 : parseColorToInt(fillColor);
  return JSON.stringify({
    st: 2,
    ss: 2,
    sc,
    bc,
    bo: 1,
    brc: sc,
    brw: 2,
    bro: 1,
    brs: 2,
    ffn: "Noto Sans",
    tc: sc,
    tsc: 1,
    ta: "c",
    tav: "m",
    fs: fontSize,
    b: null,
    i: 0,
    u: null,
    s: null,
    bsc: 1,
    VER: 2.1,
    hl: null,
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

function buildShapeWidget(shape, index) {
  const miroShape = CANONICAL_TO_MIRO_SHAPE[shape.shapeType] ?? "r";
  const cx = shape.bounds.x + shape.bounds.width / 2;
  const cy = shape.bounds.y + shape.bounds.height / 2;
  return {
    widgetData: {
      json: {
        _position: { offsetPx: { x: Math.round(cx), y: Math.round(cy) } },
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
        style: defaultStyle(shape.style.color, shape.fill.color, 14),
        shape: miroShape,
      },
      type: "shape",
    },
    type: MIRO_WIDGET_TYPE,
    id: index,
    initialId: generateWidgetId(),
  };
}

function buildTextWidget(text, index) {
  const cx = text.bounds.x + text.bounds.width / 2;
  const cy = text.bounds.y + text.bounds.height / 2;
  return {
    widgetData: {
      json: {
        _position: { offsetPx: { x: Math.round(cx), y: Math.round(cy) } },
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

function simplifyStrokeForClipboard(points) {
  let epsilon = STROKE_SIMPLIFY_EPSILON;
  let simplified = simplifyPath(points, epsilon);
  while (simplified.length - 1 > MAX_STROKE_SEGMENTS && epsilon < 96) {
    epsilon *= 1.6;
    simplified = simplifyPath(points, epsilon);
  }
  if (simplified.length - 1 <= MAX_STROKE_SEGMENTS) return simplified;

  const stride = Math.ceil((simplified.length - 1) / MAX_STROKE_SEGMENTS);
  const sampled = [];
  for (let i = 0; i < simplified.length; i += stride) {
    sampled.push(simplified[i]);
  }
  const last = simplified[simplified.length - 1];
  if (sampled[sampled.length - 1] !== last) sampled.push(last);
  return sampled;
}

function buildStrokeWidgets(stroke) {
  const points = transformStrokePointsForSegments(stroke);
  const simplified = simplifyStrokeForClipboard(points);
  if (simplified.length < 2) return [];
  return buildStrokeSegmentWidgets(stroke, simplified);
}

function transformStrokePointsForSegments(stroke) {
  const rotation = stroke.transform.rotation ?? 0;
  if (!rotation) return stroke.points;

  const radians = (rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const cx = stroke.bounds.x + stroke.bounds.width / 2;
  const cy = stroke.bounds.y + stroke.bounds.height / 2;

  return stroke.points.map((point) => {
    const dx = point.x - cx;
    const dy = point.y - cy;
    return {
      ...point,
      x: cx + dx * cos - dy * sin,
      y: cy + dx * sin + dy * cos,
    };
  });
}

function buildStrokeSegmentWidgets(stroke, points) {
  const widgets = [];
  for (let i = 1; i < points.length; i++) {
    const start = points[i - 1];
    const end = points[i];
    if (start.x === end.x && start.y === end.y) continue;
    widgets.push(buildStrokeSegmentWidget(stroke, start, end, i - 1));
  }
  return widgets;
}

function buildStrokeSegmentWidget(stroke, start, end, index) {
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
          lc: parseColorToInt(stroke.style.color),
          lw: Math.max(1, roundNumber(stroke.style.width)),
          lo: roundNumber(stroke.style.opacity),
          ls: 2,
          t: 2,
          lt: 0,
          a_start: 0,
          a_end: 0,
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

export function exportDocumentToMiroClipboard(document) {
  const fidelity = createEmptyFidelityReport();
  const widgets = [];
  let widgetIndex = 0;

  for (const object of Object.values(document.objects)) {
    const converted = convertObject(object, widgetIndex, fidelity);
    if (converted) {
      const arr = Array.isArray(converted) ? converted : [converted];
      for (const w of arr) {
        w.id = widgetIndex++;
        widgets.push(w);
      }
    }
  }

  const clipboardJson = {
    isProtected: false,
    boardId: "",
    data: { objects: widgets },
    meta: { boardId: "", widgetToken: "lor" },
    version: 2,
    host: "miro.com",
    copierType: "COPY",
  };

  const payload = encodePayload(JSON.stringify(clipboardJson));
  const html = wrapAsHtml(payload);
  return { html, payload, fidelity, widgetCount: widgets.length };
}

function convertObject(object, index, fidelity) {
  switch (object.kind) {
    case "shape":
      fidelity.objects.push({ objectId: object.id, level: "editable", issues: [] });
      return buildShapeWidget(object, index);

    case "text":
      fidelity.objects.push({ objectId: object.id, level: "editable", issues: [] });
      return buildTextWidget(object, index);

    case "line":
      fidelity.objects.push({ objectId: object.id, level: "editable", issues: [] });
      return buildConnectorWidget(object, index);

    case "stroke": {
      const issue = {
        code: "MIRO_CLIPBOARD_STROKE_SEGMENTS",
        message: "Freehand stroke exported as persistent Miro line segments.",
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
      return buildStrokeWidgets(object);
    }

    default:
      return null;
  }
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
