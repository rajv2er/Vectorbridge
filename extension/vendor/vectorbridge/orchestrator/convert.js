export function convert(input, importer, exporter) {
    const canonical = importer.import(input);
    return exporter.export(canonical);
}
//# sourceMappingURL=convert.js.map