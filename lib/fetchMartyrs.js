const MARTYRS_API_URL = 'https://data.techforpalestine.org/api/v3/killed-in-gaza.min.json';
const MARTYRS_LOCAL_FALLBACK_URL = '/data/martyrs.json';
const CACHE_KEY = 'martyrs_dataset';
const CACHE_TIMESTAMP_KEY = 'martyrs_dataset_timestamp';
const ONE_HOUR_MS = 60 * 60 * 1000;
const RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1500;
const DATASET_LOAD_ERROR_MESSAGE = 'تعذر تحميل بيانات الشهداء حالياً';

let martyrsPromise = null;

function isValidDataset(payload) {
  return Array.isArray(payload) && payload.every((row) => Array.isArray(row) && row.length >= 6);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url, attempts = RETRY_ATTEMPTS) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`فشل تحميل البيانات: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      if (attempt === attempts - 1) throw error;
      await wait(RETRY_DELAY_MS);
    }
  }

  throw new Error(DATASET_LOAD_ERROR_MESSAGE);
}

function normalizeDataset(data) {
  if (!isValidDataset(data)) {
    throw new Error('صيغة بيانات الشهداء غير متوقعة.');
  }

  return data.slice(1);
}

async function fetchLocalFallbackDataset() {
  const response = await fetch(MARTYRS_LOCAL_FALLBACK_URL, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`فشل تحميل النسخة المحلية: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

function getCachedDataset() {
  if (typeof window === 'undefined' || !window.localStorage) return null;

  const rawTimestamp = window.localStorage.getItem(CACHE_TIMESTAMP_KEY);
  const rawDataset = window.localStorage.getItem(CACHE_KEY);

  if (!rawTimestamp || !rawDataset) return null;

  const timestamp = Number(rawTimestamp);
  const isFresh = Number.isFinite(timestamp) && Date.now() - timestamp < ONE_HOUR_MS;

  if (!isFresh) {
    window.localStorage.removeItem(CACHE_KEY);
    window.localStorage.removeItem(CACHE_TIMESTAMP_KEY);
    return null;
  }

  try {
    const parsed = JSON.parse(rawDataset);
    if (isValidDataset(parsed)) return parsed;

    window.localStorage.removeItem(CACHE_KEY);
    window.localStorage.removeItem(CACHE_TIMESTAMP_KEY);
    return null;
  } catch {
    window.localStorage.removeItem(CACHE_KEY);
    window.localStorage.removeItem(CACHE_TIMESTAMP_KEY);
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
      .then(async () => {
        const cachedDataset = getCachedDataset();
        if (cachedDataset) return cachedDataset;

        try {
          const remoteData = await fetchWithRetry(MARTYRS_API_URL);
          const dataset = normalizeDataset(remoteData);
          setCachedDataset(dataset);
          return dataset;
        } catch {
          const localData = await fetchLocalFallbackDataset();
          const dataset = normalizeDataset(localData);
          setCachedDataset(dataset);
          return dataset;
        }
      })
      .catch(() => {
        martyrsPromise = null;
        throw new Error(DATASET_LOAD_ERROR_MESSAGE);
      });
  }

  return martyrsPromise;
}

export { CACHE_KEY, MARTYRS_API_URL, MARTYRS_LOCAL_FALLBACK_URL };
