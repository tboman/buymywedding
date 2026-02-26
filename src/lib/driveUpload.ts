import { googleDriveClientId } from '../firebase';

declare const google: any;

// ── GIS script loader ────────────────────────────────────────
let gisReady = false;
let gisLoading: Promise<void> | null = null;

export function loadGis(): Promise<void> {
  if (gisReady) return Promise.resolve();
  if (gisLoading) return gisLoading;
  gisLoading = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => { gisReady = true; resolve(); };
    script.onerror = () => reject(new Error('Failed to load GIS'));
    document.head.appendChild(script);
  });
  return gisLoading;
}

// ── Token client (singleton) ─────────────────────────────────
let tokenClient: any = null;
let cachedToken: string | null = null;
let tokenExpiry = 0;

function ensureTokenClient() {
  if (tokenClient) return;
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: googleDriveClientId,
    scope: 'https://www.googleapis.com/auth/drive.file',
    callback: () => {}, // overwritten per-request
  });
}

export function getAccessToken(): Promise<string> {
  // Return cached token if still valid (with 60s buffer)
  if (cachedToken && Date.now() < tokenExpiry - 60_000) {
    return Promise.resolve(cachedToken);
  }
  ensureTokenClient();
  return new Promise((resolve, reject) => {
    tokenClient.callback = (response: any) => {
      if (response.error) {
        reject(new Error(response.error));
      } else {
        cachedToken = response.access_token;
        tokenExpiry = Date.now() + response.expires_in * 1000;
        resolve(cachedToken!);
      }
    };
    // prompt:'' = silent if already consented, popup otherwise
    tokenClient.requestAccessToken({ prompt: '' });
  });
}

// ── Drive API helpers ────────────────────────────────────────
export async function uploadToDrive(file: File, token: string): Promise<string> {
  const metadata = { name: file.name, mimeType: file.type };
  const form = new FormData();
  form.append(
    'metadata',
    new Blob([JSON.stringify(metadata)], { type: 'application/json' })
  );
  form.append('file', file);

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
    { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form }
  );
  if (!res.ok) throw new Error(`Upload failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.id as string;
}

export async function makePublic(fileId: string, token: string): Promise<void> {
  await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}/permissions`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'reader', type: 'anyone' }),
    }
  );
}

/** URL suitable for use in <img src> for a publicly-shared Drive file */
export function driveImgUrl(fileId: string): string {
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w800`;
}
