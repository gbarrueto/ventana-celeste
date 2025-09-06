let bortleIndex = 0;

async function getBortleIndex(latlng) {
  // console.log("getting Bortle index for:", latlng);
  return await getInfoFromLonLat(latlng);
}

function getInfoFromLonLat(elatlng) {
  return new Promise((resolve, reject) => {
    //console.log("LatLong: ", elatlng);
    var xhr;

    // if ( year == 0 ) {
    // return;
    // }

    //figure out which tile has binary data. Each tile is 600 x 600 points (1/120 degree resolution)

    var lonFromDateLine = mod(parseFloat(elatlng.lon) + 180.0, 360.0);
    var latFromStart = parseFloat(elatlng.lat) + 65.0;

    var tilex = Math.floor(lonFromDateLine / 5.0) + 1;
    var tiley = Math.floor(latFromStart / 5.0) + 1;

    if (tiley >= 1 && tiley <= 28) {
      var url =
        "https://telescope.alessiobellino.com/data/binary_tiles/" +
        "binary_tile_" +
        tilex +
        "_" +
        tiley +
        ".dat.gz";
      var ix = Math.round(
        120 * (lonFromDateLine - 5.0 * (tilex - 1) + 1 / 240)
      );
      var iy = Math.round(120 * (latFromStart - 5.0 * (tiley - 1) + 1 / 240));

      var xhr = new XMLHttpRequest();
      xhr.responseType = "arraybuffer";
      xhr.onload = function LpAtlasInBounds() {
        try {
          // console.log("Tile loaded, processing data...");

          if (xhr.status !== 200) {
            console.error("Failed to load tile:", url, "Status:", xhr.status);
            reject(new Error("Failed to load tile: " + url));
            return;
          }

          var data_array = new Int8Array(pako.ungzip(xhr.response));

          // console.log("Data array length:", data_array.length);

          var first_number =
            128 * Number(data_array[0]) + Number(data_array[1]);
          var change = 0.0;
          for (let i = 1; i < iy; i++) {
            change += Number(data_array[600 * i + 1]);
          }
          for (let i = 1; i < ix; i++) {
            change += Number(data_array[600 * (iy - 1) + 1 + i]);
          }
          var compressed = first_number + change;
          var brightnessRatio = compressed2full(compressed);
          var mpsas =
            22.0 - (5.0 * Math.log(1.0 + brightnessRatio)) / Math.log(100);
          bortleIndex = magToBortle(mpsas);

          // console.log("Bortle index at", elatlng, "is", bortleIndex);

          resolve(bortleIndex);
        } catch (e) {
          console.error("Error processing tile data:", e);
          reject(e);
        }
      };
      xhr.onerror = function () {
        console.error("Failed to load tile:", url);
        reject(new Error("Failed to load tile: " + url));
      };
      xhr.open("GET", url, true);
      xhr.send();
    } else {
      // fuera de bounds
      bortleIndex = null;
      resolve(null);
    }
  });
}

// javascript is weird for remainder with negative numbers, so make real modulo function:
function mod(n, m) {
  return ((n % m) + m) % m;
}

// function to convert compressed integers to brightness ratio:
function compressed2full(x) {
  return (5.0 / 195.0) * (Math.exp(0.0195 * x) - 1.0);
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
