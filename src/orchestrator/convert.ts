import type { CanonicalDocument } from "../core/types.js";

export interface ImportAdapter<TInput> {
  import(input: TInput): CanonicalDocument;
}

export interface ExportAdapter<TOutput> {
  export(document: CanonicalDocument): TOutput;
}

export function convert<TInput, TOutput>(
  input: TInput,
  importer: ImportAdapter<TInput>,
  exporter: ExportAdapter<TOutput>,
): TOutput {
  const canonical = importer.import(input);
  return exporter.export(canonical);
}
