/**
 * Light pollution data from coordinates.
 * Replaces: telescope/utils/lp/getLpFromCoords.js
 * Uses pre-existing pako global (loaded via script tag).
 */

function mod(n, m) {
  return ((n % m) + m) % m;
}

function compressed2full(x) {
  return (5.0 / 195.0) * (Math.exp(0.0195 * x) - 1.0);
}

export function getMagFromLonLat({ lat, lon }) {
  return new Promise((resolve, reject) => {
    const lonFromDateLine = mod(parseFloat(lon) + 180.0, 360.0);
    const latFromStart = parseFloat(lat) + 65.0;

    const tilex = Math.floor(lonFromDateLine / 5.0) + 1;
    const tiley = Math.floor(latFromStart / 5.0) + 1;

    if (tiley < 1 || tiley > 28) {
      resolve(null);
      return;
    }

    const url = `https://app.ventanaceleste.com/data/binary_tiles/binary_tile_${tilex}_${tiley}.dat.gz`;
    const ix = Math.round(120 * (lonFromDateLine - 5.0 * (tilex - 1) + 1 / 240));
    const iy = Math.round(120 * (latFromStart - 5.0 * (tiley - 1) + 1 / 240));

    const xhr = new XMLHttpRequest();
    xhr.responseType = 'arraybuffer';
    xhr.onload = function () {
      try {
        if (xhr.status !== 200) {
          reject(new Error('Failed to load tile: ' + url));
          return;
        }
        const data_array = new Int8Array(pako.ungzip(xhr.response));
        const first_number = 128 * Number(data_array[0]) + Number(data_array[1]);
        let change = 0;
        for (let i = 1; i < iy; i++) change += Number(data_array[600 * i + 1]);
        for (let i = 1; i < ix; i++) change += Number(data_array[600 * (iy - 1) + 1 + i]);
        const compressed = first_number + change;
        const brightnessRatio = compressed2full(compressed);
        const mpsas = 22.0 - (5.0 * Math.log(1.0 + brightnessRatio)) / Math.log(100);
        resolve(mpsas);
      } catch (e) {
        reject(e);
      }
    };
    xhr.onerror = () => reject(new Error('Failed to load tile: ' + url));
    xhr.open('GET', url, true);
    xhr.send();
  });
}
