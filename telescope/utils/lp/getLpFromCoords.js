// async function getBortleIndex(latlng) {
//   // console.log("getting Bortle index for:", latlng);
//   const mag = await getInfoFromLonLat(latlng);
//   const b = magToBortle(mag);
//   return b;
// }

export function getMagFromLonLat(elatlng) {
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

          // Convertir a Bortle

          // bortleIndex = magToBortle(mpsas);

          // console.log("Bortle index at", elatlng, "is", bortleIndex);

          resolve(mpsas);
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
      // bortleIndex = null;
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
