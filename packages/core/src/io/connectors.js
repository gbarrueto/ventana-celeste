// I/O connector contract: something that feeds external hardware/network
// input into an app (telescope orientation, zoom, focus, recalibration).
//
// Every deployment has some form of physical control hardware, but *what*
// hardware differs per app: kiosk's Arduino sends keystrokes over USB-HID, and
// dual-telescope reads a potentiometer over WebUSB. Core only defines the shape
// a connector should have; concrete implementations live where the actual
// hardware integration happens, next to the board they talk to.
//
// Shape: { isSupported(): boolean, connect(): Promise<void>|void,
//          disconnect(): Promise<void>|void }

// Maps keydown events to actions. This is what kiosk's Arduino integration
// actually is today (the Arduino acts as a USB-HID keyboard) — extracted so
// it's not re-implemented inline per app.
export function createKeyboardConnector({ bindings = {}, onError = () => {} } = {}) {
  let handler = null;

  function isSupported() {
    return typeof window !== 'undefined';
  }

  function connect() {
    if (!isSupported()) {
      onError(new Error('Keyboard input is not available in this environment'));
      return;
    }
    if (handler) return;
    handler = (e) => {
      const action = bindings[e.key.toLowerCase()];
      if (action) action(e);
    };
    window.addEventListener('keydown', handler);
  }

  function disconnect() {
    if (handler) window.removeEventListener('keydown', handler);
    handler = null;
  }

  return { isSupported, connect, disconnect };
}

// dual-telescope reads its board over WebUSB, in apps/dual-telescope/src/focuser.js.
// That implementation lives next to the hardware it talks to, not here.

// Assembles newline-terminated lines out of raw keystrokes.
//
// An Arduino acting as a USB keyboard cannot send a byte stream: each character
// arrives as its own keydown event. This turns those events back into lines, so
// the code that parses a device protocol does not need to know whether the bytes
// came from a keyboard, a serial port or a bulk endpoint.
//
// `onKey` exists for diagnostics: the Keyboard library sends US-layout
// scancodes, so a host on another layout can receive a different character than
// the sketch printed. Seeing the raw keys is the only way to catch that.
//
// `preventDefault` stops the keystrokes from also acting on the page. It matters
// for Enter above all: a button that still holds focus would be re-triggered by
// every line the board sends.
export function createKeyboardLineSource({
  onLine = () => {},
  onKey = () => {},
  preventDefault = false,
  // Guard against a runaway sender filling memory when no Enter ever arrives.
  maxLineLength = 64,
} = {}) {
  let buffer = '';
  let handler = null;

  function isSupported() {
    return typeof window !== 'undefined';
  }

  function connect() {
    if (handler || !isSupported()) return;
    handler = (e) => {
      if (e.key === 'Enter') {
        if (preventDefault) e.preventDefault();
        const linea = buffer;
        buffer = '';
        if (linea) onLine(linea);
        return;
      }
      // Modifiers and named keys ('Shift', 'Tab') report a multi-character
      // `key`. Skipping them leaves the line in progress untouched.
      if (e.key.length !== 1) return;
      if (preventDefault) e.preventDefault();
      onKey(e.key);
      buffer = (buffer + e.key).slice(-maxLineLength);
    };
    window.addEventListener('keydown', handler);
  }

  function disconnect() {
    if (handler) window.removeEventListener('keydown', handler);
    handler = null;
    buffer = '';
  }

  return { isSupported, connect, disconnect };
}
