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
export declare function simplifyPath(points: Point[], epsilon: number): Point[];
//# sourceMappingURL=simplify.d.ts.map