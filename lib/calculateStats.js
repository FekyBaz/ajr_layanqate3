function isChild(age) {
  return typeof age === 'number' && age <= 18;
}

function isAdult(age) {
  return typeof age === 'number' && age >= 19 && age <= 60;
}

function isElderly(age) {
  return typeof age === 'number' && age > 60;
}

export function calculateStats(martyrs) {
  return martyrs.reduce(
    (stats, martyr) => {
      stats.total += 1;

      if (martyr.gender === 'm') stats.males += 1;
      if (martyr.gender === 'f') stats.females += 1;

      if (isChild(martyr.age)) stats.children += 1;
      if (isAdult(martyr.age)) stats.adults += 1;
      if (isElderly(martyr.age)) stats.elderly += 1;

      return stats;
    },
    {
      total: 0,
      males: 0,
      females: 0,
      children: 0,
      adults: 0,
      elderly: 0
    }
  );
}
