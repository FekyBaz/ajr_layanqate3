function renderItem(martyr) {
  const ageLabel = martyr.age === null ? 'العمر غير متوفر' : `${martyr.age} سنة`;

  return `
    <li class="martyr-item" data-id="${martyr.id}">
      <h3>${martyr.name}</h3>
      <p>${ageLabel}</p>
    </li>
  `;
}

export function renderMartyrsList(container, martyrs) {
  const listMarkup = martyrs.map(renderItem).join('');

  container.innerHTML = `
    <section class="martyrs-list-section" aria-label="قائمة الشهداء">
      <ul class="martyrs-list">${listMarkup}</ul>
    </section>
  `;
}
