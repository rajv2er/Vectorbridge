import type { Bounds, Point, ShapeType } from "./types.js";
import { simplifyPath } from "./simplify.js";

/**
 * Result of attempting to recognize a freehand stroke as a geometric shape.
 */
export interface RecognitionResult {
  /** Whether a shape was recognized. */
  recognized: boolean;

  /** The detected shape type, if recognized. */
  shapeType?: ShapeType | "line";

  /** Axis-aligned bounding box that contains the recognized shape. */
  bounds?: Bounds;

  /** Recognition confidence between 0 and 1. */
  confidence: number;
}

/**
 * Try to recognize a set of freedraw points as a known geometric shape.
 *
 * The algorithm:
 * 1. Simplify the path aggressively to identify corner / key points.
 * 2. Check for a straight line (2 key points).
 * 3. Check for a triangle (3 key points with roughly closed path).
 * 4. Check for a rectangle (4 key points with ~90° corners + closed path).
 * 5. Check for an ellipse (many points roughly equidistant from centroid).
 *
 * @param points – The raw freedraw point array.
 * @param closedThreshold – Max distance (px) between first and last point
 *   to consider the path "closed".  Defaults to 15% of the bounding
 *   diagonal length.
 */
export function recognizeShape(
  points: Point[],
  closedThreshold?: number,
): RecognitionResult {
  if (points.length < 2) {
    return { recognized: false, confidence: 0 };
  }

  const bounds = computeBounds(points);
  const diagonal = Math.hypot(bounds.width, bounds.height);
  const threshold = closedThreshold ?? diagonal * 0.15;

  // --- Line detection (non-closed) ---
  const lineResult = detectLine(points, bounds, diagonal);
  if (lineResult.recognized) {
    return lineResult;
  }

  // For closed shape detection, the path must roughly return to its start
  const isClosed = distanceBetween(points[0], points[points.length - 1]) < threshold;

  if (!isClosed) {
    return { recognized: false, confidence: 0 };
  }

  // Simplify aggressively for corner detection
  const simplified = simplifyPath(points, diagonal * 0.08);

  // Remove the duplicate closing point if present
  const corners = removeDuplicateClosingPoint(simplified, threshold);

  // --- Triangle ---
  if (corners.length === 3) {
    const conf = triangleConfidence(corners, bounds);
    if (conf > 0.5) {
      return {
        recognized: true,
        shapeType: "triangle",
        bounds,
        confidence: conf,
      };
    }
  }

  // --- Rectangle / Diamond ---
  if (corners.length === 4) {
    const rectConf = rectangleConfidence(corners);
    const diamondConf = diamondConfidence(corners, bounds);

    if (diamondConf > rectConf && diamondConf > 0.5) {
      return {
        recognized: true,
        shapeType: "diamond",
        bounds,
        confidence: diamondConf,
      };
    }

    if (rectConf > 0.5) {
      return {
        recognized: true,
        shapeType: "rectangle",
        bounds,
        confidence: rectConf,
      };
    }
  }

  // --- Ellipse (many points, roughly circular) ---
  const ellipseConf = ellipseConfidence(points, bounds);
  if (ellipseConf > 0.55) {
    return {
      recognized: true,
      shapeType: "ellipse",
      bounds,
      confidence: ellipseConf,
    };
  }

  return { recognized: false, confidence: 0 };
}

// ─── Detectors ───────────────────────────────────────────────────────

function detectLine(
  points: Point[],
  bounds: Bounds,
  diagonal: number,
): RecognitionResult {
  // A line is detected when ALL points lie close to the
  // straight line from first→last.
  if (points.length < 2) {
    return { recognized: false, confidence: 0 };
  }

  const first = points[0];
  const last = points[points.length - 1];
  const length = distanceBetween(first, last);

  // Too short to be meaningful
  if (length < 20) {
    return { recognized: false, confidence: 0 };
  }

  let maxDeviation = 0;
  for (const point of points) {
    const dev = perpendicularDistanceToLine(point, first, last);
    if (dev > maxDeviation) maxDeviation = dev;
  }

  // Max deviation should be small relative to the line length
  const deviationRatio = maxDeviation / length;

  if (deviationRatio < 0.06) {
    return {
      recognized: true,
      shapeType: "line",
      bounds,
      confidence: Math.max(0, 1 - deviationRatio * 10),
    };
  }

  return { recognized: false, confidence: 0 };
}

function triangleConfidence(corners: Point[], bounds: Bounds): number {
  // Check: 3 sides of reasonable length
  const sides = getSideLengths(corners);
  const perimeter = sides.reduce((a, b) => a + b, 0);
  const minSide = Math.min(...sides);

  // Each side should be at least 15% of perimeter
  if (minSide / perimeter < 0.15) return 0;

  // Check: interior angles sum to ~180°
  const angles = getInteriorAngles(corners);
  const angleSum = angles.reduce((a, b) => a + b, 0);
  const angleDiff = Math.abs(angleSum - Math.PI);

  return Math.max(0, 1 - angleDiff * 3);
}

function rectangleConfidence(corners: Point[]): number {
  // Check: 4 angles should each be ~90° (π/2)
  const angles = getInteriorAngles(corners);
  const rightAngle = Math.PI / 2;

  let totalAngleError = 0;
  for (const angle of angles) {
    totalAngleError += Math.abs(angle - rightAngle);
  }

  // Average error per angle (in radians)
  const avgError = totalAngleError / 4;

  // Check: opposite sides should be roughly equal
  const sides = getSideLengths(corners);
  const sideRatio1 = Math.min(sides[0], sides[2]) / Math.max(sides[0], sides[2]);
  const sideRatio2 = Math.min(sides[1], sides[3]) / Math.max(sides[1], sides[3]);

  const sideScore = (sideRatio1 + sideRatio2) / 2;
  const angleScore = Math.max(0, 1 - avgError * 4);

  return angleScore * 0.6 + sideScore * 0.4;
}

function diamondConfidence(corners: Point[], bounds: Bounds): number {
  // A diamond has 4 corners where opposite pairs are roughly aligned
  // with the center, and the corners sit at the midpoints of the bounding
  // box edges (top, right, bottom, left).

  const cx = bounds.x + bounds.width / 2;
  const cy = bounds.y + bounds.height / 2;

  // Sort corners by angle from center
  const sorted = [...corners].sort((a, b) => {
    return Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx);
  });

  // Check if corners are roughly equally spaced angularly (90° apart)
  const expectedAngles = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];
  const actualAngles = sorted.map((p) => {
    let a = Math.atan2(p.y - cy, p.x - cx);
    if (a < 0) a += 2 * Math.PI;
    return a;
  });

  // Normalize: rotate so first angle is 0
  const offset = actualAngles[0];
  const normalized = actualAngles.map((a) => {
    let n = a - offset;
    if (n < 0) n += 2 * Math.PI;
    return n;
  });

  let totalError = 0;
  for (let i = 0; i < 4; i++) {
    totalError += Math.abs(normalized[i] - expectedAngles[i]);
  }

  const avgError = totalError / 4;

  // Check side lengths are roughly equal (rhombus property)
  const sides = getSideLengths(sorted);
  const avgSide = sides.reduce((a, b) => a + b, 0) / 4;
  let sideVariance = 0;
  for (const s of sides) {
    sideVariance += Math.abs(s - avgSide) / avgSide;
  }
  sideVariance /= 4;

  const angleScore = Math.max(0, 1 - avgError * 2);
  const sideScore = Math.max(0, 1 - sideVariance * 3);

  return angleScore * 0.5 + sideScore * 0.5;
}

function ellipseConfidence(points: Point[], bounds: Bounds): number {
  if (points.length < 8) return 0;

  // Check if the path is roughly closed
  const first = points[0];
  const last = points[points.length - 1];
  const diagonal = Math.hypot(bounds.width, bounds.height);

  if (distanceBetween(first, last) > diagonal * 0.2) return 0;

  // Center of the bounding box
  const cx = bounds.x + bounds.width / 2;
  const cy = bounds.y + bounds.height / 2;
  const rx = bounds.width / 2;
  const ry = bounds.height / 2;

  if (rx < 5 || ry < 5) return 0;

  // For each point, compute how close it is to the ideal ellipse
  // The equation (x-cx)²/rx² + (y-cy)²/ry² should be ~1
  let totalError = 0;
  for (const point of points) {
    const dx = (point.x - cx) / rx;
    const dy = (point.y - cy) / ry;
    const ellipseValue = dx * dx + dy * dy;
    totalError += Math.abs(ellipseValue - 1);
  }

  const avgError = totalError / points.length;

  return Math.max(0, 1 - avgError * 2);
}

// ─── Geometry helpers ────────────────────────────────────────────────

function computeBounds(points: Point[]): Bounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function distanceBetween(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function perpendicularDistanceToLine(
  point: Point,
  lineStart: Point,
  lineEnd: Point,
): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const lengthSq = dx * dx + dy * dy;

  if (lengthSq === 0) {
    return distanceBetween(point, lineStart);
  }

  const area = Math.abs(
    dy * point.x - dx * point.y +
    lineEnd.x * lineStart.y - lineEnd.y * lineStart.x,
  );

  return area / Math.sqrt(lengthSq);
}

function getSideLengths(corners: Point[]): number[] {
  const sides: number[] = [];
  for (let i = 0; i < corners.length; i++) {
    const next = (i + 1) % corners.length;
    sides.push(distanceBetween(corners[i], corners[next]));
  }
  return sides;
}

function getInteriorAngles(corners: Point[]): number[] {
  const angles: number[] = [];
  const n = corners.length;

  for (let i = 0; i < n; i++) {
    const prev = corners[(i - 1 + n) % n];
    const curr = corners[i];
    const next = corners[(i + 1) % n];

    const v1x = prev.x - curr.x;
    const v1y = prev.y - curr.y;
    const v2x = next.x - curr.x;
    const v2y = next.y - curr.y;

    const dot = v1x * v2x + v1y * v2y;
    const cross = v1x * v2y - v1y * v2x;

    angles.push(Math.abs(Math.atan2(cross, dot)));
  }

  return angles;
}

function removeDuplicateClosingPoint(
  points: Point[],
  threshold: number,
): Point[] {
  if (points.length < 2) return points;

  const first = points[0];
  const last = points[points.length - 1];

  if (distanceBetween(first, last) < threshold) {
    return points.slice(0, -1);
  }

  return points;
}
