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
    "#menuContainer .header-container .active"
  );

  if (activeButton && activeButton != e.currentTarget) {
    activeButton.classList.toggle("active");
    activeButton.style.transform = "translateY(0)"
  }
  
  e.currentTarget.classList.toggle("active");
  e.currentTarget.style.transform = `translateY(10%) scale(0.9)`

  // Handle interaction section
  const activeInteraction = document
    .querySelectorAll("#interactionSection > .active")
    .forEach((el) => {
      el.classList.remove("active");
      el.style.display = "none";
      el.style.transform = "translateY(-100%)"
    });

  if (activeButton == e.currentTarget) {
    interactionSection.style.opacity = 0;
    interactionSection.style.pointerEvents = 'none';
    e.currentTarget.style.transform = "translateY(0)"
  }
  else {
    interactionSection.style.opacity = 1;
    interactionSection.style.pointerEvents = 'auto';

  }

  // Clear Datetime Interval
  if (engineUTC !== null) {
    Protobject.Core.send({
      msg: "setDatetimeInterval",
      values: { active: false },
    }).to("index.html");
    engineUTC = null;
  }
}

function displayMainMenu(e) {
  optionSelection(e);

  let mainMenuSection = document.getElementById("mainMenuSection");

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

    menuInteractionSection.insertAdjacentHTML("beforeend", section);
    return;
  }

  mainMenuSection.style.display = "grid";
  mainMenuSection.classList.add("active");
}
