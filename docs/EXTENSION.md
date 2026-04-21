# Browser Extension Prototype

## What It Does

This prototype extension is the first step away from manual JSON pasting.

Current flow:

1. open Excalidraw in the browser
2. copy content inside Excalidraw
3. the content script captures clipboard text from the `copy` event
4. the extension stores the latest captured payload in `chrome.storage.local`
5. the popup lets the user choose the target app once and save that preference
6. the popup converts the captured payload through `convertBetweenApps()`
7. the converted result can be copied back to the clipboard

## Current Limits

- source support is only `Excalidraw`
- the content script currently captures textual clipboard payloads only
- the popup expects the captured payload to be JSON that matches the Excalidraw importer
- target outputs are still payload-oriented, not true native paste injection

## How To Run

1. run `npm run build:extension`
2. open Chrome extensions page
3. enable Developer Mode
4. choose `Load unpacked`
5. select the `extension/` folder

## Why This Matters

This is the first real product-shaped integration in the repo:

- the user no longer pastes JSON into the demo manually
- Excalidraw copy events are captured automatically
- target preference is saved once in extension storage
- conversion can happen from the popup using the real VectorBridge pipeline

## Next Step

The next milestone is deeper app integration:

- better Excalidraw-specific clipboard extraction
- direct paste helpers for a target environment
- support for more source apps
