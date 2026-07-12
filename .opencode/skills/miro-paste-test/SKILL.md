---
name: miro-paste-test
description: Use when verifying Miro clipboard rendering for VectorBridge. Encodes the manual paste-test workflow required to confirm shapes and strokes render instantly in Miro. Trigger when the user mentions testing Miro paste, rendering bugs, widgets not appearing, or asking to verify a clipboard fix.
---

# Miro Paste-Test Workflow

This is the ONLY valid way to verify that a VectorBridge clipboard fix works.
Node tests, unit tests, and code inspection are NOT sufficient — Miro's live
canvas renderer has its own behavior that no script can replicate.

## Why manual testing is required

Miro may store widgets correctly (they appear after board reload) but skip
them in the live paste renderer. This only manifests on a real paste into a
live Miro board. See `BUGS/HANDOFF_SHAPE_RENDER_BUG.md` for the full history.

## The test (always run all steps)

1. Go to `chrome://extensions`, find **VectorBridge Prototype**, click the
   reload icon. This step is CRITICAL — the extension caches code.
2. In Excalidraw, draw **multiple freehand strokes AND a rectangle** (or
   ellipse). Select all of them together.
3. Copy with Cmd/Ctrl+C.
4. Open the VectorBridge popup.
   - Set **Copying from: Excalidraw**.
   - Set **Pasting to: Miro (Direct Paste)**.
   - Click **Convert**.
5. The popup should report a `widgetCount` greater than zero and show
   `Ready to paste in Miro.` If it does not, the conversion failed — stop
   here and debug the conversion, not the renderer.
6. Switch to a Miro board and paste with Cmd/Ctrl+V.
7. Watch the board carefully:
   - **Do both shapes AND strokes appear IMMEDIATELY on paste?**
   - If yes: the fix worked.
   - If widgets only appear after reloading the board: the renderer is still
     skipping them — the fix did NOT work.

## Decision tree after observing the result

| Observation | Verdict | Next action |
|---|---|---|
| Shapes + strokes appear instantly | FIXED | Report success, commit the change. |
| Widgets appear only after board reload | NOT FIXED | The renderer is still skipping the live paste. Investigate the HTML wrapper format, the envelope `meta.widgetToken` type, or widget-count thresholds. Do NOT claim success. |
| Nothing appears, even after reload | REGRESSION | The change broke the payload. Revert immediately. |

## Strict rules

- NEVER claim the bug is fixed based on node/unit tests alone.
- NEVER claim success without the user confirming a real paste into Miro.
- After changing `clipboard.js`, ALWAYS have the user reload the extension
  before testing — stale cached code will produce false results.

## Where the relevant code lives

- `extension/vendor/vectorbridge/adapters/miro/clipboard.js` — canonical → Miro
  payload + HTML wrapper. This is where rendering bugs usually live.
- `extension/popup.js` — clipboard read/write, popup UI.
- `extension/manifest.json` — extension manifest and permissions.
