import { db } from './db';

const RP = { name: 'Life OS' };

function rid() {
  // Use the host as RP ID, fallback to localhost for development
  return window.location.hostname || 'localhost';
}

const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));

export async function isBiometricAvailable() {
  if (!window.PublicKeyCredential) return false;
  try {
    return !!(await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable?.());
  } catch {
    return false;
  }
}

export async function enrollBiometric() {
  if (!(await isBiometricAvailable())) throw new Error('unsupported');

  const userId = crypto.getRandomValues(new Uint8Array(16));
  const challenge = crypto.getRandomValues(new Uint8Array(32));

  const cred = await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { id: rid(), ...RP },
      user: { id: userId, name: 'me@life-os', displayName: 'Me' },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 },
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'preferred',
      },
      timeout: 60000,
      attestation: 'none',
    },
  });

  if (!cred) throw new Error('cancelled');

  const id = b64(cred.rawId);

  // Store the credential info separately from main settings
  await db.settings.put({
    id: 'webauthn',
    credentialId: id,
    userId: b64(userId)
  });

  // Also update the main settings flag
  await db.settings.update('main', { biometric: true });

  return true;
}

export async function verifyBiometric() {
  const row = await db.settings.get('webauthn');
  if (!row) return false;

  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const allowCredentials = row.credentialId
    ? [{
        type: 'public-key',
        id: Uint8Array.from(atob(row.credentialId), (c) => c.charCodeAt(0))
      }]
    : [];

  try {
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        timeout: 60000,
        userVerification: 'required',
        rpId: rid(),
        allowCredentials,
      },
    });
    return !!assertion;
  } catch (err) {
    console.error('Biometric verification failed:', err);
    return false;
  }
}

export async function disableBiometric() {
  await db.settings.delete('webauthn');
  await db.settings.update('main', { biometric: false });
}
