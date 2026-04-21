# OneNote Integration Notes

## Current Reality

VectorBridge can target OneNote through Microsoft Graph page creation, but not through a native ink-stroke creation API.

The supported building blocks exposed by Microsoft Graph are:

- OneNote pages created or updated with HTML
- absolutely positioned `img`, `div`, and `object` elements
- image rendering from binary image data
- image rendering from HTML blocks in multipart requests

For VectorBridge, that makes the most practical export path:

`Canonical Stroke -> rendered HTML/SVG block -> absolute-positioned OneNote image`

## What This Means For Fidelity

This preserves visual placement on the page, but not editable OneNote ink semantics.

So for now, OneNote exports should be classified as:

- `fallback` for freehand strokes

## Supported Export Mode In This Repo

Use `exportDocumentToOneNote()` to build a Microsoft Graph page-create payload with:

- `presentationHtml` for the page body
- multipart `text/html` parts for each rendered stroke image

The generated page HTML uses:

- `data-absolute-enabled="true"` on `<body>`
- one absolutely positioned `<img data-render-src="name:...">` per stroke

## Authentication Note

Microsoft says the Graph OneNote API no longer supports app-only authentication as of March 31, 2025.

That means production integrations should plan around delegated authentication.

## Recommended Future Work

- confirm whether any OneNote desktop or Office add-in surface exposes writable native ink objects
- add Graph request builders for page create and patch flows
- add a native path later only if Microsoft exposes true ink creation APIs
