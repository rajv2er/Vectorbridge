export const SOURCE_APPS = [
  {
    id: "excalidraw",
    label: "Excalidraw",
    accepts: ["application/json", "text/plain"],
  },
  {
    id: "miro-clipboard",
    label: "Miro",
    accepts: ["text/html"],
  },
];

export const TARGET_APPS = [
  {
    id: "miro-clipboard",
    label: "Miro (Direct Paste)",
    output: "clipboard",
  },
  {
    id: "excalidraw",
    label: "Excalidraw",
    output: "json",
  },
];

export function getSourceAppDefinition(id) {
  return SOURCE_APPS.find((app) => app.id === id);
}

export function getTargetAppDefinition(id) {
  return TARGET_APPS.find((app) => app.id === id);
}