function normalizeGender(gender) {
  if (gender === 'm') return 'm';
  if (gender === 'f') return 'f';
  return null;
}

function normalizeBirthYear(dob) {
  if (typeof dob !== 'string') return null;

  const yearMatch = dob.match(/^(\d{4})/);
  return yearMatch ? Number(yearMatch[1]) : null;
}

export function normalizeData(rawDataset) {
  return rawDataset.map((row) => ({
    id: row[0],
    arabicName: row[2] || row[1] || 'غير معروف',
    age: row[3] === '' || row[3] === undefined || row[3] === null
      ? null
      : (Number.isFinite(Number(row[3])) ? Number(row[3]) : null),
    gender: normalizeGender(row[5]),
    birthDate: row[4] || null,
    birthYear: normalizeBirthYear(row[4])
  }));
}
