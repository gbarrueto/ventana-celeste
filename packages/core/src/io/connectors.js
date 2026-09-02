// Contrato de conectores I/O: { isSupported, connect, disconnect }.

// Mapea eventos keydown a acciones.
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

// Reconstruye líneas delimitadas por Enter a partir de eventos keydown.
export function createKeyboardLineSource({
  onLine = () => {},
  onKey = () => {},
  preventDefault = false,
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
