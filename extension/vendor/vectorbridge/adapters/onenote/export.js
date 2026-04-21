import { createEmptyFidelityReport, mergeFidelityLevels, } from "../../core/fidelity.js";
const DEFAULT_PADDING = 8;
export function exportDocumentToOneNote(document, options) {
    const fidelity = createEmptyFidelityReport();
    const parts = [];
    const imageTags = [];
    const padding = options?.strokePadding ?? DEFAULT_PADDING;
    const title = escapeHtml(options?.pageTitle ?? document.title);
    let strokeIndex = 0;
    for (const object of Object.values(document.objects)) {
        if (object.kind !== "stroke") {
            const issue = {
                code: "ONENOTE_UNSUPPORTED_OBJECT",
                message: `Skipped unsupported canonical object kind "${String(object.kind)}".`,
                level: "unsupported",
                objectId: object.id,
            };
            fidelity.issues.push(issue);
            fidelity.objects.push({
                objectId: object.id,
                level: issue.level,
                issues: [issue],
            });
            fidelity.level = mergeFidelityLevels(fidelity.level, issue.level);
            continue;
        }
        const rendered = renderStrokeAsOneNoteImage(object, {
            partName: `${options?.imageNamePrefix ?? "stroke-render"}-${strokeIndex}`,
            padding,
        });
        strokeIndex += 1;
        parts.push(rendered.part);
        imageTags.push(rendered.imageTag);
        const issue = {
            code: "ONENOTE_STROKE_FALLBACK_RENDER",
            message: "Exported stroke as a rendered image because Microsoft Graph OneNote APIs do not expose native ink-stroke creation.",
            level: "fallback",
            objectId: object.id,
        };
        fidelity.issues.push(issue);
        fidelity.objects.push({
            objectId: object.id,
            level: issue.level,
            issues: [issue],
        });
        fidelity.level = mergeFidelityLevels(fidelity.level, issue.level);
    }
    return {
        request: {
            presentationHtml: buildOneNotePresentationHtml(title, imageTags),
            parts,
        },
        fidelity,
    };
}
function renderStrokeAsOneNoteImage(stroke, options) {
    const bounds = expandBounds(stroke.bounds, options.padding);
    const width = normalizeSize(bounds.width);
    const height = normalizeSize(bounds.height);
    return {
        part: {
            name: options.partName,
            contentType: "text/html",
            content: buildRenderedStrokeHtml(stroke, bounds),
        },
        imageTag: `<img data-render-src="name:${escapeHtmlAttribute(options.partName)}" style="position:absolute;top:${roundNumber(bounds.y)}px;left:${roundNumber(bounds.x)}px;width:${roundNumber(width)}px;height:${roundNumber(height)}px" />`,
    };
}
function buildOneNotePresentationHtml(title, imageTags) {
    return [
        "<!DOCTYPE html>",
        "<html>",
        "<head>",
        `<title>${title}</title>`,
        "</head>",
        '<body data-absolute-enabled="true">',
        ...imageTags,
        "</body>",
        "</html>",
    ].join("");
}
function buildRenderedStrokeHtml(stroke, bounds) {
    const width = normalizeSize(bounds.width);
    const height = normalizeSize(bounds.height);
    const points = stroke.points
        .map((point, index) => {
        const prefix = index === 0 ? "M" : "L";
        return `${prefix} ${roundNumber(point.x - bounds.x)} ${roundNumber(point.y - bounds.y)}`;
    })
        .join(" ");
    const dashArray = mapDashToSvg(stroke.style.dash, stroke.style.width);
    return [
        "<!DOCTYPE html>",
        "<html>",
        "<body style=\"margin:0;padding:0;background:transparent;\">",
        `<svg xmlns="http://www.w3.org/2000/svg" width="${roundNumber(width)}" height="${roundNumber(height)}" viewBox="0 0 ${roundNumber(width)} ${roundNumber(height)}">`,
        `<path d="${points}" fill="none" stroke="${escapeHtmlAttribute(stroke.style.color)}" stroke-width="${roundNumber(stroke.style.width)}" stroke-opacity="${roundNumber(stroke.style.opacity)}" stroke-linecap="round" stroke-linejoin="round"${dashArray ? ` stroke-dasharray="${dashArray}"` : ""} />`,
        "</svg>",
        "</body>",
        "</html>",
    ].join("");
}
function mapDashToSvg(dash, width) {
    if (dash === "dashed") {
        return `${roundNumber(width * 3)} ${roundNumber(width * 2)}`;
    }
    if (dash === "dotted") {
        return `${roundNumber(width)} ${roundNumber(width * 1.5)}`;
    }
    return null;
}
function expandBounds(bounds, padding) {
    return {
        x: bounds.x - padding,
        y: bounds.y - padding,
        width: bounds.width + padding * 2,
        height: bounds.height + padding * 2,
    };
}
function normalizeSize(value) {
    return Math.max(1, value);
}
function roundNumber(value) {
    return Math.round(value * 1000) / 1000;
}
function escapeHtml(value) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}
function escapeHtmlAttribute(value) {
    return escapeHtml(value)
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
//# sourceMappingURL=export.js.map