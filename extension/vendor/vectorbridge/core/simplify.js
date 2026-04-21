/**
 * Douglas-Peucker path simplification.
 *
 * Reduces the number of points in a polyline while preserving its overall
 * shape. Points whose perpendicular distance from the simplified line is less
 * than `epsilon` are discarded.
 *
 * @param points - Original point array (at least 2 points).
 * @param epsilon - Distance threshold in the same coordinate units as the
 *   points. Larger values produce fewer points. Typical range: 2–8.
 * @returns A simplified subset of the input array.
 */
export function simplifyPath(points, epsilon) {
  if (points.length <= 2) return points.slice();

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

  if (maxDistance > epsilon) {
    const left = simplifyPath(points.slice(0, maxIndex + 1), epsilon);
    const right = simplifyPath(points.slice(maxIndex), epsilon);
    return [...left.slice(0, -1), ...right];
  }

  return [first, last];
}

function perpendicularDistance(point, lineStart, lineEnd) {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) {
    return Math.hypot(point.x - lineStart.x, point.y - lineStart.y);
  }
  const area = Math.abs(
    dy * point.x -
      dx * point.y +
      lineEnd.x * lineStart.y -
      lineEnd.y * lineStart.x
  );
  return area / Math.sqrt(lengthSquared);
}