function displayLocation(e) {
  optionSelection(e);

  let locationSection = document.getElementById('locationSection')

  if (!locationSection) {
    let section = `
      <section id="locationSection" class="active" style="display: grid">
        Location
      </section>
    `;

    interactionSection.innerHTML = section;
    return;
  }

  locationSection.style.display = 'grid';
  locationSection.classList.add('active');
}