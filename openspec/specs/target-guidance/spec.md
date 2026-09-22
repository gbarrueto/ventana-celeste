## Purpose

Lets someone using `web-app`'s Simple mode pick a real, currently-visible sky object from the
phone and be guided — via the shared viewer screen — to swing the telescope toward it, instead
of browsing a static, non-interactive list.

## Requirements

### Requirement: Live tonight's-objects list
The phone, while in Simple mode, SHALL display the catalog objects currently above the horizon
instead of a fixed placeholder list, and SHALL keep that list current as the sky and the
observer's position change.

#### Scenario: List reflects what is up right now
- **WHEN** the phone is connected to the viewer in Simple mode
- **THEN** the displayed list contains only catalog objects at or above the detection
  system's default altitude threshold, ordered from highest to lowest

#### Scenario: List updates over time
- **WHEN** enough time passes for an object's altitude to cross the visibility threshold
- **THEN** the list adds or drops that object on its next refresh without requiring the user
  to leave and re-enter the screen

#### Scenario: Nothing visible yet
- **WHEN** no catalog object is currently above the detection threshold
- **THEN** the phone shows an explicit "nothing visible right now" state instead of an empty
  or stale list

### Requirement: Tap-to-mark selection
Tapping a list entry SHALL mark that object as the current target on the shared engine, and
tapping the same entry again SHALL clear the mark.

#### Scenario: Selecting a target marks it on the shared view
- **WHEN** the user taps an object in the list
- **THEN** that object becomes the marked target on the viewer, visibly highlighted there,
  and the phone reflects it as the selected entry

#### Scenario: Deselecting clears the mark
- **WHEN** the user taps the already-selected entry again
- **THEN** the mark is cleared on the viewer and no entry shows as selected on the phone

#### Scenario: A mark made on the viewer is reflected on the phone
- **WHEN** an object is marked directly on the viewer (not via the phone's list)
- **THEN** the phone's list shows that same object as selected, if it is present in the list

### Requirement: Guidance toward the marked target
While an object is marked, the viewer SHALL show the observer which way to turn to bring it
into view, and SHALL stop showing that guidance once the object is in view.

#### Scenario: Marked target is out of view
- **WHEN** an object is marked and its position falls outside the viewer's current field of
  view
- **THEN** the viewer displays a directional indicator toward the object, including how far
  off it is

#### Scenario: Marked target comes into view
- **WHEN** the marked object's position falls inside the viewer's current field of view
- **THEN** the directional indicator is no longer shown

#### Scenario: Nothing marked
- **WHEN** no object is currently marked
- **THEN** the viewer shows no directional indicator
