import { type FidelityReport } from "../../core/fidelity.js";
import type { CanonicalDocument } from "../../core/types.js";
type ExcalidrawPrimitivePoint = [number, number] | [number, number, number];
export interface ExcalidrawElementBase {
    id: string;
    type: string;
    x: number;
    y: number;
    width?: number;
    height?: number;
    angle?: number;
    opacity?: number;
    strokeColor?: string;
    strokeStyle?: "solid" | "dashed" | "dotted";
    strokeWidth?: number;
    backgroundColor?: string;
    fillStyle?: string;
    index?: string;
    seed?: number;
    version?: number;
    versionNonce?: number;
}
export interface ExcalidrawFreedrawElement extends ExcalidrawElementBase {
    type: "freedraw";
    points: ExcalidrawPrimitivePoint[];
    pressures?: number[];
    simulatePressure?: boolean;
    lastCommittedPoint?: ExcalidrawPrimitivePoint | null;
}
export interface ExcalidrawShapeElement extends ExcalidrawElementBase {
    type: "rectangle" | "ellipse" | "diamond" | "triangle";
    width: number;
    height: number;
    roundness?: {
        type: number;
        value?: number;
    } | null;
}
export interface ExcalidrawLineElement extends ExcalidrawElementBase {
    type: "line" | "arrow";
    points: ExcalidrawPrimitivePoint[];
    startArrowhead?: string | null;
    endArrowhead?: string | null;
}
export interface ExcalidrawTextElement extends ExcalidrawElementBase {
    type: "text";
    text: string;
    fontSize: number;
    fontFamily: number;
    textAlign: "left" | "center" | "right";
    width: number;
    height: number;
}
export interface ExcalidrawScene {
    type?: string;
    version?: number;
    source?: string;
    elements: ExcalidrawElementBase[];
    appState?: Record<string, unknown>;
    files?: Record<string, unknown>;
}
export interface ImportResult {
    document: CanonicalDocument;
    fidelity: FidelityReport;
}
export declare function importExcalidrawScene(scene: ExcalidrawScene, options?: {
    documentId?: string;
    title?: string;
    pageId?: string;
    pageName?: string;
}): ImportResult;
export {};
//# sourceMappingURL=import.d.ts.map