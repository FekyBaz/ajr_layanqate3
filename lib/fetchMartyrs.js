const MARTYRS_API_URL = 'https://data.techforpalestine.org/api/v3/killed-in-gaza.min.json';

let martyrsPromise = null;

function isValidDataset(payload) {
  return Array.isArray(payload) && payload.every((row) => Array.isArray(row) && row.length >= 7);
}

export async function fetchMartyrs() {
  if (!martyrsPromise) {
    martyrsPromise = fetch(MARTYRS_API_URL)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`فشل تحميل البيانات: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        if (!isValidDataset(data)) {
          throw new Error('صيغة بيانات الشهداء غير متوقعة.');
        }

        return data.slice(1);
      })
      .catch((error) => {
        martyrsPromise = null;
        throw new Error(`تعذر جلب بيانات الشهداء: ${error.message}`);
      });
  }

  return martyrsPromise;
}

export { MARTYRS_API_URL };
