function getGenderLabel(gender) {
  if (gender === 'm') return 'ذكر';
  if (gender === 'f') return 'أنثى';
  return 'غير محدد';
}

function getAgeCategory(age) {
  if (typeof age !== 'number') return 'غير محدد';
  if (age <= 18) return 'طفل';
  if (age <= 60) return 'بالغ';
  return 'كبير السن';
}

function getAgeLabel(age) {
  if (typeof age !== 'number') return 'العمر غير متوفر';
  return `${age} سنة`;
}

function getBirthYearLabel(birthYear) {
  if (typeof birthYear !== 'number') return 'تاريخ الميلاد غير متوفر';
  return `مواليد ${birthYear}`;
}

function renderItem(martyr) {
  return `
    <li class="martyr-item" data-id="${martyr.id}">
      <h3 class="martyr-name">${martyr.arabicName}</h3>
      <p class="martyr-meta">${getGenderLabel(martyr.gender)} • ${getAgeCategory(martyr.age)}</p>
      <p class="martyr-age">${getAgeLabel(martyr.age)}</p>
      <p class="martyr-birth-year">${getBirthYearLabel(martyr.birthYear)}</p>
    </li>
  `;
}

export function renderMartyrsList(container, martyrs) {
  const listMarkup = martyrs.map(renderItem).join('');

  container.innerHTML = `
    <section class="martyrs-list-section" aria-label="قائمة الشهداء">
      ${martyrs.length ? `<ul class="martyrs-list">${listMarkup}</ul>` : '<p class="empty-state">لا توجد نتائج مطابقة.</p>'}
    </section>
  `;
}
