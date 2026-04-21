import type { Point } from "./types.js";

/**
 * Douglas-Peucker path simplification algorithm.
 *
 * Reduces the number of points in a polyline while preserving its overall
 * shape. Points whose perpendicular distance from the simplified line is less
 * than `epsilon` are discarded.
 *
 * @param points - The original point array (must have at least 2 points).
 * @param epsilon - Distance threshold in the same coordinate units as the
 *   points. A larger epsilon produces fewer output points (more aggressive
 *   simplification). Typical values: 2–8 for screen-space coordinates.
 * @returns A simplified point array that is a strict subset of the input.
 */
export function simplifyPath(points: Point[], epsilon: number): Point[] {
  if (points.length <= 2) {
    return points.slice();
  }

  // Find the point furthest from the line connecting the first and last points
  let maxDistance = 0;
  let maxIndex = 0;

  const first = points[0];
  const last = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const distance = perpendicularDistance(points[i], first, last);
    if (distance > maxDistance) {
      maxDistance = distance;
      maxIndex = i;
    }
  }

  // If the max distance exceeds the threshold, recursively simplify both halves
  if (maxDistance > epsilon) {
    const left = simplifyPath(points.slice(0, maxIndex + 1), epsilon);
    const right = simplifyPath(points.slice(maxIndex), epsilon);

    // Concatenate without duplicating the split point
    return [...left.slice(0, -1), ...right];
  }

  // No significant deviation — the entire segment can be represented
  // by just its endpoints
  return [first, last];
}

/**
 * Perpendicular distance from a point to the infinite line defined by
 * `lineStart` and `lineEnd`.
 */
function perpendicularDistance(
  point: Point,
  lineStart: Point,
  lineEnd: Point,
): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const lengthSquared = dx * dx + dy * dy;

  // If the two endpoints coincide, return the Euclidean distance
  if (lengthSquared === 0) {
    return Math.hypot(point.x - lineStart.x, point.y - lineStart.y);
  }

  // Area of parallelogram / base length = perpendicular distance
  const area = Math.abs(
    dy * point.x - dx * point.y + lineEnd.x * lineStart.y - lineEnd.y * lineStart.x,
  );

  return area / Math.sqrt(lengthSquared);
}
