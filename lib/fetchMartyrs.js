const MARTYRS_API_URL = 'https://data.techforpalestine.org/api/v3/killed-in-gaza.min.json';
const CACHE_KEY = 'martyrs_dataset';
const CACHE_TIMESTAMP_KEY = 'martyrs_dataset_timestamp';
const CACHE_MAX_AGE_MS = 60 * 60 * 1000;

let martyrsPromise = null;

function isValidDataset(payload) {
  return Array.isArray(payload) && payload.every((row) => Array.isArray(row) && row.length >= 7);
}

function getCachedDataset() {
  if (typeof window === 'undefined' || !window.localStorage) return null;

  const rawTimestamp = window.localStorage.getItem(CACHE_TIMESTAMP_KEY);
  const rawDataset = window.localStorage.getItem(CACHE_KEY);

  if (!rawTimestamp || !rawDataset) return null;

  const timestamp = Number(rawTimestamp);
  const isFresh = Number.isFinite(timestamp) && Date.now() - timestamp <= CACHE_MAX_AGE_MS;

  if (!isFresh) return null;

  try {
    const parsed = JSON.parse(rawDataset);
    return isValidDataset(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function setCachedDataset(dataset) {
  if (typeof window === 'undefined' || !window.localStorage) return;

  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(dataset));
    window.localStorage.setItem(CACHE_TIMESTAMP_KEY, String(Date.now()));
  } catch {
    // Ignore quota / browser storage failures.
  }
}

export async function fetchMartyrs() {
  if (!martyrsPromise) {
    martyrsPromise = Promise.resolve()
      .then(() => {
        const cachedDataset = getCachedDataset();
        if (cachedDataset) return cachedDataset;

        return fetch(MARTYRS_API_URL)
          .then(async (response) => {
            if (!response.ok) {
              throw new Error(`فشل تحميل البيانات: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();

            if (!isValidDataset(data)) {
              throw new Error('صيغة بيانات الشهداء غير متوقعة.');
            }

            const dataset = data.slice(1);
            setCachedDataset(dataset);
            return dataset;
          });
      })
      .catch((error) => {
        martyrsPromise = null;
        throw new Error(`تعذر جلب بيانات الشهداء: ${error.message}`);
      });
  }

  return martyrsPromise;
}

export { CACHE_KEY, MARTYRS_API_URL };
