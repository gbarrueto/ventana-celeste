function unwrapAngle(angle, reference) {
  while (angle - reference > Math.PI) angle -= 2 * Math.PI;
  while (angle - reference < -Math.PI) angle += 2 * Math.PI;
  return angle;
}

export function createOrientationController({
  getLogFov = () => 0.05,
  onDebug = () => {},
  onCoords = () => {},
  onView = () => {},
  onCalibrationVisibility = () => {},
  onError = () => {},
} = {}) {
  const state = {
    gyroFreq: 100,
    absFreq: 30,
    calibDuration: 1,
    fovThreshold: 0.2,
    gyroDeadzone: 0.003,
    dynamicThreshold: 0.06,
    dynamicGainMultiplier: 10.0,
    dynamicSmoothingFactor: 0.15,
    gyroSensor: null,
    absSensor: null,
    running: false,
    calibrating: false,
    preCalibrating: false,
    sensorsStarted: false,
    preCalibStatus: "moving",
    preCalibCountdown: 2,
    preCalibLastTime: 0,
    gyroBias: { x: 0, y: 0, z: 0 },
    biasSamples: [],
    calibSamplesNeeded: 300,
    orient: { pitch: 0, yaw: 0 },
    absOrientLast: null,
    currentMode: "absolute",
    oldX: null,
    oldY: null,
    rawDynamicX: null,
    rawDynamicY: null,
    lastTime: null,
    pendingRAF: false,
  };

  function quaternionToEuler(q) {
    if (!q) return { yaw: 0, pitch: 0 };
    const x = q[0];
    const y = q[1];
    const z = q[2];
    const w = q[3];
    const pitch = Math.atan2(2 * (w * x + y * z), 1 - 2 * (x * x + y * y));
    const yaw = Math.atan2(2 * (w * z + x * y), 1 - 2 * (y * y + z * z));
    return { yaw, pitch };
  }

  function emitDebug(partial) {
    onDebug(partial);
  }

  function emitCoords(yaw, pitch) {
    onCoords({
      yaw,
      pitch,
      yawDeg: (yaw * 180) / Math.PI,
      pitchDeg: (pitch * 180) / Math.PI,
    });
  }

  function updateView() {
    const h = state.oldX;
    const v = state.oldY;

    if (!state.pendingRAF) {
      state.pendingRAF = true;
      requestAnimationFrame(() => {
        onView({ h, v });
        state.pendingRAF = false;
      });
    }
  }

  function finishCalibration() {
    state.calibrating = false;
    onCalibrationVisibility(false);

    if (state.gyroSensor) {
      state.gyroSensor.removeEventListener("reading", onCalibReading);
    }

    const avg = state.biasSamples.reduce(
      (acc, sample) => ({ x: acc.x + sample.x, y: acc.y + sample.y, z: acc.z + sample.z }),
      { x: 0, y: 0, z: 0 }
    );
    const len = state.biasSamples.length || 1;
    state.gyroBias = { x: avg.x / len, y: avg.y / len, z: avg.z / len };

    try {
      localStorage.setItem("astrovis_gyro_bias", JSON.stringify(state.gyroBias));
      console.log("Saved gyro bias to local storage:", state.gyroBias);
    } catch (e) {
      console.error("Failed to save gyro bias to local storage", e);
    }

    if (state.absOrientLast) {
      const euler = quaternionToEuler(state.absOrientLast);
      state.oldX = euler.yaw;
      state.oldY = euler.pitch;
      state.orient.yaw = euler.yaw;
      state.orient.pitch = euler.pitch;
    } else {
      state.oldX = 0;
      state.oldY = 0;
    }

    state.lastTime = performance.now();
    state.gyroSensor.addEventListener("reading", onSensorReading);
    state.running = true;
    emitDebug({ calibrating: false, activeSource: "calibration-finished" });
  }

  function onCalibReading() {
    emitDebug({
      gyro: {
        x: state.gyroSensor.x,
        y: state.gyroSensor.y,
        z: state.gyroSensor.z,
      },
    });

    if (state.biasSamples.length < state.calibSamplesNeeded) {
      state.biasSamples.push({
        x: state.gyroSensor.x,
        y: state.gyroSensor.y,
        z: state.gyroSensor.z,
      });
    } else {
      finishCalibration();
    }
  }

  function onPreCalibReading() {
    const speed = Math.hypot(state.gyroSensor.x, state.gyroSensor.y, state.gyroSensor.z);
    
    const isMoving = speed > 0.05;
    const now = performance.now();
    
    if (isMoving) {
        state.preCalibStatus = "moving";
        state.preCalibCountdown = 2;
        state.preCalibLastTime = now;
    } else {
        state.preCalibStatus = "countdown";
        if (now - state.preCalibLastTime >= 1000) {
            state.preCalibLastTime = now;
            state.preCalibCountdown -= 1;
            
            if (state.preCalibCountdown < 0) {
                state.preCalibrating = false;
                state.gyroSensor.removeEventListener("reading", onPreCalibReading);
                startActualCalibration();
                return;
            }
        }
    }
    
    emitDebug({ 
        preCalibrating: true, 
        preCalibStatus: state.preCalibStatus, 
        preCalibCountdown: state.preCalibCountdown,
        activeSource: "pre-calibration" 
    });
  }

  function onAbsReading() {
    if (!state.absSensor) return;
    state.absOrientLast = state.absSensor.quaternion;
    if (state.absOrientLast) {
      emitDebug({
        absQuat: {
          x: state.absOrientLast[0],
          y: state.absOrientLast[1],
          z: state.absOrientLast[2],
          w: state.absOrientLast[3],
        },
      });
    }
  }

  function runApplicationLogic(pitch, yaw, fov) {
    const requiredMode = fov < state.fovThreshold ? "gyro" : "absolute";
    if (requiredMode !== state.currentMode) {
      transitionToMode(requiredMode);
    }

    emitDebug({ activeSensorMode: state.currentMode });

    const sensitivity = state.currentMode === "gyro" ? 0.1 : 0.5;
    if (state.oldX === null || state.oldY === null) {
      state.oldX = yaw;
      state.oldY = pitch;
      return;
    }

    const adjustedYaw = unwrapAngle(yaw, state.oldX);
    state.oldX += (adjustedYaw - state.oldX) * sensitivity;
    state.oldY += (pitch - state.oldY) * sensitivity;
    updateView();
  }

  function transitionToMode(newMode) {
    if (newMode === "gyro" && state.currentMode === "absolute") {
      if (state.absOrientLast) {
        const euler = quaternionToEuler(state.absOrientLast);
        state.orient.pitch = euler.pitch;
        state.orient.yaw = euler.yaw;
        state.oldX = euler.yaw;
        state.oldY = euler.pitch;
      }
    } else if (newMode === "absolute" && state.currentMode === "gyro") {
      if (state.absOrientLast) {
        const euler = quaternionToEuler(state.absOrientLast);
        state.oldX = unwrapAngle(euler.yaw, state.oldX);
        state.oldY = euler.pitch;
      }
    }

    state.currentMode = newMode;
  }

  function onSensorReading() {
    emitDebug({
      gyro: {
        x: state.gyroSensor.x,
        y: state.gyroSensor.y,
        z: state.gyroSensor.z,
      },
    });

    if (state.calibrating) {
      state.lastTime = performance.now();
      return;
    }

    const now = performance.now();
    const dt = Math.max(1e-6, (now - state.lastTime) / 1000);
    state.lastTime = now;

    let currentV = 0.05;
    try {
      currentV = Math.exp(getLogFov());
    } catch {
      currentV = 0.05;
    }

    const inDynamicZone = currentV < state.dynamicThreshold;

    if (inDynamicZone) {
      const wx = state.gyroSensor.x - state.gyroBias.x;
      const wz = state.gyroSensor.z - state.gyroBias.z;
      let effWx = wx;
      let effWz = wz;
      if (Math.abs(effWx) < state.gyroDeadzone) effWx = 0;
      if (Math.abs(effWz) < state.gyroDeadzone) effWz = 0;

      const rawDeltaYaw = effWz * dt;
      const rawDeltaPitch = effWx * dt;
      
      const rawZoomRatio = currentV / state.dynamicThreshold;
      let zoomRatio = Math.pow(rawZoomRatio, 1.8);
      
      const thresholdV = 0.0030;
      const minFactor = Math.pow(thresholdV / state.dynamicThreshold, 1.8);
      
      if (currentV < thresholdV) {
        zoomRatio = minFactor * (currentV / thresholdV);
      }
      
      const totalFactor = zoomRatio;

      if (state.rawDynamicX === null) {
        state.rawDynamicX = state.oldX;
        state.rawDynamicY = state.oldY;
      }

      state.rawDynamicX += rawDeltaYaw * totalFactor;
      state.rawDynamicY += rawDeltaPitch * totalFactor;

      const k = state.dynamicSmoothingFactor;
      state.oldX += (state.rawDynamicX - state.oldX) * k;
      state.oldY += (state.rawDynamicY - state.oldY) * k;
      state.orient.yaw = state.oldX;
      state.orient.pitch = state.oldY;
      
      if (state.lastV === undefined) state.lastV = currentV;
      const deltaV = currentV - state.lastV;
      if (deltaV > 0.000001 && state.absOrientLast && state.lastV < state.fovThreshold) {
        const euler = quaternionToEuler(state.absOrientLast);
        const f = (v) => Math.max(0, 1.0 - Math.pow(v / state.fovThreshold, 2.5));
        const fLast = f(state.lastV);
        const fCurr = f(currentV);
        
        let progress = 0;
        if (fLast > 0.0001) {
            progress = 1.0 - (fCurr / fLast);
        } else {
            progress = 1.0;
        }
        progress = Math.max(0, Math.min(1, progress));
        
        state.orient.pitch += (euler.pitch - state.orient.pitch) * progress;
        const targetYaw = unwrapAngle(euler.yaw, state.orient.yaw);
        state.orient.yaw += (targetYaw - state.orient.yaw) * progress;
        
        state.oldX = state.orient.yaw;
        state.oldY = state.orient.pitch;
        state.rawDynamicX = state.orient.yaw;
        state.rawDynamicY = state.orient.pitch;
      }
      state.lastV = currentV;

      emitDebug({ activeSensorMode: "dynamic", activeSource: "gyroscope" });
      emitCoords(state.oldX, state.oldY);
      updateView();
      return;
    }

    state.rawDynamicX = null;
    state.rawDynamicY = null;

    if (state.currentMode === "absolute" && state.absOrientLast) {
      const euler = quaternionToEuler(state.absOrientLast);
      state.orient.pitch = euler.pitch;
      state.orient.yaw = euler.yaw;
      emitDebug({ activeSource: "absolute-orientation" });
    } else {
      let wx = state.gyroSensor.x - state.gyroBias.x;
      let wz = state.gyroSensor.z - state.gyroBias.z;
      if (Math.abs(wx) < state.gyroDeadzone) wx = 0;
      if (Math.abs(wz) < state.gyroDeadzone) wz = 0;
      state.orient.pitch += wx * dt;
      state.orient.yaw += wz * dt;
      
      if (state.lastV === undefined) state.lastV = currentV;
      const deltaV = currentV - state.lastV;
      if (deltaV > 0.000001 && state.absOrientLast && state.lastV < state.fovThreshold) {
        const euler = quaternionToEuler(state.absOrientLast);
        const f = (v) => Math.max(0, 1.0 - Math.pow(v / state.fovThreshold, 2.5));
        const fLast = f(state.lastV);
        const fCurr = f(currentV);
        
        let progress = 0;
        if (fLast > 0.0001) {
            progress = 1.0 - (fCurr / fLast);
        } else {
            progress = 1.0;
        }
        progress = Math.max(0, Math.min(1, progress));
        
        state.orient.pitch += (euler.pitch - state.orient.pitch) * progress;
        const targetYaw = unwrapAngle(euler.yaw, state.orient.yaw);
        state.orient.yaw += (targetYaw - state.orient.yaw) * progress;
      }
      state.lastV = currentV;
      
      emitDebug({ activeSource: "gyroscope" });
    }

    emitCoords(state.orient.yaw, state.orient.pitch);
    runApplicationLogic(state.orient.pitch, state.orient.yaw, currentV);
  }

  async function requestIOSPermissionIfNeeded() {
    if (
      typeof DeviceOrientationEvent !== "undefined" &&
      typeof DeviceOrientationEvent.requestPermission === "function"
    ) {
      await DeviceOrientationEvent.requestPermission();
    }
  }

  async function startSensors() {
    try {
      await requestIOSPermissionIfNeeded();
      if (!("Gyroscope" in window) || !("RelativeOrientationSensor" in window)) {
        throw new Error("Required sensors not available");
      }

      state.gyroSensor = new Gyroscope({ frequency: state.gyroFreq });
      state.absSensor = new RelativeOrientationSensor({ frequency: state.absFreq });
      state.absSensor.addEventListener("reading", onAbsReading);
      
      let loadedBias = false;
      try {
        const savedBias = localStorage.getItem("astrovis_gyro_bias");
        if (savedBias) {
          const parsed = JSON.parse(savedBias);
          if (typeof parsed.x === 'number' && typeof parsed.y === 'number' && typeof parsed.z === 'number') {
            state.gyroBias = parsed;
            loadedBias = true;
            console.log("Loaded saved gyro bias:", parsed);
            
            if (!state.sensorsStarted) {
              state.gyroSensor.addEventListener("reading", onSensorReading);
              state.gyroSensor.start();
              state.absSensor.start();
              state.sensorsStarted = true;
              state.running = true;
            }
          }
        }
      } catch (e) {
        console.error("Failed to load gyro bias from local storage", e);
      }

      if (!loadedBias) {
        startCalibration();
      }
    } catch (error) {
      onError(error);
      emitDebug({ activeSource: "sensor-error" });
    }
  }

  function startCalibration() {
    if (!state.gyroSensor || !state.absSensor) return;

    onCalibrationVisibility(true);
    state.calibrating = false;
    state.preCalibrating = true;
    state.running = false;
    
    state.preCalibStatus = "moving";
    state.preCalibCountdown = 2;
    state.preCalibLastTime = performance.now();

    state.gyroSensor.removeEventListener("reading", onSensorReading);
    state.gyroSensor.removeEventListener("reading", onCalibReading);
    state.gyroSensor.removeEventListener("reading", onPreCalibReading);

    emitDebug({ 
        preCalibrating: true, 
        preCalibStatus: state.preCalibStatus, 
        preCalibCountdown: state.preCalibCountdown,
        calibrating: false,
        activeSource: "pre-calibration" 
    });

    state.gyroSensor.addEventListener("reading", onPreCalibReading);
    if (!state.sensorsStarted) {
      state.gyroSensor.start();
      state.absSensor.start();
      state.sensorsStarted = true;
    }
  }

  function startActualCalibration() {
    state.calibrating = true;

    state.biasSamples = [];
    state.calibSamplesNeeded = state.gyroFreq * state.calibDuration;
    state.currentMode = "absolute";
    emitDebug({ calibrating: true, preCalibrating: false, activeSource: "calibration" });

    state.gyroSensor.addEventListener("reading", onCalibReading);
  }

  function cancelCalibration() {
    if (!state.calibrating && !state.preCalibrating) return;

    state.calibrating = false;
    state.preCalibrating = false;
    state.running = true;
    onCalibrationVisibility(false);

    if (state.gyroSensor) {
      state.gyroSensor.removeEventListener("reading", onPreCalibReading);
      state.gyroSensor.removeEventListener("reading", onCalibReading);
      state.gyroSensor.removeEventListener("reading", onSensorReading);
      state.gyroSensor.addEventListener("reading", onSensorReading);
    }

    if (state.absOrientLast) {
      const euler = quaternionToEuler(state.absOrientLast);
      state.oldX = euler.yaw;
      state.oldY = euler.pitch;
      state.orient.yaw = euler.yaw;
      state.orient.pitch = euler.pitch;
    }

    state.lastTime = performance.now();
    emitDebug({ calibrating: false, preCalibrating: false, activeSource: "calibration-cancelled" });
  }

  function start( calibrateOnStart = true ) {
    if (calibrateOnStart) {
        emitDebug({ activeSource: "sensor-start" });
        startSensors();
    }
  }

  function stop() {
    state.running = false;
    state.calibrating = false;

    if (state.gyroSensor) {
      try {
        state.gyroSensor.stop();
      } catch {
        // no-op
      }
    }

    if (state.absSensor) {
      try {
        state.absSensor.stop();
      } catch {
        // no-op
      }
    }
  }

  return {
    start,
    stop,
    startCalibration,
    cancelCalibration,
  };
}
