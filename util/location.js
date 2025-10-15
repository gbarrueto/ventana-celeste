async function applyLocation({
  cityName = "Custom",
  lat = 0,
  lon = 0,
  elev = 0,
  mag = null,
}) {
  if (!engine) return;

  engine.core.observer.latitude = lat * (Math.PI / 180);
  engine.core.observer.longitude = lon * (Math.PI / 180);
  engine.core.observer.elevation = elev;

    currentLat = lat;
    currentLon = lon;
    currentElev = elev;

    // Set LP to new location

    SQM_READING = mag;

    applyPollution({ mag });

  //console.log("Bortle index for", cityName, ":", bortle_index);
}

function applyPollution({ mag = 20 }) {
  SQM_READING = mag;

    bortle = magToBortle(mag);

    if (engine.core) {
        engine.core.bortle_index = bortle; // de 1 a 9
        engine.core.milkyway.visible = bortle < 6;

        engine.core.display_limit_mag = calculate_limit_mag();

        engine.core.star_relative_scale = 0.6;
    }

    isNightime() ? updatePollutionOverlay({ bortle }) : updatePollutionOverlay({ bortle: 1 });
}

// Convertion src: https://www.handprint.com/ASTRO/bortle.html
// Nota: LPMap asigna escala 8-9 en ciudades ya que no es claro diferenciar si se está en el centro o en las afueras.
// Aqui dejamos un valor de 16.53 como limite de la escala 8 pues es cercano al brillo del cielo al alejarse del centro urbano, pero no es exacto.
function magToBortle(magArcsec2) {
    if (magArcsec2 > 21.99) return 1; // Cielo prístino
    if (magArcsec2 > 21.89) return 2; // Cielo excelente
    if (magArcsec2 > 21.69) return 3; // Cielo rural
    if (magArcsec2 > 20.49) return 4; // Suburbano oscuro
    if (magArcsec2 > 19.5) return 5; // Suburbano intermedio
    if (magArcsec2 > 18.94) return 6; // Suburbano brillante
    if (magArcsec2 > 18.38) return 7; // Periurbano
    if (magArcsec2 > 16.53) return 8; // Ciudad
    return 9; // Centro de Ciudad
}
