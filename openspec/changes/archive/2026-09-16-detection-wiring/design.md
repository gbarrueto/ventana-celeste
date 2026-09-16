## Context

`web-app` splits into two devices talking over the Protobject/WebRTC bus (`src/lib/protobject.js`,
built on `@ventanaceleste/core`'s transport-agnostic `createMessageBus`): the **viewer**
(`src/viewer/Viewer.svelte`, the shared big screen) owns the one live Stellarium engine that
matters for the public view, and the **phone** (`src/telescope-ui/`) is the personal remote.
Orientation (`src/lib/orientation.js`) reads the phone's gyro and throttles `updateView`
messages to the viewer, which is the only place `engine.core.observer.yaw/pitch` reflects the
live "where is it pointing" state. Advanced mode's `ScreenAdvanced.svelte` boots a *second*,
independent engine on the phone purely to mirror the eyepiece preview locally — Simple mode
does not, and this change does not add one.

`apps/device-lab/sky.html` already wires `@ventanaceleste/core`'s detection/marking/guidance
trio together end to end, single-device, single-engine (see its "Objetos del cielo" and "Guía
hacia lo marcado" sections). That file is the reference for exactly which functions to call
and in what order; this design ports the same pattern across the phone/viewer split instead of
reinventing it.

`ScreenSimple.svelte`'s existing copy — "Toca un nombre y la pantalla grande te lleva hasta
él" — already states the intended UX: the phone picks, the *viewer* is where guidance shows.

See proposal.md for the "why". See specs/target-guidance/spec.md for the required behavior.

## Goals / Non-Goals

**Goals:**
- Reuse `listVisibleTargets`, `selectTarget`, `clearSelection`, `getSelectedTarget`,
  `getTargetGuidance` from `@ventanaceleste/core` exactly as `device-lab/sky.html` calls them —
  no changes to `packages/core/src/sky/*`.
- Keep the engine only on the viewer for Simple mode; no second WASM engine on the phone.
- Make the existing Simple-mode list and its "Estás mirando" hero card live instead of static.

**Non-Goals:**
- Advanced mode (`ScreenAdvanced.svelte`) is untouched — it has no fixed list to wire up, and
  it already runs its own mirrored engine for a different purpose (eyepiece preview).
- No new filtering UI (altitude threshold, kind toggles) on the phone. Detection uses
  `listVisibleTargets()`'s defaults (`minAltitudeDeg: 10`, all kinds) as `device-lab` does out
  of the box.
- No bespoke per-object copy for the full ~50-entry catalog (see proposal's BREAKING note);
  list rows show name + kind label instead of a hand-written tagline.

## Decisions

### Detection runs on the viewer and is pushed to the phone, not the reverse
The viewer holds the only engine with a live, gyro-driven view. Running `listVisibleTargets()`
there and pushing the result over the bus avoids standing up a second engine on the phone just
to answer "what's up right now" — a question only the viewer's engine can answer anyway (it
also depends on observer time/location, already synced there).

- New message **`visibleTargets`** (viewer → phone, `sendThrottled`, ~every 5 s — the same
  cadence `device-lab`'s `autoRefresco` interval uses): `{ list: [{ id, alt, az, magnitude }] }`.
  Only `id` plus the numbers that change are sent; `name`/`kind`/icon come from the catalog
  already bundled in `@ventanaceleste/core` on the phone (`SKY_TARGETS`, imported for display
  only — no engine calls on that side).
- Alternative considered: have the phone request a one-shot list on demand (tap "refresh").
  Rejected — it re-adds the manual staleness `device-lab` avoids with its interval, and the
  list is cheap to keep current since the viewer is already ticking.

### Marking travels phone → viewer as an id; guidance never leaves the viewer
- New message **`selectTarget`** (phone → viewer): `{ id }` or `{ id: null }` to clear. Viewer
  handler resolves `id` via `getTargetById(id)` and calls `selectTarget(engine, target)` /
  `clearSelection(engine)` — mirroring `device-lab`'s `$('desmarcar').onclick`.
- Guidance (`getTargetGuidance`) is computed and rendered **only on the viewer**, once per
  frame, over its own `stel-canvas` — the same per-frame `requestAnimationFrame` loop
  `device-lab/sky.html`'s guidance IIFE uses, with `width`/`height` from the canvas's
  client rect, `rotationDeg: 0` (the viewer canvas is never rotated, unlike a mounted
  ocular), and no explicit `center` (defaults to geometric center). This needs no new
  message: it's pure client-side math against state the viewer already owns. It also means a
  touch-selection made directly on the viewer gets guided the same way, for free.
- The viewer keys guidance off `getSelectedTarget(engine)` each frame rather than tracking "the
  id the phone last sent" — this is what makes a direct touch on the big screen (which sets
  `core.selection` outside this feature's own code path) also produce guidance, and is exactly
  `device-lab`'s reconciliation comment: "El motor también marca por toque en el cielo, así que
  la lista se entera de lo que pasó afuera en vez de creerle sólo a sus propios botones."
- Feeding that same `getSelectedTarget(engine)` reading back into the `visibleTargets` push
  (as a `selectedId` field) is what lets the phone's list highlight a viewer-side touch
  selection, satisfying the spec's "mark made on the viewer is reflected on the phone"
  scenario without a separate message type.

### Interval lifecycle piggybacks on the existing mode messages
`protobject.js` already has `bus.on('simpleSettings', ...)` / `bus.on('advancedSettings', ...)`,
sent whenever `App.svelte`'s mode switch fires. The new `visibleTargets` push interval starts
inside `enableSimpleModeSettings()` and stops inside `enableAdvancedModeSettings()`, the same
place hints/overlays already toggle per mode — no new start/stop message pair needed. This also
means the interval is naturally stopped while the phone is in Advanced mode, matching this
change's Simple-mode-only scope.

### List content: kind label instead of per-object tagline
`ScreenSimple.svelte` currently shows a bespoke one-line description per placeholder object.
With ~50 real catalog entries, authoring that copy is out of scope (see proposal). Rows instead
show the translated kind (`planeta`, `estrella`, `cúmulo`, `nebulosa`, `galaxia`,
`constelación`, `luna`) — the same labeling `device-lab`'s `ETIQUETA_TIPO` table already uses,
just localized for the public-facing string. Icon per row comes from a small `kind → icon name`
table using icons already inlined in `Icon.svelte` (`moon-star`, `orbit`, `sparkles`, `cloud`,
`globe`); no new icon assets.

## Risks / Trade-offs

- [Phone shows a stale list if the WebRTC link drops] → Existing peer-monitor/connection-lost
  UI (`ScreenConnect`, `conn` state in `App.svelte`) already surfaces a disconnected state on
  top of this; no new handling needed, but the list itself keeps its last-received contents
  rather than clearing, consistent with how other synced values (e.g. FOV) behave today.
- [5 s push interval adds another periodic engine query alongside the existing seeing/FOV/time
  sync traffic] → `listVisibleTargets()`'s cost is one `resolveTarget` + `getObjectAltAz` per
  catalog entry (~50), cached per-engine per `objects.js`'s `WeakMap`; `device-lab` already runs
  this on every tab-visible refresh without a measured cost concern.
- [Guidance overlay adds a second per-frame `requestAnimationFrame` loop on the viewer, next to
  the engine's own render loop and the seeing overlay's] → Same pattern already coexists in
  `device-lab/sky.html`; the guidance loop does no GPU work, just DOM style writes gated by
  `guia.inView`.

## Migration Plan

Additive and internal-only:
1. Add the two message handlers (`visibleTargets`, `selectTarget`) alongside existing ones in
   `protobject.js` — no versioning concern since both ends of the bus ship together as one app.
2. Swap `ScreenSimple.svelte`'s data source; delete
   `dictionaries/placeholders/targets.js` once nothing imports it.
3. No data migration, no feature flag — this is a fixed-list-to-live-list swap behind the
   existing Simple/Advanced mode switch, which already exists.
