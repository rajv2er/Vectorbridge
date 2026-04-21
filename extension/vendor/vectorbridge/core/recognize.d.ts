import type { Bounds, Point, ShapeType } from "./types.js";
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
export declare function recognizeShape(points: Point[], closedThreshold?: number): RecognitionResult;
//# sourceMappingURL=recognize.d.ts.map