## Why

`packages/core/src/sky` already implements detection (`listVisibleTargets`), marking
(`selectTarget`/`clearSelection`) and guidance (`getTargetGuidance`) against the Stellarium
engine, and `device-lab/sky.html` exercises all three end to end. `web-app`'s Simple mode
("Esta noche" list in `ScreenSimple.svelte`) still shows a hardcoded 3-item placeholder
(`dictionaries/placeholders/targets.js`): tapping an entry only changes local UI state — it
never touches the engine, so nothing is actually detected, marked, or pointed to. The
screen's own copy already promises the wiring ("Toca un nombre y la pantalla grande te lleva
hasta él") that isn't implemented yet.

## What Changes

- Replace the static target list in `ScreenSimple.svelte` with the live, filtered catalog:
  the **viewer** (big screen) periodically runs `listVisibleTargets()` against its Stellarium
  engine — the phone in Simple mode holds no engine of its own — and pushes the result to the
  phone over the existing Protobject message bus.
- Tapping an entry on the phone sends the target id to the viewer, which calls
  `selectTarget()`/`clearSelection()` on its engine — the same `core.selection` mechanism a
  direct touch on the big screen already uses, so the object is marked (highlighted) there.
- The viewer renders a directional guidance overlay (arrow + separation) from
  `getTargetGuidance()` on its own canvas, following whatever the engine currently has
  selected — from the phone's list or from a touch on the big screen — and hides once the
  object is in view. This is the same per-frame pattern `device-lab/sky.html` already uses.
- **BREAKING** (internal only): `ScreenSimple.svelte` drops
  `dictionaries/placeholders/targets.js` as its data source; the per-object `desc` tagline
  (bespoke copy for 3 objects) is replaced by a per-kind label (`planeta`, `estrella`,
  `nebulosa`, ...), since the full catalog has ~50 objects and authoring bespoke copy for
  each is out of scope here.
- Scope is Simple mode only — Advanced mode (`ScreenAdvanced.svelte`) has no fixed-list
  display and is unaffected.

## Capabilities

### New Capabilities
- `target-guidance`: detecting which catalog objects are currently visible, marking one as
  selected on the shared engine, and guiding the observer to it — surfaced end to end between
  `web-app`'s phone (Simple mode) and viewer screens.

### Modified Capabilities
(none — no existing specs cover this behavior yet)

## Impact

- `apps/web-app/src/telescope-ui/ScreenSimple.svelte`: live list, selection tap handling.
- `apps/web-app/src/telescope-ui/dictionaries/placeholders/targets.js`: removed.
- `apps/web-app/src/lib/stellarium.js`: new viewer-side functions to start/stop the detection
  push and to apply a selection message against the engine.
- `apps/web-app/src/lib/protobject.js`: two new message types (viewer→phone visible-list
  push, phone→viewer select-target).
- `apps/web-app/src/viewer/Viewer.svelte`: guidance overlay rendered over `stel-canvas`.
- No changes to `packages/core/src/sky/*` — this change only wires up what already exists.
