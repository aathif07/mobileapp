export interface EncryptedEnvelope {
  ivHex: string;
  ciphertextBase64: string;
  ciphertextPreview: string;
  encryptedByteLength: number;
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/[^0-9a-f]/gi, '');
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

export function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function generateIdentityKeyPair(): Promise<{
  publicKeyJwk: JsonWebKey;
  privateKeyJwk: JsonWebKey;
}> {
  const pair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey', 'deriveBits']
  );
  const [publicKeyJwk, privateKeyJwk] = await Promise.all([
    crypto.subtle.exportKey('jwk', pair.publicKey),
    crypto.subtle.exportKey('jwk', pair.privateKey),
  ]);
  return { publicKeyJwk, privateKeyJwk };
}

export async function deriveSessionKey(
  localPrivateJwk: JsonWebKey,
  peerPublicJwk: JsonWebKey
): Promise<CryptoKey> {
  const [localPrivate, peerPublic] = await Promise.all([
    crypto.subtle.importKey(
      'jwk',
      localPrivateJwk,
      { name: 'ECDH', namedCurve: 'P-256' },
      false,
      ['deriveBits']
    ),
    crypto.subtle.importKey(
      'jwk',
      peerPublicJwk,
      { name: 'ECDH', namedCurve: 'P-256' },
      false,
      []
    ),
  ]);

  const sharedBits = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: peerPublic },
    localPrivate,
    256
  );

  const hkdfKey = await crypto.subtle.importKey(
    'raw',
    sharedBits,
    { name: 'HKDF' },
    false,
    ['deriveKey']
  );

  const salt = new TextEncoder().encode('PulseLink-LowBW-E2EE-Salt-v1');
  const info = new TextEncoder().encode('PulseLink-Session-AES-GCM-256');

  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt,
      info,
    },
    hkdfKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptBytes(
  sessionKey: CryptoKey,
  payloadBytes: Uint8Array
): Promise<EncryptedEnvelope> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const copy = new Uint8Array(payloadBytes);
  const cipherBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, tagLength: 128 },
    sessionKey,
    copy
  );
  const cipherBytes = new Uint8Array(cipherBuffer);
  const ciphertextBase64 = bytesToBase64(cipherBytes);
  const ivHex = bytesToHex(iv);
  const preview =
    ciphertextBase64.length > 96
      ? `${ciphertextBase64.slice(0, 48)}…${ciphertextBase64.slice(-24)}`
      : ciphertextBase64;

  // Compact PulseLink binary wire frame = 1 byte version/flags + 12 byte IV + ciphertext (includes 16B GCM auth tag) + 5 byte compact header
  const encryptedByteLength = 1 + 12 + 5 + cipherBytes.byteLength;

  return {
    ivHex,
    ciphertextBase64,
    ciphertextPreview: preview,
    encryptedByteLength,
  };
}

export async function decryptBytes(
  sessionKey: CryptoKey,
  ivHex: string,
  ciphertextBase64: string
): Promise<Uint8Array> {
  const iv = new Uint8Array(hexToBytes(ivHex));
  const cipherBytes = new Uint8Array(base64ToBytes(ciphertextBase64));
  const plainBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv, tagLength: 128 },
    sessionKey,
    cipherBytes
  );
  return new Uint8Array(plainBuffer);
}

/**
 * Computes a deterministic, Signal-style 60-digit Safety Number (12 groups of 5 digits)
 * and a 64-cell (8x8) visual verification grid from the SHA-256 digest of both sorted public keys.
 */
export async function computeSafetyNumber(
  pubKeyA: JsonWebKey,
  pubKeyB: JsonWebKey
): Promise<{ safetyNumber: string; safetyGrid: boolean[]; shortFingerprint: string }> {
  const canonicalA = `${pubKeyA.x ?? ''}.${pubKeyA.y ?? ''}`;
  const canonicalB = `${pubKeyB.x ?? ''}.${pubKeyB.y ?? ''}`;
  const combined =
    canonicalA < canonicalB
      ? `${canonicalA}|${canonicalB}`
      : `${canonicalB}|${canonicalA}`;

  const baseBytes = new TextEncoder().encode(combined);
  // Two chained SHA-256 rounds give 64 bytes -> plenty of entropy for 60 decimal digits
  const digest1 = new Uint8Array(await crypto.subtle.digest('SHA-256', baseBytes));
  const round2Input = new Uint8Array(digest1.length + baseBytes.length);
  round2Input.set(digest1, 0);
  round2Input.set(baseBytes, digest1.length);
  const digest2 = new Uint8Array(await crypto.subtle.digest('SHA-256', round2Input));

  const fullHash = new Uint8Array(64);
  fullHash.set(digest1, 0);
  fullHash.set(digest2, 32);

  const blocks: string[] = [];
  for (let i = 0; i < 12; i++) {
    const offset = i * 5;
    const num =
      ((fullHash[offset] << 24) >>> 0) +
      (fullHash[offset + 1] << 16) +
      (fullHash[offset + 2] << 8) +
      fullHash[offset + 3];
    const fiveDigits = String(num % 100000).padStart(5, '0');
    blocks.push(fiveDigits);
  }

  // Symmetric 8x8 visual verification matrix (4x8 mirrored horizontally like an identicon)
  const grid: boolean[] = new Array(64).fill(false);
  for (let row = 0; row < 8; row++) {
    const byte = digest1[row];
    for (let col = 0; col < 4; col++) {
      const bit = Boolean((byte >> col) & 1);
      grid[row * 8 + col] = bit;
      grid[row * 8 + (7 - col)] = bit;
    }
  }

  const shortFingerprint = bytesToHex(digest1.slice(0, 4)).toUpperCase();

  return {
    safetyNumber: blocks.join(' '),
    safetyGrid: grid,
    shortFingerprint,
  };
}
