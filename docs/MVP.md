# MVP Plan

## Goal

Prove that editable ink can move between apps through a canonical model.

The MVP should answer one question clearly:

Can we take freehand strokes from one app, convert them through a neutral format, and recreate them in another app as editable objects with acceptable fidelity?

## Recommended First Scope

Build one end-to-end pipeline:

`Excalidraw -> Canonical -> Miro`

This keeps the first version focused while validating the most important technical assumptions.

## What The MVP Must Do

- import an Excalidraw scene or selected freehand elements
- extract freehand stroke geometry and visual style
- convert those strokes into the canonical schema
- export the canonical objects into a Miro-compatible editable representation
- produce a fidelity report for each converted object

## What The MVP Can Ignore

- real-time clipboard integration
- every shape type beyond freehand ink
- collaborative sync
- round-trip perfection
- full OneNote support in version one
- production UI polish

## Success Criteria

The MVP is successful if:

- a user can take sample Excalidraw stroke data and convert it into Miro
- the result appears visually close to the original
- the result remains editable in the target app
- the system can explain any lost fidelity

## Milestones

### 1. Define the canonical ink model

- finalize the minimum schema required for freehand strokes
- include style, geometry, bounds, ordering, and metadata hooks

### 2. Build the Excalidraw importer

- parse relevant scene data
- map freehand elements into canonical stroke objects
- normalize coordinates and styling

### 3. Build the Miro exporter

- map canonical strokes into Miro-supported objects
- apply transforms and style values
- record unsupported properties as fidelity warnings

### 4. Add test fixtures

- create sample Excalidraw inputs
- define expected canonical outputs
- define expected Miro export payload structure

### 5. Add verification

- schema-level unit tests
- converter snapshot tests
- manual visual comparison for sample scenes

## Risks To Watch Early

- Miro may not support editable freehand data in exactly the way needed
- some stroke attributes may need approximation rather than exact preservation
- source and target coordinate systems may not align cleanly
- pressure and smoothing behavior may vary significantly by app

## Suggested Next Step After MVP

After the first path works, add one of:

- `Canonical -> OneNote`
- `OneNote -> Canonical`
- clipboard-oriented UX on top of the converter core
