function displayLocation(e) {
  optionSelection(e);

  let locationSection = document.getElementById("locationSection");

  if (!locationSection) {
    let buttonsHtml = "";
    for (const city in cities) {
      const isSelected = city === selectedCity;

      if (isSelected) {
        const data = cities[city];
        currentLat = data.lat;
        currentLon = data.lon;
        currentElev = data.elev;
      }
      buttonsHtml += `
      <button class="control-button ${isSelected ? "active" : ""}"
        onclick="applyLocation({ e: event, cityName: '${city}' }); updateLocationInputValues('${city}')">
        ${city}
      </button>`;
    }

    let section = `
      <section id="locationSection" class="active" style="display: grid; overflow-y: scroll">
        <h3>Select Location</h3>
        <div class="container">
          <div id="locationButtonsContainer">
            ${buttonsHtml}
          </div>

          <div id="locationVariablesContainer">
            <label>
              Latitud
              <input 
                type="number"
                name="lat"
                value=${currentLat}
                onfocus="select()" />
            </label>

            <label>
              Longitud
              <input 
                type="number"
                name="lon"
                value=${currentLon}
                onfocus="select()" />
            </label>

            <label>
              Elevacion
              <input 
                type="number"
                name="elev"
                value=${currentElev}
                onfocus="select()" />
            </label>

            <button onclick="submitLocation()">Ubicar</button>
          </div>
        </div>
      </section>
    `;

    interactionSection.insertAdjacentHTML("beforeend", section);
  } else {
    locationSection.style.display = "grid";
    locationSection.classList.add("active");
  }
}

async function applyLocation({ e, cityName = "Custom", lon, lat, elev }) {
  if (e) {
    const activeButton = document.querySelector(".control-button.active");

    if (activeButton) activeButton.classList.remove("active");
    e.currentTarget.classList.add("active");
  }

  selectedCity = cityName;

  if (cities[cityName]) {
    lon = cities[cityName].lon;
    lat = cities[cityName].lat;
    elev = cities[cityName].elev;
    pollution = cities[cityName].contaminacion;
  } else {
    pollution = await getBortleIndex({ lat, lon });
    console.log("This location calculaterd pollution:", pollution);
  }
  // pollution = cities[cityName] ? cities[cityName].contaminacion : await getBortleIndex({ lat, lon });

  updatePollution();

  const data = {
    cityName: cityName,
    lon,
    lat,
    elev,
    bortle_index: pollution,
  };

  // Protobject.Core.send(data).to("index.html");
}

function updateLocationInputValues(cityName) {
  const data = cities[cityName];
  currentLat = data.lat;
  currentLon = data.lon;
  currentElev = data.elev;

  if (latInput === undefined) {
    latInput = document.querySelector(
      '#locationVariablesContainer input[name="lat"]'
    );

    lonInput = document.querySelector(
      '#locationVariablesContainer input[name="lon"]'
    );

    elevInput = document.querySelector(
      '#locationVariablesContainer input[name="elev"]'
    );
  }

  latInput.value = currentLat;
  lonInput.value = currentLon;
  elevInput.value = currentElev;
}

function submitLocation() {
  if (latInput === undefined) {
    latInput = document.querySelector(
      '#locationVariablesContainer input[name="lat"]'
    );

    lonInput = document.querySelector(
      '#locationVariablesContainer input[name="lon"]'
    );

    elevInput = document.querySelector(
      '#locationVariablesContainer input[name="elev"]'
    );
  }

  const activeButton = document.querySelector(".control-button.active");

  if (activeButton) activeButton.classList.remove("active");

  currentLat = latInput.value;
  currentLon = lonInput.value;
  currentElev = elevInput.value;

  applyLocation({
    lat: currentLat,
    lon: currentLon,
    elev: currentElev,
  });
}
