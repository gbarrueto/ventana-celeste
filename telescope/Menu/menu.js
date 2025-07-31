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
    '.option-button.active'
  );

  if (activeButton) {
    activeButton.classList.remove('active');
  }
  
  e.currentTarget.classList.add('active');

  // Handle interaction section
  const activeInteraction = document.querySelector(
    '#interactionSection .active'
  );

  if (activeInteraction) {
    activeInteraction.classList.remove('active');
    activeInteraction.style.display = 'none';
  }
}
