# VectorBridge

VectorBridge is a cross-app ink translation tool that lets users move editable pen strokes between whiteboard and note-taking apps such as Excalidraw, OneNote, and Miro.

Instead of flattening handwriting into an image, VectorBridge converts source ink data into a canonical document model and then exports that model into the target app's native format.

## Problem

Modern whiteboard and note-taking apps support freehand writing, but each app stores ink differently.

That creates a common user problem:

- a stroke copied from Excalidraw cannot be pasted directly into Miro
- handwritten notes from OneNote lose editability outside OneNote
- pressure, color, width, and stroke structure are often lost during migration

Users can usually transfer visuals, but not editable ink.

## Solution

VectorBridge acts as a universal ink bridge.

High-level flow:

1. Read the source app's stroke data.
2. Convert it into a neutral canonical schema.
3. Export that schema into the target app's native editable format.
4. Report how much fidelity was preserved.

## Product Goal

Copy ink once, keep editing anywhere.

## MVP

The first practical version should focus on one end-to-end path:

- import freehand stroke data from Excalidraw
- normalize it into the canonical document model
- export it into one target format
- validate whether the result stays editable

Recommended first target:

- `Excalidraw -> Canonical -> Miro`

Current app-facing flow in the repo:

1. ask the user where they copied from
2. ask the user where they want to paste
3. resolve the matching adapter pipeline
4. convert through the canonical model
5. return the target-ready payload plus fidelity info

Why this path:

- Excalidraw data is relatively accessible
- it exercises both import and export architecture
- it proves the core value without needing every integration at once

## Core Concepts

VectorBridge is built around three ideas:

- adapters for reading and writing app-specific formats
- a canonical schema that represents ink in a neutral way
- fidelity reporting so users know what stayed editable and what degraded

See:

- [Canonical schema](./docs/SCHEMA.md)
- [MVP plan](./docs/MVP.md)
- [Architecture](./docs/ARCHITECTURE.md)
- [Editability strategy](./docs/EDITABILITY.md)
- [Miro integration notes](./docs/MIRO.md)
- [OneNote integration notes](./docs/ONENOTE.md)
- [Browser extension prototype](./docs/EXTENSION.md)

## Expected Challenges

- different apps model freehand ink differently
- some apps expose native stroke data more easily than others
- coordinate systems, stroke smoothing, pressure, and style metadata may not map perfectly
- some conversions may require fallback behavior when exact editability is impossible

## Long-Term Vision

Over time, VectorBridge can evolve from a file or API converter into a true clipboard bridge for editable ink across apps.
