function openMenu() {
  menu.style.opacity = 1;
  menu.style.zIndex = 1;
}

function closeMenu() {
  menu.style.opacity = 0;
  menu.style.zIndex = -1;
}

function optionSelection(e) {
  // Handle button option
  const activeButton = document.querySelector(
    '#menuContainer .header-container .active'
  );

  if (activeButton && activeButton) {
    activeButton.classList.toggle('active');
  }
  
  e.currentTarget.classList.toggle('active');

  // Handle interaction section
  const activeInteraction = document.querySelectorAll(
    '#interactionSection > .active'
  ).forEach(el => {
    el.classList.remove('active');
    el.style.display = 'none';
  })

  // Clear Datetime Interval
  if (engineUTC !== null) {
    Protobject.Core.send({ setDatetimeInterval: false }).to("index.html");
    engineUTC = null;
  }
}

function displayMainMenu(e) {
  optionSelection(e);

  let mainMenuSection = document.getElementById('mainMenuSection');

  if (!mainMenuSection) {
    let section = `
      <section id="mainMenuSection" class="active" style="display: grid">
        <input 
          type="range"
          min=1
          max=9
          value=${pollution}>
      </section>
    `;

    interactionSection.insertAdjacentHTML("beforeend", section);
    return;
  }

  mainMenuSection.style.display = 'grid';
  mainMenuSection.classList.add('active');
}
