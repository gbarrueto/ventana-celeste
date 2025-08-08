Protobject.Core.onReceived((data) => {
  if (data.f !== undefined) updateStellariumFov(data.f); // Zoom
  if (data.blur !== undefined) updateStellariumBlur(data.blur); // Enfoque
  if (data.h !== undefined || data.v !== undefined) updateStellariumView(data); // Movimiento
  if (data.toggleSignal !== undefined) toggleEyepieceOverlay(); // Vista ocular
  
  // Aplicar ubicacion
  if (data.cityName !== undefined) applyLocation({ cityName: data.cityName});
  if (data.lat !== undefined && data.lon !== undefined) applyLocation({ lat: data.lat, lon: data.lon, elev: data.elev });

  // Date && Time
  if (data.speed !== undefined) setSpeed(data.speed);
  if (data.date !== undefined) updateDate(data.date);
  if (data.setDatetimeInterval !== undefined) {
    data.setDatetimeInterval == true 
      ? setDatetimeInterval()
      : clearDatetimeInterval()
  }
});