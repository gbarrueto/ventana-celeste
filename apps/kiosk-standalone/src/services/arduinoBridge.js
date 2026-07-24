export function createArduinoBridge({ onError = () => {} } = {}) {
  function isSupported() {
    return typeof navigator !== "undefined" && "serial" in navigator;
  }

  async function connect() {
    throw new Error("Arduino bridge not implemented yet");
  }

  async function disconnect() {}

  async function sendState() {
    if (!isSupported()) {
      onError(new Error("Web Serial API is not available"));
    }
  }

  return {
    isSupported,
    connect,
    disconnect,
    sendState,
  };
}