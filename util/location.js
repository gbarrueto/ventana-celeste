

function getMinMagnitude( bortle ) {
    return 7.5 - 0.8 * (bortle - 1);
}

function limitingMag(bortle, fov, fovMax = 3.228859) {
  // Magnitud base a ojo desnudo según bortle
  const nelmByBortle = getMinMagnitude(bortle);

  // Escalado de zoom
  const gamma = 15; // lineal; prueba con 0.7 o 1.3 para suavizar
  const zoomFactor = 1 - (fov / fovMax);
  const gain = 16 * Math.pow(Math.max(0, zoomFactor), gamma);

  return nelmByBortle + gain;
}

function applyPollution({ bortle }) {
    // Ajustar parámetros del motor
    // console.log("Applying pollution with value:", bortle);
    bortle = parseInt(bortle);

    if (engine.core) {
        engine.core.bortle_index = bortle; // de 1 a 9
        engine.core.milkyway.visible = bortle < 6;

        // Magnitud límite: de 7.5 (cielo oscuro) a 1.0 (ciudad)
        
        engine.core.display_limit_mag = limitingMag(bortle, engine.core.fov);

        engine.core.star_relative_scale = 0.9;
    }
    updatePollutionOverlay({ bortle });
}

async function applyLocation({
    cityName = "Custom",
    lat = 0,
    lon = 0,
    elev = 0,
    bortle_index = 0,
}) {
    if (!engine) return;

    engine.core.observer.latitude = lat * (Math.PI / 180);
    engine.core.observer.longitude = lon * (Math.PI / 180);
    engine.core.observer.elevation = elev;

    // Set LP to new location

    applyPollution({ bortle: bortle_index });

    //console.log("Bortle index for", cityName, ":", bortle_index);
}