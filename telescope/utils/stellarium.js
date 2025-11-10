import { updateStellariumView } from "../../util/stel.js";

/**
 * IIFE per il setup del Debug DIV
 * (Logica di ricalibrazione al tocco inclusa)
 */
(() => {
  const ID = 'dbg-pitch-yaw';
  let el = document.getElementById(ID);
  if (!el) {
    el = document.createElement('div');
    el.id = ID;
    Object.assign(el.style, {
      position: 'fixed',
      left: '8px',
      bottom: '108px',
      zIndex: '2147483647',
      background: 'rgba(0,0,0,0.75)',
      color: '#0f0', // Verde "debug"
      padding: '8px 10px',
      borderRadius: '6px',
      fontFamily: 'monospace, monospace',
      fontSize: '13px',
      lineHeight: '1.2',
      pointerEvents: 'auto', // Permette il click
      whiteSpace: 'pre',
      boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      cursor: 'pointer' // Mostra che è cliccabile
    });
    el.setAttribute('aria-live', 'polite');
    document.body.appendChild(el);
  }

  // Funzione pubblica per aggiornare i valori (ora mostra RADIANI)
  window.updatePitchYaw = window.updatePitchYaw || function (pitch, yaw, status = null) {
    const p = (typeof pitch === 'number') ? pitch : Number(pitch) || 0;
    const y = (typeof yaw === 'number') ? yaw : Number(yaw) || 0;
    
    let statusText = '';
    if (status) {
      statusText = `\nstatus: ${status}`;
    } else if (window.Orientation && window.Orientation.calibrating) {
      const progress = Math.round((window.Orientation.biasSamples.length / window.Orientation.calibSamplesNeeded) * 100);
      statusText = `\nstatus: Calibrating... ${progress}%`;
    }

    // Mostra radianti con 5 decimali
    el.textContent = `pitch: ${p.toFixed(5)} (rad)\nyaw:   ${y.toFixed(5)} (rad)${statusText}`;
  };

  // Logica di Ricalibrazione al Tocco
  let calibTimeout = null;
  el.addEventListener('click', () => {
    if (calibTimeout) clearTimeout(calibTimeout);
    if (window.Orientation && typeof window.Orientation.startCalibration === 'function') {
      window.updatePitchYaw(
        window.Orientation.orient.pitch,
        window.Orientation.orient.yaw,
        "Attendi 1s..."
      );
      calibTimeout = setTimeout(() => {
        window.Orientation.startCalibration();
      }, 1000); // 1-secondo di attesa
    }
  });

  if (!el.textContent) el.textContent = 'pitch: 0.00000 (rad)\nyaw:   0.00000 (rad)\nstatus: idle';
})();


/**
 * Oggetto Orientation Riprogettato
 * CORRETTO per usare:
 * 1. Pitch = Asse Roll (X) - inclinazione parte lunga
 * 2. Yaw = Asse Yaw (Z)
 * 3. Unità = RADIANI (non gradi)
 *
 * Mantiene il filtro complementare ad alta precisione.
 */
window.Orientation = {
  // --- Configurazione ---
  gyroFreq: 100,      // Hz
  absFreq: 30,        // Hz
  alpha: 0.985,       // Peso del giroscopio
  calibDuration: 3,   // Secondi

  // --- Stato ---
  gyroSensor: null,
  absSensor: null,
  running: false,
  calibrating: false,
  gyroBias: { x: 0, y: 0, z: 0 },
  biasSamples: [],
  calibSamplesNeeded: 300,
  orient: { pitch: 0, yaw: 0 },      // Output fuso (RADIANI)
  orientAbs: { pitch: null, yaw: null }, // Riferimento assoluto (RADIANI)
  lastTime: null,
  oldX: null, // Per la logica di smoothing
  oldY: null,

  // --- Helpers ---

  /**
   * Converte quaternione [x,y,z,w] in angoli di Eulero (RADIANI)
   * Usa le tue formule originali per "pitch" e "yaw".
   */
  quaternionToEuler(q) {
    const x = q[0], y = q[1], z = q[2], w = q[3];

    // "Pitch" (inclinazione parte lunga) = Asse Roll (X)
    // Formula identica al tuo codice originale
    const pitch = Math.atan2(2 * (w * x + y * z), 1 - 2 * (x * x + y * y));

    // "Yaw" (heading) = Asse Yaw (Z)
    // Formula identica al tuo codice originale
    const yaw = Math.atan2(2 * (w * z + x * y), 1 - 2 * (y * y + z * z));
    
    // Restituisce RADIANI
    return { yaw: yaw, pitch: pitch };
  },

  /**
   * Fonde gli angoli gestendo il "wraparound" in RADIANI [-PI, +PI]
   */
  blendAngles(gyroAngle, absAngle, alphaVal) {
    const PI = Math.PI;
    const TWO_PI = 2 * PI;

    // Normalizza entrambi gli angoli in [-PI, PI]
    const a = ((gyroAngle + PI) % TWO_PI + TWO_PI) % TWO_PI - PI;
    const b = ((absAngle + PI) % TWO_PI + TWO_PI) % TWO_PI - PI;

    let diff = b - a;
    if (diff > PI) diff -= TWO_PI;
    if (diff < -PI) diff += TWO_PI;
    
    const blended = a + (1 - alphaVal) * diff;
    
    // Ritorna il valore fuso, normalizzato
    return ((blended + PI) % TWO_PI + TWO_PI) % TWO_PI - PI;
  },

  // --- Metodi Principali ---

  start(config = {}) {
    this.gyroFreq = config.freq || this.gyroFreq;
    this.alpha = config.alpha || this.alpha;
    
    this.onCalibReading = this.onCalibReading.bind(this);
    this.onAbsReading = this.onAbsReading.bind(this);
    this.onGyroReading = this.onGyroReading.bind(this);

    this.startSensors();
  },

  stop() {
    this.running = false;
    this.calibrating = false;
    try {
      if (this.gyroSensor) {
        this.gyroSensor.removeEventListener('reading', this.onCalibReading);
        this.gyroSensor.removeEventListener('reading', this.onGyroReading);
        this.gyroSensor.stop();
        this.gyroSensor = null;
      }
      if (this.absSensor) {
        this.absSensor.removeEventListener('reading', this.onAbsReading);
        this.absSensor.stop();
        this.absSensor = null;
      }
    } catch (e) {
      console.warn("Errore stop sensori:", e);
    }
  },

  async requestIOSPermissionIfNeeded() {
    if (typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'function') {
      try {
        const resp = await DeviceOrientationEvent.requestPermission();
        if (resp !== 'granted') {
          throw new Error('Permesso "DeviceOrientationEvent" negato');
        }
      } catch (e) {
        console.error('Permesso sensori iOS negato:', e);
        throw e;
      }
    }
  },

  async startSensors() {
    try {
      await this.requestIOSPermissionIfNeeded();
    } catch (e) {
      window.updatePitchYaw(0, 0, "Permesso negato");
      return;
    }

    this.stop(); // Ferma e pulisce i sensori precedenti

    try {
      if (!('Gyroscope' in window) || !('AbsoluteOrientationSensor' in window)) {
        throw new Error('Generic Sensor API non disponibile');
      }
      
      this.gyroSensor = new Gyroscope({ frequency: this.gyroFreq });
      this.absSensor = new AbsoluteOrientationSensor({ frequency: this.absFreq, referenceFrame: 'device' });

      this.gyroSensor.addEventListener('error', (e) => { console.error('Errore Gyro:', e.error.name); this.stop(); });
      this.absSensor.addEventListener('error', (e) => { console.error('Errore AbsSensor:', e.error.name); this.stop(); });

      this.startCalibration(); // Avvia il processo

    } catch (err) {
      console.error("Errore avvio sensori:", err);
      window.updatePitchYaw(0, 0, "Error: " + err.message);
    }
  },

  // --- Logica Calibrazione ---

  startCalibration() {
    if (!this.gyroSensor || !this.absSensor) {
      console.warn("Calibrazione fallita: sensori non inizializzati.");
      return;
    }
    if (this.calibrating) return; // Già in corso

    this.calibrating = true;
    this.running = false; // Ferma il filtro principale
    this.biasSamples = [];
    this.calibSamplesNeeded = this.gyroFreq * this.calibDuration;
    
    window.updatePitchYaw(this.orient.pitch, this.orient.yaw, "Calibrating... 0%");
    
    this.gyroSensor.removeEventListener('reading', this.onGyroReading);
    this.gyroSensor.addEventListener('reading', this.onCalibReading);
    
    this.absSensor.removeEventListener('reading', this.onAbsReading);
    this.absSensor.addEventListener('reading', this.onAbsReading);

    try {
      this.gyroSensor.start();
      this.absSensor.start();
    } catch (e) {
      console.error("Errore start calibrazione:", e);
    }
  },

  onCalibReading() {
    if (this.biasSamples.length < this.calibSamplesNeeded) {
      this.biasSamples.push({ x: this.gyroSensor.x, y: this.gyroSensor.y, z: this.gyroSensor.z });
      if (this.biasSamples.length % Math.floor(this.gyroFreq / 2) === 0) {
        window.updatePitchYaw(this.orient.pitch, this.orient.yaw); // Aggiorna stato
      }
    } else {
      this.finishCalibration();
    }
  },

  finishCalibration() {
    if (!this.calibrating) return;
    this.calibrating = false;
    this.gyroSensor.removeEventListener('reading', this.onCalibReading);

    const avg = this.biasSamples.reduce((acc, r) => {
      acc.x += r.x; acc.y += r.y; acc.z += r.z; return acc;
    }, { x: 0, y: 0, z: 0 });
    
    // Bias è in RAD/S
    this.gyroBias.x = avg.x / this.biasSamples.length;
    this.gyroBias.y = avg.y / this.biasSamples.length;
    this.gyroBias.z = avg.z / this.biasSamples.length;

    console.log('Calibrazione completata (rad/s). Bias:', this.gyroBias);

    if (this.orientAbs.pitch === null) {
      window.updatePitchYaw(this.orient.pitch, this.orient.yaw, "Waiting for AbsSensor...");
    }

    this.lastTime = performance.now();
    this.gyroSensor.addEventListener('reading', this.onGyroReading);
    this.running = true;
  },

  // --- Loop di Lettura Dati ---

  // Frequenza bassa: solo per il riferimento assoluto (in RADIANI)
  onAbsReading() {
    const q = Array.from(this.absSensor.quaternion || [0, 0, 0, 1]);
    const e = this.quaternionToEuler(q); // {pitch, yaw} in RADIANI

    if (!Number.isFinite(e.pitch) || !Number.isFinite(e.yaw)) return;

    // Sincronizzazione al primo avvio
    if (this.orientAbs.pitch === null) {
      console.log('Prima lettura assoluta ricevuta. Sincronizzazione (RAD).');
      this.orient.pitch = e.pitch;
      this.orient.yaw = e.yaw;
      // Inizializza anche i valori "old" della tua logica
      this.oldX = e.yaw;
      this.oldY = e.pitch;
    }

    // Aggiorna i valori "obiettivo"
    this.orientAbs.pitch = e.pitch;
    this.orientAbs.yaw = e.yaw;
  },

  // Frequenza alta: cuore del filtro (in RADIANI)
  onGyroReading() {
    if (this.calibrating || this.orientAbs.pitch === null) {
      this.lastTime = performance.now();
      return;
    }

    const now = performance.now();
    const dt = Math.max(1e-6, (now - this.lastTime) / 1000); // delta tempo in secondi
    this.lastTime = now;

    // 1. Applica il bias (velocità angolare "pulita" in RAD/S)
    const wx = this.gyroSensor.x - this.gyroBias.x; // Asse X (Roll) -> Per il tuo "pitch"
    // const wy = this.gyroSensor.y - this.gyroBias.y; // Asse Y (Pitch) -> Non usato
    const wz = this.gyroSensor.z - this.gyroBias.z; // Asse Z (Yaw) -> Per il tuo "yaw"

    // 2. Integrazione (Predizione dal giroscopio, in RADIANI)
    // (rad/s) * s = rad
    // "Pitch" (del'utente) = Asse X (Roll)
    const pitch_integrated = this.orient.pitch + (wx * dt);
    // "Yaw" (dell'utente) = Asse Z (Yaw)
    const yaw_integrated = this.orient.yaw + (wz * dt);
    
    // 3. Correzione (Filtro Complementare, in RADIANI)
    // Usiamo blendAngles per entrambi perché entrambi derivano da atan2 e wrappano [-PI, PI]
    this.orient.pitch = this.blendAngles(pitch_integrated, this.orientAbs.pitch, this.alpha);
    this.orient.yaw = this.blendAngles(yaw_integrated, this.orientAbs.yaw, this.alpha);
    
    // 4. Aggiorna il DIV di debug con i valori fusi (RADIANI)
    window.updatePitchYaw(this.orient.pitch, this.orient.yaw, "Running");

    // 5. Esegui la tua logica applicativa (Stellarium, Protobject)
    this.runApplicationLogic(this.orient.pitch, this.orient.yaw);
  },

  // --- Logica Applicativa (in RADIANI) ---
  runApplicationLogic(pitch, yaw) {
    const localLogFov = (typeof logFov !== 'undefined') ? logFov : 0;
    // Assicurati che unwrapAngle esista globalmente, o usa un fallback
    const localUnwrapAngle = (typeof unwrapAngle === 'function') ? unwrapAngle : (a, _b) => a;

    const fov = Math.exp(localLogFov);
    const sensitivity = Math.min(1, fov / 0.6);

    if (this.oldX === null || this.oldY === null) {
      // Aspetta che onAbsReading inizializzi oldX/oldY
      return;
    }

    // 'yaw' e 'this.oldX' sono in radianti
    const adjustedYaw = localUnwrapAngle(yaw, this.oldX);

    // Applica lo smoothing
    this.oldX += (adjustedYaw - this.oldX) * sensitivity;
    this.oldY += (pitch - this.oldY) * sensitivity;

    // Invia i dati smorzati (in radianti)
    if (typeof Protobject !== 'undefined' && Protobject.Core) {
      Protobject.Core.send({
        msg: "updateView",
        values: { h: this.oldX, v: this.oldY },
      }).to("index.html");
    }
    
    updateStellariumView({ h: this.oldX, v: this.oldY }); //para guia
  },
};

// Avvia il sistema.
window.Orientation.start();