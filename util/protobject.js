Protobject.Core.onReceived((data) => {
  if (data.f !== undefined) updateStellariumFov(data.f); // Zoom
  if (data.blur !== undefined) updateStellariumBlur(data.blur); // Enfoque
  if (data.h !== undefined || data.v !== undefined) updateStellariumView(data); // Movimiento

  // if (data.lat !== undefined && data.lon !== undefined)
  //   applyArUcoPosition(data.lat, data.lon); // Aruco

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

  // Actualizar velocidad del paso del tiempo
  if (data.speed !== undefined) setSpeed(data.speed);
  // Actualizar fecha interna del core
  if (data.date !== undefined) updateDate(data.date);
  if (data.setDatetimeInterval !== undefined) {
    data.setDatetimeInterval == true
      ? setDatetimeInterval()
      : clearDatetimeInterval();
  }

  // Pollution
  if (data.bortle !== undefined) applyPollution(data.bortle);

  // Stellarium Options
  if (data.optionInfo !== undefined) stellariumOption(data.optionInfo);
});
