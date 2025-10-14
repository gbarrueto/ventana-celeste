const functionMap = {
  "toggleEyepiece": toggleEyepieceOverlay,
  "updateFov": updateStellariumFov,
  "updateBlur": updateStellariumBlur,
  "updateView": updateStellariumView,
  "applyLocation": applyLocation,
  "setSpeed": setSpeed,
  "updateDate": updateDate,
  "setDatetimeInterval": () => setDatetimeInterval(),
  "clearDatetimeInterval": () => clearDatetimeInterval(),
  "updatePollution": applyPollution,
  "togglePollution": togglePollutionOverlay,
  "stellariumOption": stellariumOption,
  "arduinoCommand": arduinoCommand,
  "seeingOption": applySeeingOption,
  "simpleSettings": () => enableSimpleModeSettings(),
  "advancedSettings": () => enableAdvancedModeSettings(),
};

Protobject.Core.onReceived((data) => {
  const { msg, values } = data;

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