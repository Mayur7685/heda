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

function toBase64(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

export async function uploadFile(file: File): Promise<string> {
  return post(toBase64(await file.arrayBuffer()));
}

export async function uploadBlob(blob: Blob): Promise<string> {
  return post(toBase64(await blob.arrayBuffer()));
}

export async function uploadJson(data: object): Promise<string> {
  return uploadBlob(new Blob([JSON.stringify(data)], { type: "application/json" }));
}
