export function normalizeData(rawDataset) {
  return rawDataset.map((row) => ({
    id: row[0],
    name: row[2] || row[1] || 'غير معروف',
    age: Number.isFinite(Number(row[3])) ? Number(row[3]) : null,
    gender: row[5] || null
  }));
}
