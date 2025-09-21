function displaySeeingOptions(e) {
  if (optionSelection(e)) return;

  let seeingOptionSection = document.getElementById('seeingOptionSection')

  seeingOptionSection.classList.add('active');
}