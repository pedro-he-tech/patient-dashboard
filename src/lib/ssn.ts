import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

/**
 * Social Security numbers are stored as three pieces:
 *
 * - `ssn_encrypted`: AES-256-GCM ciphertext. The database never sees the digits.
 * - `ssn_last4`: the only plaintext fragment, used for masked display (`***-**-1234`)
 *   and for search. The full number is not searchable.
 * - `ssn_hash`: HMAC-SHA256 of the nine digits. Duplicate detection compares
 *   hashes, so it does not need the encryption key and a stolen table cannot
 *   be brute-forced with a plain SHA-256 (there are only a billion possible SSNs).
 *
 * The ciphertext layout is `iv (12 bytes) || auth tag (16 bytes) || ciphertext`.
 * Callers pass the number in any common written form; only the digits are stored.
 */

const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

export type StoredSsn = {
  ssnEncrypted: Buffer;
  ssnLast4: string;
  ssnHash: string;
};

function keyFromEnv(name: string): Buffer {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set. Copy .env.example to .env.`);
  }

  const key = Buffer.from(value, "base64");
  if (key.length !== KEY_LENGTH) {
    throw new Error(
      `${name} must decode to ${KEY_LENGTH} bytes. Generate one with: openssl rand -base64 32`,
    );
  }

  return key;
}

function encryptionKey(): Buffer {
  return keyFromEnv("SSN_ENCRYPTION_KEY");
}

function hmacKey(): Buffer {
  const key = keyFromEnv("SSN_HMAC_KEY");
  const other = encryptionKey();
  // One key for confidentiality and a different key for the lookup hash.
  // Reusing the encryption key would couple the two and make rotation harder.
  if (timingSafeEqual(key, other)) {
    throw new Error("SSN_HMAC_KEY must be different from SSN_ENCRYPTION_KEY.");
  }
  return key;
}

/** Digits only, so `900-12-3456` and `900123456` are the same number. */
export function normalizeSsn(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 9) {
    throw new Error("An SSN must contain exactly 9 digits.");
  }
  return digits;
}

export function hashSsn(value: string): string {
  const digits = normalizeSsn(value);
  return createHmac("sha256", hmacKey()).update(digits).digest("hex");
}

export function encryptSsn(value: string): Buffer {
  const digits = normalizeSsn(value);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(digits, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]);
}

/** Used to confirm a ciphertext round-trips. API responses never include this. */
export function decryptSsn(payload: Buffer): string {
  if (payload.length <= IV_LENGTH + TAG_LENGTH) {
    throw new Error("Stored SSN payload is truncated.");
  }

  const iv = payload.subarray(0, IV_LENGTH);
  const tag = payload.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = payload.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}

export function storeSsn(value: string): StoredSsn {
  const digits = normalizeSsn(value);
  return {
    ssnEncrypted: encryptSsn(digits),
    ssnLast4: digits.slice(-4),
    ssnHash: hashSsn(digits),
  };
}
