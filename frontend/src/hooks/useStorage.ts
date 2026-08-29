const UPLOAD_API = import.meta.env.VITE_UPLOAD_API ?? "http://localhost:3001";

async function post(base64: string): Promise<string> {
  const res = await fetch(`${UPLOAD_API}/upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: base64 }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? res.statusText);
  return json.rootHash;
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
  const strData = typeof data === "string" ? data : JSON.stringify(data);
  const normHash = rootHash.startsWith("0x") ? rootHash : `0x${rootHash}`;
  const rawHash = rootHash.replace(/^0x/, "");
  try {
    localStorage.setItem(`0g_cache_${normHash}`, strData);
    localStorage.setItem(`0g_cache_${rawHash}`, strData);
  } catch { /* ignore localStorage quota limits */ }
}

export async function fetchFrom0GStorage<T = any>(rootHash: string, maxRetries = 5): Promise<T> {
  if (!rootHash) throw new Error("Empty rootHash");

  const normHash = rootHash.startsWith("0x") ? rootHash : `0x${rootHash}`;
  const rawHash = rootHash.replace(/^0x/, "");

  // Check local storage cache first (both normalized & raw)
  const cached = localStorage.getItem(`0g_cache_${normHash}`) || localStorage.getItem(`0g_cache_${rawHash}`);
  if (cached) {
    try { return JSON.parse(cached); } catch { return cached as any; }
  }

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
            cache0GData(normHash, json);
            return json;
          } catch {
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
