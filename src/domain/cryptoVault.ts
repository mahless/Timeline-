import { bytesToBase64, base64ToBytes } from './backup';

export interface PinHashRecord {
  hashBase64: string;
  saltBase64: string;
}

export interface EncryptedBackupEnvelope {
  format: 'timeline-encrypted-backup';
  version: 1;
  kdf: 'PBKDF2-SHA256';
  iterations: number;
  salt: string;
  iv: string;
  ciphertext: string;
}

const PIN_ITERATIONS = 100_000;

function getSubtle(): SubtleCrypto {
  const cryptoObj = globalThis.crypto;
  if (!cryptoObj || !cryptoObj.subtle) {
    throw new Error('المتصفح لا يدعم واجهة التشفير القياسية (Web Crypto API).');
  }
  return cryptoObj.subtle;
}

function getRandomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  return bytes;
}

async function deriveAesKey(
  passphrase: string,
  salt: Uint8Array,
  iterations: number,
): Promise<CryptoKey> {
  const subtle = getSubtle();
  const encoder = new TextEncoder();
  const baseKey = await subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  );

  return subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function hashPin(pin: string, existingSaltBase64?: string): Promise<PinHashRecord> {
  const trimmed = pin.trim();
  if (!/^\d{4,8}$/.test(trimmed)) {
    throw new Error('يجب أن يتكون رمز القفل من 4 إلى 8 أرقام.');
  }
  const subtle = getSubtle();
  const salt = existingSaltBase64 ? base64ToBytes(existingSaltBase64) : getRandomBytes(16);
  const encoder = new TextEncoder();

  const keyMaterial = await subtle.importKey(
    'raw',
    encoder.encode(trimmed),
    'PBKDF2',
    false,
    ['deriveBits'],
  );

  const bits = await subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: PIN_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    256,
  );

  return {
    hashBase64: bytesToBase64(new Uint8Array(bits)),
    saltBase64: bytesToBase64(salt),
  };
}

export async function verifyPin(
  pin: string,
  storedHashBase64: string,
  saltBase64: string,
): Promise<boolean> {
  if (!/^\d{4,8}$/.test(pin.trim())) return false;
  const computed = await hashPin(pin, saltBase64);
  if (computed.hashBase64.length !== storedHashBase64.length) return false;
  let diff = 0;
  for (let i = 0; i < computed.hashBase64.length; i++) {
    diff |= computed.hashBase64.charCodeAt(i) ^ storedHashBase64.charCodeAt(i);
  }
  return diff === 0;
}

export function isEncryptedBackupEnvelope(raw: unknown): raw is EncryptedBackupEnvelope {
  if (!raw || typeof raw !== 'object') return false;
  const obj = raw as Partial<EncryptedBackupEnvelope>;
  return (
    obj.format === 'timeline-encrypted-backup' &&
    obj.version === 1 &&
    typeof obj.salt === 'string' &&
    typeof obj.iv === 'string' &&
    typeof obj.ciphertext === 'string'
  );
}

export async function encryptBackupPayload(
  plaintextJson: string,
  passphrase: string,
): Promise<EncryptedBackupEnvelope> {
  if (passphrase.trim().length < 4) {
    throw new Error('كلمة مرور التشفير يجب أن تكون 4 أحرف على الأقل.');
  }
  const subtle = getSubtle();
  const salt = getRandomBytes(16);
  const iv = getRandomBytes(12);
  const key = await deriveAesKey(passphrase, salt, PIN_ITERATIONS);

  const encoded = new TextEncoder().encode(plaintextJson);
  const encrypted = await subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    encoded,
  );

  return {
    format: 'timeline-encrypted-backup',
    version: 1,
    kdf: 'PBKDF2-SHA256',
    iterations: PIN_ITERATIONS,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(encrypted)),
  };
}

export async function decryptBackupPayload(
  envelope: EncryptedBackupEnvelope,
  passphrase: string,
): Promise<string> {
  if (!passphrase) {
    throw new Error('يرجى إدخال كلمة مرور فك التشفير.');
  }
  const subtle = getSubtle();
  const salt = base64ToBytes(envelope.salt);
  const iv = base64ToBytes(envelope.iv);
  const ciphertext = base64ToBytes(envelope.ciphertext);
  const key = await deriveAesKey(passphrase, salt, envelope.iterations || PIN_ITERATIONS);

  try {
    const decrypted = await subtle.decrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      key,
      ciphertext as BufferSource,
    );
    return new TextDecoder().decode(decrypted);
  } catch {
    throw new Error('كلمة مرور فك التشفير غير صحيحة أو الملف تالف.');
  }
}
