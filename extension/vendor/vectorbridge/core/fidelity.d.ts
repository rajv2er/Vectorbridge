export type FidelityLevel = "editable" | "bridge_editable" | "approximate" | "fallback" | "unsupported";
export interface FidelityIssue {
    code: string;
    message: string;
    level: FidelityLevel;
    objectId?: string;
}
export interface ObjectFidelity {
    objectId: string;
    level: FidelityLevel;
    issues: FidelityIssue[];
}
export interface FidelityReport {
    level: FidelityLevel;
    objects: ObjectFidelity[];
    issues: FidelityIssue[];
}
export declare function createEmptyFidelityReport(): FidelityReport;
export declare function mergeFidelityLevels(current: FidelityLevel, next: FidelityLevel): FidelityLevel;
//# sourceMappingURL=fidelity.d.ts.map