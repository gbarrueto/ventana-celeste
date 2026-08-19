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
