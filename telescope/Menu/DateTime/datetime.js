function displayDateTime(e) {
  optionSelection(e);

  let datetimeSection = document.getElementById('datetimeSection')

  if (!datetimeSection) {
    let section = `
      <section id="datetimeSection" class="active" style="display: block;">
        <h3>Select Date & Time</h3>

        <div id="datetime-picker" style="margin-bottom: 1rem; width: 100%;"></div>

        <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 1rem;">
          <button class="control-button" onclick="setSpeed(0)">🟥 Stop</button>
          <button class="control-button" onclick="setSpeed(1)">🕒 Realtime</button>
          <button class="control-button" onclick="setSpeed(10)">⏩ 10x</button>
          <button class="control-button" onclick="setSpeed(60)">⏩ 60x</button>
          <button class="control-button" onclick="setSpeed(3600)">⏩ 3600x</button>
        </div>
      </section>
    `;

    interactionSection.innerHTML = section;
  }

  else {
    datetimeSection.style.display = 'block';
    datetimeSection.classList.add('active');
  }

  updateSpeedButtons();
  
  setTimeout(() => {
    showTimeSelector();
    createInterval();
  }, 300);
}

function setSpeed(multiplier) {
  Protobject.Core.send({ speed: multiplier }).to("index.html");
  timeSpeed = multiplier;
  updateSpeedButtons();
}

function updateDate(date) {
  const formatDate = toJulianDateIso(date.toISOString());
  Protobject.Core.send({ date: formatDate }).to("index.html");
}

function createInterval() {
  Protobject.Core.send({ setDatetimeInterval: true }).to("index.html");
}


function toJulianDateIso(iso) {
  const now = new Date(iso);
  const jd = now.getTime() / 86400000 + 2440587.5; // Julian Date
  const mjd = jd - 2400000.5; // Modified Julian Date
  return mjd;
}

// function updateSpeedButtons(e) {
//   const activeButton = document.querySelector(
//     '.control-button.active'
//   )

//   if (activeButton) activeButton.classList.remove('active');
//   e.currentTarget.classList.add('active');
// }

function updateSpeedButtons() {
  document
    .querySelectorAll("#datetimeSection .control-button")
    .forEach((btn) => {
      const text = btn.textContent.trim();

      const match =
        (timeSpeed === 0 && text.startsWith("🟥")) ||
        (timeSpeed === 1 && text.startsWith("🕒")) ||
        (timeSpeed === 10 && text.includes("10x")) ||
        (timeSpeed === 60 && text.includes("60x")) ||
        (timeSpeed === 3600 && text.includes("3600x"));

      btn.classList.toggle("active", match);
    });
}

function fromJulianDateToDate(jd) {
  return new Date((jd - 2440587.5) * 86400000);
}

function fromMJDToDate(mjd) {
  const jd = mjd + 2400000.5;
  return new Date((jd - 2440587.5) * 86400000);
}

function showTimeSelector() {
  activeFlatpickr = flatpickr("#datetime-picker", {
    enableTime: true,
    dateFormat: "Y-m-d\\TH:i:S",
    time_24hr: true,
    defaultDate: new Date(),
    inline: true,
    onOpen: () => (isUserTouchingCalendar = true),
    onClose: () => (isUserTouchingCalendar = false),

    onChange: function (selectedDates) {
      if (selectedDates.length > 0) {
        const date = selectedDates[0];
        lastManualChange = Date.now();
        updateDate(date);
      }
    },

    onValueUpdate: function (selectedDates) {
      if (selectedDates.length > 0) {
        const date = selectedDates[0];
        lastManualChange = Date.now();
        updateDate(date);
      }
    },

    onMonthChange: function (selectedDates) {
      if (selectedDates.length > 0) {
        const date = selectedDates[0];
        lastManualChange = Date.now();
        updateDate(date);
      }
    },

    onYearChange: function (selectedDates) {
      if (selectedDates.length > 0) {
        const date = selectedDates[0];
        lastManualChange = Date.now();
        updateDate(date);
      }
    },
  });

  flatpickrSyncInterval = setInterval(() => {
    if (!activeFlatpickr || !engineUTC) return;

    const now = Date.now();
    const recentlyChanged = now - lastManualChange < 2000;

    if (!isUserTouchingCalendar && !recentlyChanged) {
      const date = fromMJDToDate(engineUTC);
      activeFlatpickr.setDate(date, false);
    }
  }, 300);
}
