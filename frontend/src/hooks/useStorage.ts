const UPLOAD_API = import.meta.env.VITE_UPLOAD_API ?? "http://localhost:3001";

// Global in-memory cache to handle large datasets (>5MB) without blowing localStorage quota
const memoryCache: Map<string, any> = (window as any).__0G_MEMORY_CACHE__ || new Map();
(window as any).__0G_MEMORY_CACHE__ = memoryCache;

// Simple IndexedDB wrapper for large dataset storage (supports gigabytes)
const DB_NAME = "Heda0GStorageDB";
const STORE_NAME = "0g_data_cache";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getFromIndexedDB(key: string): Promise<any> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function setToIndexedDB(key: string, value: any): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.put(value, key);
  } catch {
    /* ignore IndexedDB errors */
  }
}

async function post(base64: string, maxRetries = 4): Promise<string> {
  let lastErr: Error = new Error("Upload failed");
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const res = await fetch(`${UPLOAD_API}/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: base64 }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? res.statusText);
      return json.rootHash;
    } catch (err: any) {
      lastErr = err;
      if (attempt < maxRetries - 1) {
        await new Promise((r) => setTimeout(r, (attempt + 1) * 1000));
      }
    }
  }
  throw lastErr;
}

// Safe base64 encoding for large buffers — spread operator blows stack on >1MB
function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

export async function uploadFile(file: File): Promise<string> {
  const rootHash = await post(toBase64(await file.arrayBuffer()));
  return rootHash;
}

export async function uploadBlob(blob: Blob): Promise<string> {
  const rootHash = await post(toBase64(await blob.arrayBuffer()));
  return rootHash;
}

export async function uploadJson(data: object): Promise<string> {
  const rootHash = await uploadBlob(new Blob([JSON.stringify(data)], { type: "application/json" }));
  cache0GData(rootHash, data);
  return rootHash;
}

export function cache0GData(rootHash: string, data: any) {
  if (!rootHash) return;
  const normHash = rootHash.startsWith("0x") ? rootHash : `0x${rootHash}`;
  const rawHash = rootHash.replace(/^0x/, "");

  // 1. In-memory cache
  memoryCache.set(normHash, data);
  memoryCache.set(rawHash, data);

  // 2. IndexedDB (supports multi-megabyte payloads)
  setToIndexedDB(normHash, data);
  setToIndexedDB(rawHash, data);

  // 3. LocalStorage fallback ONLY for tiny metadata (< 50 KB)
  try {
    const strData = typeof data === "string" ? data : JSON.stringify(data);
    if (strData.length < 50_000) {
      localStorage.setItem(`0g_cache_${normHash}`, strData);
      localStorage.setItem(`0g_cache_${rawHash}`, strData);
    }
  } catch {
    // If quota exceeded, clear old 0g_cache entries to free space
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("0g_cache_")) {
          localStorage.removeItem(key);
        }
      }
    } catch {}
  }
}

export async function fetchFrom0GStorage<T = any>(rootHash: string, maxRetries = 5): Promise<T> {
  if (!rootHash) throw new Error("Empty rootHash");

  const normHash = rootHash.startsWith("0x") ? rootHash : `0x${rootHash}`;
  const rawHash = rootHash.replace(/^0x/, "");

  // 1. In-memory cache check
  if (memoryCache.has(normHash)) return memoryCache.get(normHash);
  if (memoryCache.has(rawHash)) return memoryCache.get(rawHash);

  // 2. IndexedDB check
  const idbCached = (await getFromIndexedDB(normHash)) || (await getFromIndexedDB(rawHash));
  if (idbCached) {
    memoryCache.set(normHash, idbCached);
    return idbCached as T;
  }

  // 3. LocalStorage check
  const cached = localStorage.getItem(`0g_cache_${normHash}`) || localStorage.getItem(`0g_cache_${rawHash}`);
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      memoryCache.set(normHash, parsed);
      return parsed as T;
    } catch {
      memoryCache.set(normHash, cached);
      return cached as any;
    }
  }

  // 4. Remote 0G Storage Network endpoints
  const endpoints = [
    `${UPLOAD_API}/file?root=${normHash}`,
    `${UPLOAD_API}/file?root=${rawHash}`,
    `https://indexer-storage-testnet-turbo.0g.ai/file?root=${normHash}`,
    `https://indexer-storage-testnet-turbo.0g.ai/file?root=${rawHash}`,
    `https://indexer-storage-testnet-standard.0g.ai/file?root=${normHash}`,
    `https://indexer-storage-testnet-standard.0g.ai/file?root=${rawHash}`,
  ];

  let lastError: Error = new Error(`Failed to fetch 0G file ${rootHash}`);

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    for (const endpoint of endpoints) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(endpoint, { signal: controller.signal });
        clearTimeout(timeout);

        if (res.ok) {
          const text = await res.text();
          try {
            const json = JSON.parse(text);
            // 0G Storage Indexer returns {"code":101,"message":"File not found","data":null} with HTTP 200
            if (json && typeof json === "object" && (json.code === 101 || json.message === "File not found" || json.error === "File not found")) {
              throw new Error(`0G Storage: ${json.message || json.error || "File not found"}`);
            }
            cache0GData(normHash, json);
            return json;
          } catch (parseErr: any) {
            if (parseErr.message?.startsWith("0G Storage:")) {
              lastError = parseErr;
              continue;
            }
            cache0GData(normHash, text);
            return text as any;
          }
        }
      } catch (err: any) {
        lastError = err;
      }
    }
    // Wait before retry (exponential backoff: 1s, 2s, 3s, 4s...)
    await new Promise((r) => setTimeout(r, (attempt + 1) * 1000));
  }

  throw lastError;
}
