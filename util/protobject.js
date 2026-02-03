import {
  clearDatetimeInterval,
  setDatetimeInterval,
  setEngineSpeed,
  updateDate,
} from "./time.js";
import { applyLocation, applyPollution } from "./location.js";
import { toggleEyepieceOverlay, updateStellariumBlur } from "./overlay.js";
import {
  updateStellariumFov,
  updateStellariumView,
  stellariumOption,
  enableAdvancedModeSettings,
  enableSimpleModeSettings,
  getSynchronizeData,
} from "./stel.js";

const functionMap = {
  toggleEyepiece: toggleEyepieceOverlay,
  updateFov: updateStellariumFov,
  updateBlur: updateStellariumBlur,
  updateView: updateStellariumView,
  applyLocation: applyLocation,
  setSpeed: setEngineSpeed,
  updateDate: updateDate,
  setDatetimeInterval: () => setDatetimeInterval(),
  clearDatetimeInterval: () => clearDatetimeInterval(),
  updatePollution: applyPollution,
  stellariumOption: stellariumOption,
  noLenBlurry: noLenBlurry,
  yesLenNormal: yesLenNormal,
  seeingOption: applySeeingOption,
  simpleSettings: () => enableSimpleModeSettings(),
  advancedSettings: () => enableAdvancedModeSettings(),
  requestSynchronizeData: getSynchronizeData,
};

// Simple stats collector for incoming Protobject messages
window.ProtobjectStats = {
  received: {},
  increment(msg) {
    this.received[msg] = (this.received[msg] || 0) + 1;
  },
  get() {
    return JSON.parse(JSON.stringify(this.received));
  },
  reset() {
    this.received = {};
  },
};

Protobject.Core.onReceived((data) => {
  const { msg, values } = data;

  // count incoming messages for diagnostics
  try {
    window.ProtobjectStats.increment(msg);
  } catch (e) {}

  if (msg && functionMap[msg]) {
    const targetFunction = functionMap[msg];

    if (typeof targetFunction === "function") {
      // console.log(`Ejecutando función: ${msg} con valores:`, values);
      targetFunction(values);
    }
  } else {
    console.warn(`Función no encontrada para el mensaje: ${msg}`);
  }
});

Protobject.Core.onConnected(() => {
  console.log("new connection to index.html");
});
