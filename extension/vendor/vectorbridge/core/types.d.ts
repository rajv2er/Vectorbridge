export interface Point {
    x: number;
    y: number;
    t?: number;
    pressure?: number;
    tilt?: number;
}
export interface StrokeStyle {
    color: string;
    width: number;
    opacity: number;
    dash?: "solid" | "dashed" | "dotted";
}
export interface Transform {
    x: number;
    y: number;
    scaleX: number;
    scaleY: number;
    rotation: number;
}
export interface Bounds {
    x: number;
    y: number;
    width: number;
    height: number;
}
export type ShapeType = "rectangle" | "round_rectangle" | "ellipse" | "diamond" | "triangle";
export interface FillStyle {
    color: string;
    opacity: number;
}
export interface CanonicalStroke {
    id: string;
    kind: "stroke";
    points: Point[];
    style: StrokeStyle;
    transform: Transform;
    bounds: Bounds;
    zIndex: number;
    metadata?: Record<string, unknown>;
}
export interface CanonicalShape {
    id: string;
    kind: "shape";
    shapeType: ShapeType;
    style: StrokeStyle;
    fill: FillStyle;
    transform: Transform;
    bounds: Bounds;
    zIndex: number;
    label?: string;
    metadata?: Record<string, unknown>;
}
export interface CanonicalLine {
    id: string;
    kind: "line";
    points: Point[];
    style: StrokeStyle;
    transform: Transform;
    bounds: Bounds;
    zIndex: number;
    startArrow: boolean;
    endArrow: boolean;
    metadata?: Record<string, unknown>;
}
export interface CanonicalText {
    id: string;
    kind: "text";
    text: string;
    fontSize: number;
    fontFamily: string;
    textAlign: "left" | "center" | "right";
    style: StrokeStyle;
    transform: Transform;
    bounds: Bounds;
    zIndex: number;
    metadata?: Record<string, unknown>;
}
export type CanonicalObject = CanonicalStroke | CanonicalShape | CanonicalLine | CanonicalText;
export interface CanonicalPage {
    id: string;
    name: string;
    objectIds: string[];
}
export interface CanonicalDocument {
    version: string;
    id: string;
    title: string;
    objects: Record<string, CanonicalObject>;
    pages: CanonicalPage[];
    activePageId: string;
    metadata?: Record<string, unknown>;
}
export interface ImportContext {
    sourceApp: string;
    sourceVersion?: string;
}
export interface ExportContext {
    targetApp: string;
    targetVersion?: string;
}
//# sourceMappingURL=types.d.ts.map