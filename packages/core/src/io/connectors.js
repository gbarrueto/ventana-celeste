// I/O connector contract: something that feeds external hardware/network
// input into an app (telescope orientation, zoom, focus, recalibration).
//
// Every deployment has some form of physical control hardware, but *what*
// hardware differs per app (today: kiosk's Arduino sends keystrokes over
// USB-HID; dual-telescope will need real Web Serial for RFID + potentiometer
// input). Core only defines the shape a connector should have; concrete
// implementations live where the actual hardware integration happens.
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

// Web Serial connector shape, for real Arduino integration (RFID lens
// changes, potentiometer focus) — not implemented yet, no hardware to
// build/test it against. Kept as a stub matching the intended contract so
// it's a clear starting point rather than a surprise when it's picked up.
export function createSerialConnector({ onError = () => {} } = {}) {
  function isSupported() {
    return typeof navigator !== 'undefined' && 'serial' in navigator;
  }

  async function connect() {
    onError(new Error('Serial connector not implemented yet'));
  }

  async function disconnect() {}

  return { isSupported, connect, disconnect };
}
