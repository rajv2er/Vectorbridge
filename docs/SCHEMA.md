# Canonical Schema

The canonical schema is the neutral format inside VectorBridge.

Its job is simple:

- accept ink data from a source app
- represent that data in a stable internal structure
- export it into a target app's native format

## Core Translation Model

```text
Excalidraw JSON -> Canonical Document -> Miro payload
OneNote data    -> Canonical Document -> Other target formats
```

VectorBridge should always translate through this neutral format instead of converting app-to-app directly.

## Design Goals

- prioritize editable freehand ink first
- preserve geometry and visual style
- support metadata for round-trip recovery
- stay small enough for adapters to implement consistently

## Main Types

### Point

One recorded point in a stroke path.

The canonical stroke format uses raw sampled points as the source of truth.
Adapters may generate smooth curves during export, but the neutral model should store the point stream itself.

```ts
interface Point {
  x: number;
  y: number;
  t?: number;
  pressure?: number;
  tilt?: number;
}
```

### StrokeStyle

Visual properties for freehand ink.

```ts
interface StrokeStyle {
  color: string;
  width: number;
  opacity: number;
  dash?: "solid" | "dashed" | "dotted";
}
```

### Transform

Placement and geometric transformation.

```ts
interface Transform {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
}
```

### Bounds

Cached bounds make export easier and reduce repeated recalculation.

```ts
interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}
```

### CanonicalStroke

The most important object in the MVP.

```ts
interface CanonicalStroke {
  id: string;
  kind: "stroke";
  points: Point[];
  style: StrokeStyle;
  transform: Transform;
  bounds: Bounds;
  zIndex: number;
  metadata?: Record<string, unknown>;
}
```

The `metadata` field is intentionally opaque.
It exists so adapters can preserve source-specific values that do not belong in the clean neutral schema, such as roughness, native object ids, smoothing hints, or round-trip data.

### CanonicalPage

Represents one canvas or page.

```ts
interface CanonicalPage {
  id: string;
  name: string;
  objectIds: string[];
}
```

### CanonicalDocument

Top-level container for all objects and pages.

```ts
interface CanonicalDocument {
  version: string;
  id: string;
  title: string;
  objects: Record<string, CanonicalStroke>;
  pages: CanonicalPage[];
  activePageId: string;
  metadata?: Record<string, unknown>;
}
```

## Example

```json
{
  "version": "1.0",
  "id": "doc-123",
  "title": "Ink Sample",
  "objects": {
    "stroke-1": {
      "id": "stroke-1",
      "kind": "stroke",
      "points": [
        { "x": 10, "y": 20, "pressure": 0.6 },
        { "x": 14, "y": 23, "pressure": 0.7 }
      ],
      "style": {
        "color": "#111111",
        "width": 2,
        "opacity": 1,
        "dash": "solid"
      },
      "transform": {
        "x": 0,
        "y": 0,
        "scaleX": 1,
        "scaleY": 1,
        "rotation": 0
      },
      "bounds": {
        "x": 10,
        "y": 20,
        "width": 4,
        "height": 3
      },
      "zIndex": 0
    }
  },
  "pages": [
    {
      "id": "page-1",
      "name": "Page 1",
      "objectIds": ["stroke-1"]
    }
  ],
  "activePageId": "page-1"
}
```

## Adapter Rules

When building an adapter:

1. Read the source format.
2. Convert supported objects into canonical objects.
3. Preserve useful source metadata where round-trip may matter.
4. Export from the canonical model into the target format.
5. Report unsupported or degraded properties.

## Fidelity Levels

Each export should classify results into one of these levels:

- `editable`: full native editability preserved
- `approximate`: editable, but not fully faithful
- `fallback`: visible result preserved, editability reduced
- `unsupported`: object could not be represented

## Coordinate System

Canonical assumptions:

- origin is top-left
- units are pixels
- the canvas is logically infinite
- positive `y` moves downward
- positive `x` moves right
- rotation is clockwise in degrees

Adapters are responsible for converting from and into app-specific coordinate systems.

## Extensibility

The MVP should focus on strokes only.

Later versions can extend the schema with:

- rectangles
- ellipses
- text
- arrows and connectors
- grouped objects

Those additions should extend the schema without breaking the stroke-first core.
