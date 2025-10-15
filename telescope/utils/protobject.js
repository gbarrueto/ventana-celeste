const functionMap = {
  sendCoordinates: sendCoordinates,
  syncTime: syncTime,
};

Protobject.Core.onReceived((data) => {
  const { msg, values } = data;

  // console.log("Data received");

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

Protobject.Core.onConnected((() => {})());