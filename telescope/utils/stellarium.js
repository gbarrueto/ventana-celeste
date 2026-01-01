import { updateStellariumView } from "../../util/stel.js";
import { eventManager } from "./eventManager.js";

function unwrapAngle(angle, reference) {
  while (angle - reference > Math.PI) angle -= 2 * Math.PI;
  while (angle - reference < -Math.PI) angle += 2 * Math.PI;
  return angle;
}

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
      zIndex: '214793647',
      background: 'rgba(0,0,0,0.85)',
      color: '#0f0',
      padding: '8px 10px',
      borderRadius: '6px',
      fontFamily: 'monospace, monospace',
      fontSize: '12px',
      lineHeight: '1.3',
      pointerEvents: 'auto',
      whiteSpace: 'pre',
      boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      cursor: 'pointer',
      borderLeft: '3px solid #0f0'
    });
    el.setAttribute('aria-live', 'polite');
    document.body.appendChild(el);
  }

  window.updatePitchYaw = window.updatePitchYaw || function (pitch, yaw, info = {}) {
    const p = (typeof pitch === 'number') ? pitch : 0;
    const y = (typeof yaw === 'number') ? yaw : 0;
    const vVal = info.vVal !== undefined ? info.vVal.toFixed(4) : '-';
    const mode = info.mode || '-'; 
    const status = info.status || '';

    el.textContent = 
      `V (exp): ${vVal} [${mode.toUpperCase()}]\n` +
      `Pitch:   ${p.toFixed(5)}\n` +
      `Yaw:     ${y.toFixed(5)}\n` +
      `Status:  ${status}`;
      
    el.style.borderLeftColor = (mode === 'DYNAMIC') ? '#ff0' : '#0f0';
  };

  let calibTimeout = null;
  el.addEventListener('click', () => {
    if (calibTimeout) clearTimeout(calibTimeout);
    if (window.Orientation && typeof window.Orientation.startCalibration === 'function') {
      window.Orientation.startCalibration();
    }
  });
})();

window.Orientation = {
  // --- Configurazione Generale ---
  gyroFreq: 100, 
  absFreq: 30,  
  calibDuration: 3, 
  
  // --- Configurazione Zona Reale (Originale) ---
  fovThreshold: 0.8,    
  gyroDeadzone: 0.003,  

  // --- Configurazione Zona Dinamica (Chirurgica + Smoothing) ---
  dynamicThreshold: 0.02, 
  
  // Moltiplicatore di precisione (come richiesto prima)
  dynamicGainMultiplier: 10.0, 

// Fattore di smoothing per la zona dinamica.
  dynamicSmoothingFactor: 0.15, 

  // --- Status ---
  gyroSensor: null,
  absSensor: null,
  running: false,
  calibrating: false,
  gyroBias: { x: 0, y: 0, z: 0 },
  biasSamples: [],
  calibSamplesNeeded: 300,
  
  orient: { pitch: 0, yaw: 0 },
  absOrientLast: null, 
  currentMode: 'absolute', 
  
  oldX: null,
  oldY: null,
  
  // Variabili per il target "Raw" nella zona dinamica (per il filtro)
  rawDynamicX: null,
  rawDynamicY: null,

  lastTime: null,
  _pendingRAF: false,

  quaternionToEuler(q) {
    if (!q) return { yaw: 0, pitch: 0 };
    const x = q[0], y = q[1], z = q[2], w = q[3];
    const pitch = Math.atan2(2 * (w * x + y * z), 1 - 2 * (x * x + y * y));
    const yaw = Math.atan2(2 * (w * z + x * y), 1 - 2 * (y * y + z * z));
    return { yaw, pitch };
  },
  
  start() {
    this.onCalibReading = this.onCalibReading.bind(this);
    this.onSensorReading = this.onSensorReading.bind(this);
    this.onAbsReading = this.onAbsReading.bind(this);
    this.startSensors();
  },

  stop() {
    this.running = false;
    this.calibrating = false;
    if (this.gyroSensor) { try { this.gyroSensor.stop(); } catch(e){} }
    if (this.absSensor) { try { this.absSensor.stop(); } catch(e){} }
  },

  async requestIOSPermissionIfNeeded() {
    if (typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'function') {
      await DeviceOrientationEvent.requestPermission();
    }
  },

  async startSensors() {
    try {
      await this.requestIOSPermissionIfNeeded();
      if (!('Gyroscope' in window) || !('AbsoluteOrientationSensor' in window)) {
        throw new Error('Sensori necessari non disponibili');
      }
      this.gyroSensor = new Gyroscope({ frequency: this.gyroFreq });
      this.absSensor = new AbsoluteOrientationSensor({ frequency: this.absFreq });
      
      this.gyroSensor.addEventListener('error', (e) => console.error('Error Gyro:', e));
      this.absSensor.addEventListener('error', (e) => console.error('Error Abs:', e));
      
      this.startCalibration();
    } catch (err) {
      console.error("Errore avvio sensori:", err);
      window.updatePitchYaw(0, 0, { status: "Error: " + err.message });
    }
  },

  startCalibration() {
    if (!this.gyroSensor || !this.absSensor) return;
    this.calibrating = true;
    this.running = false;
    this.biasSamples = [];
    this.calibSamplesNeeded = this.gyroFreq * this.calibDuration;
    this.currentMode = 'absolute';
    
    window.updatePitchYaw(0, 0, { status: "Calibrating..." });
    
    this.gyroSensor.addEventListener('reading', this.onCalibReading);
    this.absSensor.addEventListener('reading', this.onAbsReading);

    this.gyroSensor.start();
    this.absSensor.start();
  },

  onCalibReading() {
    if (this.biasSamples.length < this.calibSamplesNeeded) {
      this.biasSamples.push({ x: this.gyroSensor.x, y: this.gyroSensor.y, z: this.gyroSensor.z });
    } else {
      this.finishCalibration();
    }
  },

  finishCalibration() {
    this.calibrating = false;
    this.gyroSensor.removeEventListener('reading', this.onCalibReading);

    const avg = this.biasSamples.reduce((acc, r) => ({ x: acc.x + r.x, y: acc.y + r.y, z: acc.z + r.z }), { x: 0, y: 0, z: 0 });
    const len = this.biasSamples.length || 1;
    this.gyroBias = { x: avg.x / len, y: avg.y / len, z: avg.z / len };
    
    console.log('Calibrazione completata. Bias:', this.gyroBias);

    if (this.absOrientLast) {
        const euler = this.quaternionToEuler(this.absOrientLast);
        this.oldX = euler.yaw;
        this.oldY = euler.pitch;
    }

    this.lastTime = performance.now();
    this.gyroSensor.addEventListener('reading', this.onSensorReading);
    this.running = true;
  },
  
  onAbsReading() {
    if (!this.absSensor) return;
    this.absOrientLast = this.absSensor.quaternion;
  },

  onSensorReading() {
    if (this.calibrating) {
      this.lastTime = performance.now();
      return;
    }

    const now = performance.now();
    const dt = Math.max(1e-6, (now - this.lastTime) / 1000);
    this.lastTime = now;

    let currentV = 0.05; 
    try { if (typeof logFov !== 'undefined') currentV = Math.exp(logFov); } catch(e){}

    const inDynamicZone = currentV < this.dynamicThreshold;

    if (inDynamicZone) {
        // =========================================================
        // ZONA DINAMICA (< 0.02) - LOGICA CHIRURGICA + SMOOTHING
        // =========================================================
        
        let wx = this.gyroSensor.x - this.gyroBias.x;
        let wz = this.gyroSensor.z - this.gyroBias.z;
        
        let rawDeltaYaw = wz * dt;
        let rawDeltaPitch = wx * dt;

        // Calcolo Guadagni
        const zoomRatio = currentV / this.dynamicThreshold; 
        const speed = Math.hypot(rawDeltaYaw, rawDeltaPitch);
        const noiseFloor = 0.002;
        
        let precisionGain;
        if (speed < noiseFloor) {
            precisionGain = 0.05; 
        } else {
            precisionGain = Math.min(1.0, Math.pow(speed * 100, 2)); 
        }

        const totalFactor = zoomRatio * precisionGain * this.dynamicGainMultiplier;

        // Passo 1: Aggiorno il Target "Raw" (Ideale)
        // Se è la prima volta che entriamo in dynamic, inizializziamo raw con la posizione attuale
        if (this.rawDynamicX === null) {
            this.rawDynamicX = this.oldX;
            this.rawDynamicY = this.oldY;
        }

        this.rawDynamicX += rawDeltaYaw * totalFactor;
        this.rawDynamicY += rawDeltaPitch * totalFactor;

        // Passo 2: Applico il Filtro (Smoothing/Inerzia)
        // Sposto fluidamente oldX verso rawDynamicX
        const k = this.dynamicSmoothingFactor;
        
        this.oldX += (this.rawDynamicX - this.oldX) * k;
        this.oldY += (this.rawDynamicY - this.oldY) * k;

        // Sync orient per evitare salti al ritorno in zona reale
        this.orient.yaw = this.oldX;
        this.orient.pitch = this.oldY;

        this.updateView(currentV, 'DYNAMIC');

    } else {
        // =========================================================
        // ZONA REALE (>= 0.02) - LOGICA ORIGINALE INTATTA
        // =========================================================
        
        // Reset delle variabili raw della zona dinamica per quando ci torneremo
        this.rawDynamicX = null;
        this.rawDynamicY = null;
        
        if (this.currentMode === 'absolute' && this.absOrientLast) {
            const euler = this.quaternionToEuler(this.absOrientLast);
            this.orient.pitch = euler.pitch;
            this.orient.yaw = euler.yaw;
        } else { 
            let wx = this.gyroSensor.x - this.gyroBias.x;
            let wz = this.gyroSensor.z - this.gyroBias.z;
            if (Math.abs(wx) < this.gyroDeadzone) wx = 0;
            if (Math.abs(wz) < this.gyroDeadzone) wz = 0;
            this.orient.pitch += wx * dt;
            this.orient.yaw += wz * dt;
        }
        
        this.runApplicationLogic(this.orient.pitch, this.orient.yaw, currentV);
    }
  },

  // --- Funzioni Originali ---
  runApplicationLogic(pitch, yaw, fov) {
    const requiredMode = (fov < this.fovThreshold) ? 'gyro' : 'absolute';

    if (requiredMode !== this.currentMode) {
        this.transitionToMode(requiredMode);
    }
    
    const sensitivity = (this.currentMode === 'gyro') ? 0.1 : 0.5;

    if (this.oldX === null || this.oldY === null) {
      this.oldX = yaw;
      this.oldY = pitch;
      return;
    }

    const adjustedYaw = unwrapAngle(yaw, this.oldX);
    
    this.oldX += (adjustedYaw - this.oldX) * sensitivity;
    this.oldY += (pitch - this.oldY) * sensitivity;

    this.updateView(fov, this.currentMode);
  },

  transitionToMode(newMode) {
    if (newMode === 'gyro' && this.currentMode === 'absolute') {
        if (this.absOrientLast) {
            const euler = this.quaternionToEuler(this.absOrientLast);
            this.orient.pitch = euler.pitch;
            this.orient.yaw = euler.yaw;
            this.oldX = euler.yaw;
            this.oldY = euler.pitch;
        }
    } else if (newMode === 'absolute' && this.currentMode === 'gyro') {
        if (this.absOrientLast) {
            const euler = this.quaternionToEuler(this.absOrientLast);
            this.oldX = unwrapAngle(euler.yaw, this.oldX);
            this.oldY = euler.pitch;
        }
    }
    this.currentMode = newMode;
  },

  updateView(vVal, modeName) {
    const h = this.oldX;
    const v = this.oldY;

    window.updatePitchYaw(v, h, { 
        vVal: vVal, 
        mode: modeName,
        status: 'Running'
    });

    try {
      eventManager.sendThrottledProtobject(
        { msg: "updateView", values: { h, v } },
        "index.html",
        20
      );
    } catch (e) {
      if (typeof Protobject !== 'undefined') {
        Protobject.Core.send({
            msg: "updateView",
            values: { h, v },
        }).to("index.html");
      }
    }

    if (!this._pendingRAF) {
      this._pendingRAF = true;
      requestAnimationFrame(() => {
        updateStellariumView({ h, v }); 
        this._pendingRAF = false;
      });
    }
  }
};

window.Orientation.start();




/*

import { updateStellariumView } from "../../util/stel.js";
import { eventManager } from "./eventManager.js";


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
      zIndex: '214793647',
      background: 'rgba(0,0,0,0.75)',
      color: '#0f0',
      padding: '8px 10px',
      borderRadius: '6px',
      fontFamily: 'monospace, monospace',
      fontSize: '13px',
      lineHeight: '1.2',
      pointerEvents: 'auto',
      whiteSpace: 'pre',
      boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      cursor: 'pointer'
    });
    el.setAttribute('aria-live', 'polite');
    document.body.appendChild(el);
  }

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
    // Aggiunge la modalità corrente al display di debug
    const mode = (window.Orientation) ? window.Orientation.currentMode : '...';
    statusText += `\nmode: ${mode}`;
    statusText += `\nfov: ${Math.exp(logFov)}`;
    
    el.textContent = `pitch: ${p.toFixed(5)} (rad)\nyaw:   ${y.toFixed(5)} (rad)${statusText}`;
  };

  let calibTimeout = null;
  el.addEventListener('click', () => {
    if (calibTimeout) clearTimeout(calibTimeout);
    if (window.Orientation && typeof window.Orientation.startCalibration === 'function') {
      window.updatePitchYaw(0,0, "Recalibrating...");
      calibTimeout = setTimeout(() => {
        window.Orientation.startCalibration();
      }, 1000);
    }
  });

  if (!el.textContent) el.textContent = 'pitch: 0.00000 (rad)\nyaw:   0.00000 (rad)\nstatus: idle\nmode: none';
})();


window.Orientation = {
  // --- config ---
  gyroFreq: 100, 
  absFreq: 30,  
  gyroDeadzone: 0.003, 
  calibDuration: 3, 
  fovThreshold: 0.8,  

  // --- status ---
  gyroSensor: null,
  absSensor: null,
  running: false,
  calibrating: false,
  gyroBias: { x: 0, y: 0, z: 0 },
  biasSamples: [],
  calibSamplesNeeded: 300,
  orient: { pitch: 0, yaw: 0 },
  absOrientLast: null, 
  currentMode: 'absolute', 
  lastTime: null,
  oldX: null,
  oldY: null,

  quaternionToEuler(q) {
    if (!q) return { yaw: 0, pitch: 0 };
    const x = q[0], y = q[1], z = q[2], w = q[3];
    const pitch = Math.atan2(2 * (w * x + y * z), 1 - 2 * (x * x + y * y));
    const yaw = Math.atan2(2 * (w * z + x * y), 1 - 2 * (y * y + z * z));
    return { yaw, pitch };
  },
  
  start(config = {}) {
    this.fovThreshold = config.fovThreshold || this.fovThreshold;
    this.onCalibReading = this.onCalibReading.bind(this);
    this.onSensorReading = this.onSensorReading.bind(this);
    this.onAbsReading = this.onAbsReading.bind(this);
    this.startSensors();
  },

  stop() {
    this.running = false;
    this.calibrating = false;
    try {
      if (this.gyroSensor) this.gyroSensor.stop();
      if (this.absSensor) this.absSensor.stop();
      this.gyroSensor = null;
      this.absSensor = null;
    } catch (e) {
      console.warn("Errore durante lo stop dei sensori:", e);
    }
  },

  async requestIOSPermissionIfNeeded() {
    if (typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'function') {
      try {
        const resp = await DeviceOrientationEvent.requestPermission();
        if (resp !== 'granted') throw new Error('Permesso "DeviceOrientationEvent" negato');
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
    this.stop();
    try {
      if (!('Gyroscope' in window) || !('AbsoluteOrientationSensor' in window)) {
        throw new Error('Sensori necessari non disponibili');
      }
      this.gyroSensor = new Gyroscope({ frequency: this.gyroFreq });
      this.absSensor = new AbsoluteOrientationSensor({ frequency: this.absFreq });
      this.gyroSensor.addEventListener('error', (e) => console.error('Errore Gyro:', e.error.name));
      this.absSensor.addEventListener('error', (e) => console.error('Errore AbsSensor:', e.error.name));
      this.startCalibration();
    } catch (err) {
      console.error("Errore avvio sensori:", err);
      window.updatePitchYaw(0, 0, "Error: " + err.message);
    }
  },

  startCalibration() {
    if (!this.gyroSensor || !this.absSensor) return;
    if (this.calibrating) return;

    this.calibrating = true;
    this.running = false;
    this.biasSamples = [];
    this.calibSamplesNeeded = this.gyroFreq * this.calibDuration;
    this.currentMode = 'absolute';
    
    window.updatePitchYaw(0, 0, "Calibrating... 0%");
    
    this.gyroSensor.addEventListener('reading', this.onCalibReading);
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
      window.updatePitchYaw(0, 0); 
    } else {
      this.finishCalibration();
    }
  },

  finishCalibration() {
    if (!this.calibrating) return;
    this.calibrating = false;
    this.gyroSensor.removeEventListener('reading', this.onCalibReading);

    const avg = this.biasSamples.reduce((acc, r) => ({ x: acc.x + r.x, y: acc.y + r.y, z: acc.z + r.z }), { x: 0, y: 0, z: 0 });
    const len = this.biasSamples.length > 0 ? this.biasSamples.length : 1;
    this.gyroBias = { x: avg.x / len, y: avg.y / len, z: avg.z / len };
    console.log('Calibrazione giroscopio completata. Bias:', this.gyroBias);

    this.lastTime = performance.now();
    this.gyroSensor.addEventListener('reading', this.onSensorReading);
    this.running = true;
  },
  
  onAbsReading() {
    if (!this.absSensor) return;
    this.absOrientLast = this.absSensor.quaternion;
  },

  onSensorReading() {
    if (this.calibrating || !this.absOrientLast) {
      this.lastTime = performance.now();
      return;
    }

    const now = performance.now();
    const dt = Math.max(1e-6, (now - this.lastTime) / 1000);
    this.lastTime = now;

    if (this.currentMode === 'absolute') {
        const euler = this.quaternionToEuler(this.absOrientLast);
        this.orient.pitch = euler.pitch;
        this.orient.yaw = euler.yaw;
    } else { // 'gyro' mode
        let wx = this.gyroSensor.x - this.gyroBias.x;
        let wz = this.gyroSensor.z - this.gyroBias.z;

        if (Math.abs(wx) < this.gyroDeadzone) wx = 0;
        if (Math.abs(wz) < this.gyroDeadzone) wz = 0;

        this.orient.pitch += wx * dt;
        this.orient.yaw += wz * dt;
    }
    
    window.updatePitchYaw(this.orient.pitch, this.orient.yaw, "Running");
    this.runApplicationLogic(this.orient.pitch, this.orient.yaw);
  },

  runApplicationLogic(pitch, yaw) {
    const fov = Math.exp(logFov);
    const requiredMode = (fov < this.fovThreshold) ? 'gyro' : 'absolute';

    if (requiredMode !== this.currentMode) {
        this.transitionToMode(requiredMode);
    }
    
    const sensitivity = (this.currentMode === 'gyro') ? 0.1 : 0.5;

    if (this.oldX === null || this.oldY === null) {
      this.oldX = yaw;
      this.oldY = pitch;
      return;
    }

    const adjustedYaw = unwrapAngle(yaw, this.oldX);
    
    this.oldX += (adjustedYaw - this.oldX) * sensitivity;
    this.oldY += (pitch - this.oldY) * sensitivity;

    // Throttle outgoing messages to index.html to avoid flooding
    try {
      eventManager.sendThrottledProtobject(
        { msg: "updateView", values: { h: this.oldX, v: this.oldY } },
        "index.html",
        ORIENTATION_SEND_MS
      );
    } catch (e) {
      Protobject.Core.send({
        msg: "updateView",
        values: { h: this.oldX, v: this.oldY },
      }).to("index.html");
    }

    // Locally update the guide/view at most once per animation frame
    if (!this._pendingRAF) {
      this._pendingRAF = true;
      requestAnimationFrame(() => {
        updateStellariumView({ h: this.oldX, v: this.oldY }); // para guia
        this._pendingRAF = false;
      });
    }
  },

  transitionToMode(newMode) {
    console.log(`Transizione richiesta a: ${newMode}`);
    if (newMode === 'gyro' && this.currentMode === 'absolute') {
        console.log("-> Attivazione modalità GYRO");
        const euler = this.quaternionToEuler(this.absOrientLast);
        this.orient.pitch = euler.pitch;
        this.orient.yaw = euler.yaw;
        this.oldX = euler.yaw;
        this.oldY = euler.pitch;
    } else if (newMode === 'absolute' && this.currentMode === 'gyro') {
        console.log("-> Attivazione modalità ABSOLUTE");
        const euler = this.quaternionToEuler(this.absOrientLast);
        this.oldX = unwrapAngle(euler.yaw, this.oldX);
        this.oldY = euler.pitch;
    }
    this.currentMode = newMode;
  }
};

window.Orientation.start();

*/