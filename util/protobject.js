Protobject.Core.onReceived((data) => {
  console.log(data);
  if (data.f !== undefined) updateStellariumFov(data.f); // Zoom
  if (data.blur !== undefined) updateStellariumBlur(data.blur); // Enfoque
  if (data.h !== undefined || data.v !== undefined) updateStellariumView(data); // Movimiento

  if (data.lat !== undefined && data.lon !== undefined)
    applyArUcoPosition(data.lat, data.lon); // Aruco

  if (data.eyepieceSignal !== undefined)
    data.eyepieceSignal === true
      ? setEyepieceOverlay()
      : removeEyepieceOverlay(); // Vista ocular

  // Aplicar ubicacion
  if (data.cityName && data.lat !== undefined && data.lon !== undefined)
    applyLocation({
      cityName: data.cityName,
      lat: data.lat,
      lon: data.lon,
      elev: data.elev,
      bortle_index: data.bortle_index,
    });

  // Date && Time
  if (data.speed !== undefined) setSpeed(data.speed);
  if (data.date !== undefined) updateDate(data.date);
  if (data.setDatetimeInterval !== undefined) {
    data.setDatetimeInterval == true
      ? setDatetimeInterval()
      : clearDatetimeInterval();
  }

  // Pollution
  if (data.bortle !== undefined) applyPollution(data.bortle);
});
