# Excalidraw Fixtures

These fixture files are small, stable sample scenes for importer and converter tests.

## Files

- `single-freedraw.excalidraw.json`: one simple freehand stroke
- `multi-freedraw.excalidraw.json`: multiple freehand strokes with different styles
- `mixed-elements.excalidraw.json`: freehand plus unsupported elements for fidelity testing

## Purpose

Use these fixtures to verify:

- coordinate normalization
- style mapping
- pressure capture
- z-order preservation
- unsupported element reporting
