# Editability Strategy

## Core Recommendation

The most practical way to preserve editability across apps is a dual-layer model:

1. create the best target-side visual or native object that the target platform supports
2. store a hidden VectorBridge payload that contains the canonical document

That hidden payload becomes the source of truth for later re-editing and re-export.

## Why This Is Needed

Some platforms still do not expose public APIs for creating native ink objects.

- Miro documents `Stroke` as an unsupported board item, so it cannot currently be created or updated programmatically
- OneNote Graph supports page HTML, images, and file attachments, but not public native ink creation
- OneNote Office.js exposes `FloatingInk` and `InkStroke` for reading existing ink, but the public docs do not show a matching create API

So a direct "native editable everywhere" bridge is not realistic today.

## The Model To Implement

VectorBridge should distinguish three levels of editability:

- `editable`: native target objects are created and remain editable inside the target app
- `bridge_editable`: the target app may only show a fallback representation, but VectorBridge can recover the original canonical data later
- `fallback`: only appearance survives; no hidden canonical payload is preserved

## Hidden Payload Format

Use a portable envelope that stores:

- source app and source format
- capture timestamp
- canonical document
- target-specific storage hints

The repo now includes a core `BridgePayloadEnvelope` type and serializers in `src/core/bridgePayload.ts`.

## Platform Strategy

### Excalidraw

Excalidraw is the easiest source because it uses an open JSON scene format and supports clipboard and export workflows in its open-source app.

Recommended use:

- treat Excalidraw as the primary source app first
- capture scene or clipboard JSON
- convert into the canonical document

### Miro

Best strategy:

- render a visible fallback item such as an image
- attach a small canonical payload directly to supported board-item metadata when it fits
- if the payload is too large, store a pointer in item metadata and keep the full payload in app storage or an external blob store

Why this is workable:

- Miro allows board-item metadata on `Image`, `Shape`, `Text`, and several other supported items
- Miro documents a `6 KB` item-metadata limit
- Miro also documents app storage options for larger payloads

This means Miro can become `bridge_editable` even when it cannot be `editable`.

### OneNote

Best strategy:

- render the visual result using absolute-positioned `img` elements
- attach a sidecar `.vectorbridge.json` payload as a OneNote file attachment, or store an external blob pointer on the page and keep the full payload elsewhere

Why this is workable:

- Microsoft Graph supports absolute-positioned `img` and `object` elements on OneNote pages
- Microsoft Graph supports file attachments through `object`

This gives OneNote a realistic `bridge_editable` path even without native ink creation.

## Suggested First Implementation

Implement this in the following order:

1. Add a bridge payload envelope to every conversion result.
2. Update Miro export to optionally attach bridge payload metadata or a pointer.
3. Update OneNote export to optionally add a sidecar attachment.
4. Teach the browser extension and future integrations to prefer bridge payloads over visual fallback data when copying back out.

## Important Constraint

This strategy preserves editability through VectorBridge, not necessarily through the target app's own native pen tool.

That is still valuable:

- users keep a visually correct target object
- VectorBridge can round-trip the exact stroke data later
- you stop losing structure after the first cross-app transfer
