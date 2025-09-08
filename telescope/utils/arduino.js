const min = parseFloat(blurSlider.min);
const max = parseFloat(blurSlider.max);
const step = parseFloat(blurSlider.step) || 1;

function updateFocusSlider(valore) {
  // mappa il valore 0–1023 al range dello slider
  let mapped = min + (valore / 1023) * (max - min);
  mapped = Math.round(mapped / step) * step;

  blurSlider.value = mapped;

  currentBlur = parseFloat(mapped);
  updateDisplayBlur();

  Protobject.Core.send({
    msg: "arduinoCommand",
    values: {
      pin: currentBlur,
    },
  }).to("index.html"); // Send message to the file
}

Protobject.Arduino.start();
console.log("data");

let lastZone = null; // memorizza l'ultima zona per evitare click ripetuti
let lastA1 = null; // memorizza l'ultimo valore a1 per evitare update ripetuti

Protobject.Arduino.onData((data) => {
  const a0 = data["a0"];
  let zone = null;

  // determinazione zona in base al valore a0
  if (a0 > 1000) {
    zone = "nozoom";
  } else if (a0 < 700 && a0 > 450) {
    zone = "zooma";
  } else if (a0 < 300 && a0 > 180) {
    zone = "zoomb";
  } else if (a0 < 180) {
    zone = "zoomc";
  }

  // click solo se la zona è cambiata
  if (zone && zone !== lastZone) {
    document.getElementById(zone)?.click();
    lastZone = zone;
    console.log("Click su zona:", zone, "valore a0:", a0);
  }

  const a1 = parseInt(data["a1"]);

  if (lastA1 === null || a1 !== lastA1) {
    updateFocusSlider(a1);
    lastA1 = a1;
    console.log("Aggiornato focus slider a1:", a1);
  }
});
