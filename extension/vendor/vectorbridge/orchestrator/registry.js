export const SOURCE_APPS = [
    {
        id: "excalidraw",
        label: "Excalidraw",
        accepts: ["application/json", "text/plain"],
    },
];
export const TARGET_APPS = [
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
export function getSourceAppDefinition(id) {
    return SOURCE_APPS.find((app) => app.id === id);
}
export function getTargetAppDefinition(id) {
    return TARGET_APPS.find((app) => app.id === id);
}
//# sourceMappingURL=registry.js.map