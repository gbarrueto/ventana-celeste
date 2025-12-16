import { sendSeeingValue } from "../Menu/Seeing/seeing.js";
import { eventManager } from "./eventManager.js"

let blurSlider = document.getElementById('focusSlider')

const min = parseFloat(blurSlider.min);
const max = parseFloat(blurSlider.max);
const step = parseFloat(blurSlider.step) || 1;

function updateFocusSlider(valore) {
  const inMin = 400;
  const inMax = 1023;

  let mapped = min + ((valore - inMin) / (inMax - inMin)) * (max - min);
  mapped = Math.round(mapped / step) * step;

  blurSlider.value = mapped;

  currentBlur = parseFloat(mapped);
  


  sendSeeingValue({ target: "focus", value: currentBlur });
  
 
    
}


Protobject.Arduino.start();
console.log("data");

let lastZone = null; // memorizza l'ultima zona per evitare click ripetuti
let lastA1 = null; // memorizza l'ultimo valore a1 per evitare update ripetuti
let len1Value=165;
let len2Value=220;
let len3Value=303;
let len4Value=475;

Protobject.Arduino.onData((data) => {
  const a0 = data["a0"];

  //console.log(a0);


  let zone = null;



  // determinazione zona in base al valore a0
  if (a0 < 10) {
    zone = "nolen";
  } else if (a0 < len1Value + 20 && a0 > len1Value - 50) {
    zone = "len1";
  } else if (a0 < len2Value+30 && a0 > len2Value - 20) {
    zone = "len2";
  } else if (a0 < len3Value+50 && a0 > len3Value-30) {
    zone = "len3";
  } else if (a0 > len4Value - 60) {
    zone = "len4";
  }

  // click solo se la zona è cambiata
  if (zone && zone !== lastZone) {

    
    if (zone=="nolen"){
      //applyZoom(); //desactiva los botones

      Protobject.Core.send({
         msg: "noLenBlurry"
      }).to("index.html");


    } else {

      Protobject.Core.send({
         msg: "yesLenNormal"
      }).to("index.html");

      const btn = document.querySelector('button[name="'+ zone +'"]');
      if (btn) btn.click();
    }
    
    

    lastZone = zone;
    console.log("Click su zona:", zone, "valore a0:", a0);
  }

  const a1 = parseInt(data["a1"]);
  document.getElementById('focusval').innerHTML=a1;

  if (lastA1 === null || a1 !== lastA1) {
    updateFocusSlider(a1);
    lastA1 = a1;
    //console.log("Aggiornato focus slider a1:", a1);
  }
});
