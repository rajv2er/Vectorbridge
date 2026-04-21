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

export const SOURCE_APPS: SourceAppDefinition[] = [
  {
    id: "excalidraw",
    label: "Excalidraw",
    accepts: ["application/json", "text/plain"],
  },
];

export const TARGET_APPS: TargetAppDefinition[] = [
  {
    id: "miro",
    label: "Miro REST API",
    output: "rest",
  },
  {
    id: "miro-web-sdk",
    label: "Miro Web SDK",
    output: "web-sdk",
  },
  {
    id: "onenote",
    label: "OneNote Microsoft Graph",
    output: "graph",
  },
];

export function getSourceAppDefinition(
  id: SourceAppId,
): SourceAppDefinition | undefined {
  return SOURCE_APPS.find((app) => app.id === id);
}

export function getTargetAppDefinition(
  id: TargetAppId,
): TargetAppDefinition | undefined {
  return TARGET_APPS.find((app) => app.id === id);
}
