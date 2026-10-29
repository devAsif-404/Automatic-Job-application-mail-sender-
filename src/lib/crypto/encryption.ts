import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function getKey(): Buffer {
  const secret = process.env.APP_ENCRYPTION_KEY || "default-secret-key-must-be-replaced-in-production-env";
  // Always derive a consistent 32-byte buffer using SHA-256
  return crypto.createHash("sha256").update(secret).digest();
}

export interface EncryptedData {
  encryptedValue: string; // hex
  iv: string;             // hex
  authTag: string;        // hex
}

/**
 * Encrypts a string using AES-256-GCM with authenticated tag.
 */
export function encrypt(plaintext: string): EncryptedData {
  if (!plaintext) {
    return { encryptedValue: "", iv: "", authTag: "" };
  }

  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag().toString("hex");

  return {
    encryptedValue: encrypted,
    iv: iv.toString("hex"),
    authTag,
  };
}

/**
 * Decrypts AES-256-GCM ciphertext verifying authentication tag.
 */
export function decrypt(encryptedData: EncryptedData): string {
  if (!encryptedData.encryptedValue || !encryptedData.iv || !encryptedData.authTag) {
    return "";
  }

  try {
    const key = getKey();
    const iv = Buffer.from(encryptedData.iv, "hex");
    const authTag = Buffer.from(encryptedData.authTag, "hex");
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);

    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedData.encryptedValue, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (error) {
    throw new Error("Decryption failed: corrupted data or invalid encryption key.");
  }
}

/**
 * Masks a secret string for safe UI display (e.g. ••••••••)
 */
export function maskSecret(secret: string | null | undefined): string {
  if (!secret) return "";
  return "••••••••";
}

