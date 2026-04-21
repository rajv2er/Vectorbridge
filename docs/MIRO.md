# Miro Integration Notes

## Current Reality

VectorBridge can export canonical content into Miro today, but public Miro APIs still do not expose native writable pen strokes.

Based on Miro's official platform docs:

- `Stroke` is listed as an unsupported board item
- the Web SDK does not support create, read, update, or delete operations for strokes
- the REST API also does not provide native stroke creation
- supported items such as `Shape`, `Text`, `Connector`, and `Image` can be created
- supported board items can carry app metadata, with a documented `6 KB` per-item metadata limit
- Miro also exposes app-level storage for larger app data

That means the best currently supported export path is:

`Canonical Document -> best visible Miro items -> hidden VectorBridge bridge payload`

## What This Means For Fidelity

This path can preserve either:

- `editable` when canonical shapes, text, or lines map directly to native Miro items
- `bridge_editable` when a stroke is approximated visually but VectorBridge also preserves a hidden canonical payload for later recovery
- `fallback` only when VectorBridge cannot preserve the hidden payload

## Supported Export Modes In This Repo

### REST API payload

Use `exportDocumentToMiro()` when preparing payloads for:

- visible item creation requests
- a follow-up bridge plan describing metadata writes or app-storage records

### Web SDK payload

Use `exportDocumentToMiroWebSdk()` when preparing payloads for:

- `miro.board.createImage({...})`

The REST exporter now returns:

- `items`: visible Miro item create payloads
- `bridge`: a plan for hidden payload persistence

The bridge plan can use:

- inline item metadata when the serialized bridge payload fits
- app-storage records plus metadata pointers when the payload is too large

## Recommended Future Work

If Miro later adds native programmable stroke support, the exporter should add a new higher-fidelity path:

- `Canonical Stroke -> Native Miro Stroke`

Until then, the dual-layer export strategy is the most practical path to preserve editability through VectorBridge.
