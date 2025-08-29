function applyPollution({ bortle }) {
    // Ajustar parámetros del motor
    // console.log("Applying pollution with value:", bortle);
    bortle = parseInt(bortle);

    if (engine.core) {
        engine.core.bortle_index = bortle; // de 1 a 9
        engine.core.milkyway.visible = bortle < 6;

        // Magnitud límite: de 7.5 (cielo oscuro) a 1.0 (ciudad)
        if (bortle === 1) {
            engine.core.display_limit_mag = 14;
        } else {
            engine.core.display_limit_mag = 7.5 - 0.8 * (bortle - 1);
        }
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