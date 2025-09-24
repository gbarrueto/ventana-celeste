
function displayGlobe(e) {
  if (optionSelection(e)) return; // Mantiene selección del botón

  // Crear div del globo si no existe
  let globeDiv = document.getElementById("globeViz");
    // globeDiv.style.display = "block";
  globeDiv.classList.add("active");
}
