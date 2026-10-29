import { describe, it, expect } from "vitest";
import { encrypt, decrypt, maskSecret } from "@/lib/crypto/encryption";
import { redactSensitive } from "@/lib/utils/sanitize";

describe("Cryptography & Secret Security", () => {
  it("should encrypt and decrypt secrets using AES-256-GCM with authentication tag", () => {
    const plainSecret = "SuperSecret_16CharAppPassw0rd!";
    const encrypted = encrypt(plainSecret);

    expect(encrypted.encryptedValue).toBeDefined();
    expect(encrypted.iv).toHaveLength(24); // 12 bytes in hex = 24 chars
    expect(encrypted.authTag).toHaveLength(32); // 16 bytes in hex = 32 chars
    expect(encrypted.encryptedValue).not.toContain(plainSecret);

    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(plainSecret);
  });

  it("should reject tampered ciphertext with authentication error", () => {
    const plainSecret = "AnotherSecret";
    const encrypted = encrypt(plainSecret);

    // Tamper with the ciphertext
    const tampered = {
      ...encrypted,
      encryptedValue: encrypted.encryptedValue.slice(0, -2) + "aa",
    };

    expect(() => decrypt(tampered)).toThrow(/Decryption failed/);
  });

  it("should properly mask secrets for UI exposure prevention", () => {
    expect(maskSecret("my-secret-password")).toBe("••••••••");
    expect(maskSecret("")).toBe("");
  });

  it("should redact API keys and passwords from diagnostic messages", () => {
    const log = "Connecting with pass: mySecretPass123 and token: AIzaSyD98765432101234567890123456789012";
    const redacted = redactSensitive(log);

    expect(redacted).not.toContain("mySecretPass123");
    expect(redacted).toContain("[REDACTED]");
    expect(redacted).toContain("[REDACTED_GEMINI_KEY]");
  });
});

