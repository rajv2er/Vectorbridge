# Architecture

## Design Principle

Every integration should be isolated behind adapters.

VectorBridge should never convert directly from one app format to another app format.
It should always pass through a canonical model.

Flow:

`Source Adapter -> Canonical Model -> Target Adapter`

## Main Layers

### 1. Canonical Model

The canonical model is the source of truth inside the system.

It should represent:

- freehand stroke points
- stroke style
- transforms and bounds
- z-order
- page or canvas grouping
- metadata for round-trip or app-specific details

This layer should be stable even as new apps are added.

The canonical model should also preserve unmapped source data in an opaque metadata block.
That metadata should not affect the neutral schema itself, but it should travel with the object so a round-trip back into the original app can recover source-specific properties when possible.

Example uses:

- preserve Excalidraw roughness or seed values
- retain source object identifiers for traceability
- keep target-specific export hints without exposing them as first-class canonical fields

## Canonical Coordinate System

All adapters must agree on one central coordinate model.

Canonical assumptions:

- origin `(0, 0)` is the top-left of the object or page coordinate space
- units are absolute pixels
- positive `x` moves right
- positive `y` moves downward
- rotation is clockwise in degrees
- the canvas is logically infinite, even if the source app uses fixed pages

This matters because some apps are page-based and others use an infinite whiteboard.
Import adapters must normalize source coordinates into this canonical space, and export adapters must map canonical coordinates into the target app's layout rules.

### 2. Import Adapters

An import adapter reads a source app's native format and produces a canonical document.

Examples:

- `ExcalidrawImportAdapter`
- `OneNoteImportAdapter`

Responsibilities:

- parse source data
- map native objects into canonical objects
- normalize coordinates and units
- preserve app-specific metadata when useful

### 3. Export Adapters

An export adapter takes a canonical document and creates a target app payload.

Examples:

- `MiroExportAdapter`
- `OneNoteExportAdapter`

Responsibilities:

- map canonical objects into target-native objects
- convert coordinates and style values into target expectations
- generate fidelity warnings when features cannot be preserved exactly

### 4. Conversion Orchestrator

The orchestrator coordinates the end-to-end pipeline.

Responsibilities:

- select the correct source and target adapters
- validate inputs and outputs
- run normalization steps
- collect fidelity results

### 5. Validation And Testing

This layer ensures the translation is safe and understandable.

Responsibilities:

- schema validation
- fixture-driven adapter tests
- round-trip and regression tests
- visual diff or manual comparison support

## Suggested Source Layout

```text
src/
  core/
    types.ts
    fidelity.ts
    normalize.ts
    bounds.ts
  adapters/
    excalidraw/
      import.ts
      mapStroke.ts
    miro/
      export.ts
      mapStroke.ts
    onenote/
      import.ts
      export.ts
  orchestrator/
    convert.ts
  fixtures/
    excalidraw/
  tests/
    core/
    adapters/
```

## Canonical Object Strategy

For the first version, the canonical model should optimize for freehand strokes first, not every drawing primitive.

A practical strategy is:

- define a small stable base for all objects
- define a dedicated stroke object with raw sampled point arrays and stroke-specific style
- leave room for future shapes, text, and connectors

That keeps the MVP focused on the real product value.

For stroke representation, the canonical format should store raw points rather than Bezier curves or other higher-level spline primitives.

Recommended shape:

- `points: [{ x, y, pressure?, t?, tilt? }]`

Why this choice:

- raw points are the safest shared denominator across apps
- curves can be generated from points during export if needed
- native raw samples are often difficult or impossible to recover from a curve-only representation
- pressure-aware ink fits naturally into the point stream

## Fidelity Model

Each conversion should return both output data and a fidelity report.

Example categories:

- `editable`: fully preserved as native editable object
- `bridge_editable`: target representation may be partial, but VectorBridge preserves a hidden canonical payload for later recovery
- `approximate`: editable, but with degraded properties
- `fallback`: visually preserved, but no longer fully editable
- `unsupported`: could not be exported

This is important because not every app pair will support perfect translation.

For difficult platforms, the preferred long-term strategy is dual-layer export:

- a visible target object for the host app
- a hidden VectorBridge payload for later re-editing or re-export

## Technical Priorities

Prioritize these in order:

1. clean canonical schema
2. one strong import adapter
3. one strong export adapter
4. fixture-based tests
5. developer-facing CLI or API surface
6. clipboard UX later

## Recommended Build Order

1. Define `types.ts` for the canonical schema.
2. Implement Excalidraw import for freehand strokes only.
3. Implement Miro export for the same stroke subset.
4. Add fixtures and tests for known samples.
5. Add fidelity reporting.
6. Expand object support and integrations.
