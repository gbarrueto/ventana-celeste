## 1. Viewer: detection push

- [x] 1.1 In `apps/web-app/src/lib/stellarium.js`, import `listVisibleTargets`, `getTargetById`,
      `getSelectedTarget` from `@ventanaceleste/core` and add `startVisibleTargetsPush()` /
      `stopVisibleTargetsPush()`, mirroring the existing `setDatetimeInterval()` /
      `clearDatetimeInterval()` pair: an interval (~5000 ms) that runs `listVisibleTargets(engine)`
      plus `getSelectedTarget(engine)`, and sends a `visibleTargets` message
      (`{ list: [{ id, alt, az, magnitude }], selectedId }`) to `telescope.html`. Verify by calling
      `startVisibleTargetsPush()` in a running dev session and observing the message logged on the
      phone side (`onTelescopeMessage` console/log).
- [x] 1.2 In `apps/web-app/src/lib/protobject.js`, call `startVisibleTargetsPush()` inside
      `enableSimpleModeSettings()`'s call site and `stopVisibleTargetsPush()` inside
      `enableAdvancedModeSettings()`'s (i.e. wire them into the existing
      `bus.on('simpleSettings', ...)` / `bus.on('advancedSettings', ...)` handlers). Verify by
      toggling the mode switch in the phone UI and confirming (via a temporary console.log) the
      push starts/stops accordingly.

## 2. Viewer: marking

- [x] 2.1 In `apps/web-app/src/lib/stellarium.js`, add `applySelectTarget({ id })` that resolves
      `id` via `getTargetById` and calls `selectTarget(engine, target)`, or `clearSelection(engine)`
      when `id` is `null`. Verify with a manual call from the browser console while the engine is
      running: selecting a known id (e.g. `'moon'`) highlights it in the viewer the same way a
      touch-selection does.
- [x] 2.2 In `apps/web-app/src/lib/protobject.js`, register `bus.on('selectTarget', applySelectTarget)`
      in `initViewerProtobject()`. Verify by sending a `selectTarget` message from the phone (task
      3.2) and observing the viewer's selection change.

## 3. Phone: live list and selection

- [x] 3.1 Add a `visibleTargets` writable store in `apps/web-app/src/lib/stores.js`
      (`{ list: [], selectedId: null }`), and register
      `onTelescopeMessage('visibleTargets', (values) => visibleTargets.set(values))` in
      `initTelescopeProtobject()` (`apps/web-app/src/lib/protobject.js`). Verify the store updates
      by logging its value from `ScreenSimple.svelte`'s `$effect` while connected to a viewer.
- [x] 3.2 In `apps/web-app/src/telescope-ui/ScreenSimple.svelte`, replace the
      `TARGETS`/`dictionaries/placeholders/targets.js` import with the `visibleTargets` store,
      joined against `SKY_TARGETS` (from `@ventanaceleste/core`) for `name`/`kind` per id. Tapping
      an entry toggles `target` as today but also calls `sendTelescopeMessage('selectTarget', { id })`
      (or `{ id: null }` when deselecting). Verify by tapping a list entry in the phone UI and
      confirming the corresponding object is marked on the connected viewer.
- [x] 3.3 Add a `kind → icon name` lookup (`moon-star`, `orbit`, `sparkles`, `cloud`, `globe`, per
      design.md) and a `kind → Spanish label` lookup (reusing `device-lab`'s `ETIQUETA_TIPO`
      wording) in `ScreenSimple.svelte`, replacing the per-object `desc` tagline in both the list
      rows and the "Estás mirando" hero card. Verify visually: every kind present in `SKY_TARGETS`
      renders a known icon and label, none falls back to a blank/missing icon.
- [x] 3.4 Handle the empty-list case: when `visibleTargets.list` is empty, show a "nada visible
      ahora mismo" state instead of an empty list area. Verify by forcing an empty list (e.g. mock
      the store) and checking the empty state renders instead of blank space.
- [x] 3.5 Reflect `selectedId` from the store as the selected list entry (covers a touch-selection
      made directly on the viewer). Verify by marking an object directly on the viewer (simulated
      touch/click) and confirming the phone's list highlights that same entry on its next push.
- [x] 3.6 Delete `apps/web-app/src/telescope-ui/dictionaries/placeholders/targets.js` once no file
      imports it. Verify with a repo-wide search confirming zero remaining references.

## 4. Viewer: guidance overlay

- [x] 4.1 In `apps/web-app/src/viewer/Viewer.svelte`, add a per-frame
      (`requestAnimationFrame`) loop that calls `getTargetGuidance(engine, getSelectedTarget(engine), { width, height })`
      using `stel-canvas`'s current client size, following the same structure as
      `device-lab/sky.html`'s guidance IIFE. Verify by marking a target whose current position is
      outside the engine's field of view and confirming a directional indicator appears.
- [x] 4.2 Render the indicator (arrow + `separationDeg`, hidden when `guia.inView` or nothing is
      selected) as a DOM overlay on top of `#stel-canvas`, positioned at `guia.edge`. Verify the
      indicator disappears once the marked object's position enters the field of view (e.g. by
      zooming out or waiting for the marked object to drift into frame), and stays hidden when
      nothing is marked.

## 5. Cleanup and verification

- [x] 5.1 Run `pnpm --filter @ventanaceleste/web-app lint:check` and fix any violations introduced
      by the above.
- [x] 5.2 Run `pnpm --filter @ventanaceleste/web-app build` and confirm it succeeds with the
      placeholder file removed and no dangling imports.
- [x] 5.3 Manual end-to-end pass with two browser tabs/devices (viewer + phone, as the app already
      requires for any testing): confirm detection (list matches what's above the horizon),
      marking (tap-to-select highlights on viewer, tap-to-deselect clears it, touch-select on
      viewer reflects back to phone), and guidance (arrow shows for an out-of-view target and
      disappears once it's in view) all work together in Simple mode, and that switching to
      Advanced mode stops the list from updating without erroring. Validated manually by the
      user.

## 6. Post-validation fixes

- [x] 6.1 Remove the viewer's unrelated `#info-card` (selection detail popup) and its
      `stel.change(...)` listener from `apps/web-app/src/viewer/Viewer.svelte`, plus the
      now-unused `getObjAltAz` wrapper and its `getObjectAltAz` import in
      `apps/web-app/src/lib/stellarium.js`. Verify: `pnpm --filter @ventanaceleste/web-app build`
      succeeds and no reference to `infoCard`/`getObjAltAz` remains.
- [x] 6.2 Fix the ~1 s delay before a tapped list entry shows as selected on the phone in
      `ScreenSimple.svelte`: the reconciliation `$effect` was reverting the optimistic tap back to
      the stale `visibleTargets.selectedId` (only refreshed every 5 s) before the next push
      confirmed it. Track the locally-pending id and ignore stale store values until it's
      confirmed (with a fallback timeout so a viewer-side touch can't leave it stuck). Verify:
      tapping a list entry marks it as selected immediately, with no visible delay.
