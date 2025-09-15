let globe;
let globeInitialized = false;
let globePoint = [{ lat: -33.4489, lng: -70.6693, size: 1.5, color: "red" }];

function displayGlobe(e) {
  optionSelection(e); // Mantiene selección del botón

  // Crear div del globo si no existe
  let globeDiv = document.getElementById("globeViz");
  if (!globeDiv) {
    globeDiv = document.createElement("div");
    globeDiv.id = "globeViz";
    globeDiv.classList.add("active");
    globeDiv.style.width = "100%";
    globeDiv.style.height = "98%";
    globeDiv.style.position = "relative";
    globeDiv.style.overflow = "hidden";
    interactionSection.appendChild(globeDiv);
  } else {
    globeDiv.style.display = "block";
    globeDiv.style.transform = 'translateY(0)';
    globeDiv.classList.add("active");
  }

  // Inicializar globo solo una vez
  if (!globeInitialized) {
    globe = Globe()(globeDiv)
      .globeImageUrl(
        "//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
      )
      .backgroundImageUrl("//unpkg.com/three-globe/example/img/night-sky.png")
      .pointAltitude("size")
      .pointColor("color")
      .pointsData(globePoint);

    // Mover la cámara al punto inicial
    const { lat, lng } = globePoint[0];
    globe.pointOfView({ lat, lng, altitude: 3 }, 1000); // 3 puede ajustarse según zoom

    globeInitialized = true;
  }
}
