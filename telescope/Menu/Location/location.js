function displayLocation(e) {
  optionSelection(e);

  let locationSection = document.getElementById('locationSection')

  if (!locationSection) {
    let buttonsHtml = "";
    for (const city in cities) {
      const isSelected = city === selectedCity;
      buttonsHtml += `
      <button class="control-button" style="
        display: block;
        width: 100%;
        margin-bottom: 0.5rem;
        background-color: ${isSelected ? "#4caf50" : "rgba(255,255,255,0.1)"};
        font-weight: ${isSelected ? "bold" : "normal"};
      " onclick="applyLocation('${city}')">
        ${city}
      </button>`;
    }

    let section = `
      <section id="locationSection" class="active" style="display: grid; overflow-y: scroll">
        <h3>Select Location</h3>
        <div id="locationButtonsContainer">
          ${buttonsHtml}
        </div>
      </section>
    `;

    interactionSection.innerHTML = section;
    return;
  }

  locationSection.style.display = 'block';
  locationSection.classList.add('active');
}

function applyLocation(cityName) {
  Protobject.Core.send({ cityName }).to("index.html");
}
