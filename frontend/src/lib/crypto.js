import { db } from './db';

const enc = new TextEncoder();

async function getDeviceKey() {
  let row = await db.settings.get('deviceKey');
  if (row?.key) return row.key;

  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    false, // not extractable — safer
    ['encrypt', 'decrypt']
  );

  await db.settings.put({ id: 'deviceKey', key });
  return key;
}

export async function encryptBlob(blob) {
  const buf = await blob.arrayBuffer();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await getDeviceKey();
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    buf
  );
  return {
    cipher: new Uint8Array(cipher),
    iv,
    type: blob.type
  };
}

export async function decryptBlob(rec) {
  const key = await getDeviceKey();
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: rec.iv },
    key,
    rec.cipher
  );
  return new Blob([plain], { type: rec.type || 'application/octet-stream' });
}

export async function blobToObjectURL(blob) {
  return URL.createObjectURL(blob);
}

export async function hashPin(pin) {
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(pin));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
