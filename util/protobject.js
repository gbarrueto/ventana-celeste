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
  "stellariumOption": stellariumOption
};


Protobject.Core.onReceived((data) => {
  const { msg, values } = data;
  
  // console.log("Data received");

  if (msg && functionMap[msg]) {
    const targetFunction = functionMap[msg];
    
    if (typeof targetFunction === 'function') {
      // console.log(`Ejecutando función: ${msg} con valores:`, values);
      targetFunction(values);
    }
  } else {
    console.warn(`Función no encontrada para el mensaje: ${msg}`);
  }
});
