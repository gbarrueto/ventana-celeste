function syncTime(values) {
  engineUTC = values.engineUTC;
}

// Enviar coordenadas a telescope
async function sendCoordinates({ lat, lon }) {
  const pollution = await getMagFromLonLat({ lat, lon });
  // console.log("Pollution level:", pollution);

  const elev = 0;
  const tz = getUtcOffset(lat, lon);

  updateTimeZone(tz);
  updatePollution();

  const data = {
    cityName: "Custom",
    lon,
    lat,
    elev,
    mag: pollution,
  };

  applyLocation(data); // Para guidescope
  Protobject.Core.send({ msg: "applyLocation", values: data }).to("index.html");
}

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