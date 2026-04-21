export type SourceAppId = "excalidraw";
export type TargetAppId = "miro" | "miro-web-sdk" | "onenote";
export interface SourceAppDefinition {
    id: SourceAppId;
    label: string;
    accepts: string[];
}
export interface TargetAppDefinition {
    id: TargetAppId;
    label: string;
    output: "rest" | "web-sdk" | "graph";
}
export declare const SOURCE_APPS: SourceAppDefinition[];
export declare const TARGET_APPS: TargetAppDefinition[];
export declare function getSourceAppDefinition(id: SourceAppId): SourceAppDefinition | undefined;
export declare function getTargetAppDefinition(id: TargetAppId): TargetAppDefinition | undefined;
//# sourceMappingURL=registry.d.ts.map