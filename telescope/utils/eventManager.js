class EventManager {
  constructor() {
    this.handlers = new Map();
    // timers: stores timeout IDs for debounce operations
    this.timers = new Map();
    // lastCalled: stores timestamps (ms) for throttling DOM handlers
    this.lastCalled = new Map();
    // lastSent: stores timestamps (ms) for throttling protobject sends
    this.lastSent = new Map();
    // stats: counts of messages sent via protobject (by key)
    this.stats = { protobjectSent: {} };
  }

  // Event delegation - single listener per event type
  on(selector, event, handler, options = {}) {
    const key = `${event}:${selector}`;

    const delegatedHandler = (e) => {
      if (e.target.matches(selector)) {
        if (options.debounce > 0) {
          this.#debounce(key, () => handler(e), options.debounce);
        } else if (options.throttle > 0) {
          this.#throttle(key, () => handler(e), options.throttle);
        } else {
          handler(e);
        }
      }
    };

    if (!this.handlers.has(key)) {
      document.addEventListener(event, delegatedHandler);
      this.handlers.set(key, delegatedHandler);
    }
  }

  // Debounce: wait for pause in events
  #debounce(key, fn, delay) {
    const existing = this.timers.get(key);
    if (existing) clearTimeout(existing);
    const id = setTimeout(() => {
      this.timers.delete(key);
      fn();
    }, delay);
    this.timers.set(key, id);
  }

  // Throttle: max once per interval
  #throttle(key, fn, interval) {
    const last = this.lastCalled.get(key) || 0;
    const now = Date.now();
    if (now - last >= interval) {
      fn();
      this.lastCalled.set(key, now);
    }
  }

  // Cleanup
  off(selector, event) {
    const key = `${event}:${selector}`;
    const handlerToRemove = this.handlers.get(key); // 1. Obtener el handler

    if (handlerToRemove) {
      // 2. ¡Esta es la línea que faltaba!
      document.removeEventListener(event, handlerToRemove);
      this.handlers.delete(key); // 3. Borrar del Map
    }

    // Limpiar timers asociados
    const timeout = this.timers.get(key);
    if (timeout) {
      clearTimeout(timeout);
      this.timers.delete(key);
    }
    this.lastCalled.delete(key);
  }

  cleanup() {
    // Debes iterar por los handlers y removerlos del document
    this.handlers.forEach((handler, key) => {
      // Extraer el tipo de evento de la clave (ej. "input:selector")
      const eventType = key.split(":")[0];
      document.removeEventListener(eventType, handler);
    });
    this.handlers.clear(); // Limpiar el map

    // Limpiar todos los timers pendientes
    this.timers.forEach((timer) => clearTimeout(timer));
    this.timers.clear();
    this.lastCalled.clear();
    this.lastSent.clear();
  }

  sendThrottledProtobject(payload, target, interval) {
    const key = `protobject:${payload.msg}:${target}`;
    const now = Date.now();
    const last = this.lastSent.get(key) || 0;
    if (now - last >= interval) {
      Protobject.Core.send(payload).to(target);
      this.lastSent.set(key, now);

      // update stats
      this.stats.protobjectSent[key] =
        (this.stats.protobjectSent[key] || 0) + 1;
    }
  }

  // Stats helpers
  getStats() {
    return JSON.parse(JSON.stringify(this.stats));
  }

  resetStats() {
    this.stats = { protobjectSent: {} };
    this.lastSent.clear();
  }
}

export const eventManager = new EventManager();
