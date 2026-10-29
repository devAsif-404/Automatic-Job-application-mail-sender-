import { prisma } from "../db/prisma";
import { decrypt, encrypt } from "../crypto/encryption";
import { SmtpConfig } from "../utils/validation";

/**
 * Loads current SMTP configuration from database AppSetting,
 * falling back to process environment variables.
 */
export async function getActiveSmtpConfig(): Promise<SmtpConfig | null> {
  try {
    const settings = await prisma.appSetting.findMany({
      where: {
        key: {
          in: ["SMTP_HOST", "SMTP_PORT", "SMTP_SECURE", "SMTP_USER", "SMTP_PASS", "EMAIL_FROM", "EMAIL_REPLY_TO"],
        },
      },
    });

    const dbMap: Record<string, string> = {};
    for (const s of settings) {
      if (s.isSecret && s.iv && s.authTag) {
        try {
          dbMap[s.key] = decrypt({ encryptedValue: s.encryptedValue, iv: s.iv, authTag: s.authTag });
        } catch {
          dbMap[s.key] = "";
        }
      } else {
        dbMap[s.key] = s.encryptedValue;
      }
    }

    const host = dbMap.SMTP_HOST || process.env.SMTP_HOST;
    const user = dbMap.SMTP_USER || process.env.SMTP_USER;
    const pass = dbMap.SMTP_PASS || process.env.SMTP_PASS;
    const from = dbMap.EMAIL_FROM || process.env.EMAIL_FROM;
    const port = parseInt(dbMap.SMTP_PORT || process.env.SMTP_PORT || "587", 10);
    const secure = (dbMap.SMTP_SECURE || process.env.SMTP_SECURE || "false") === "true";
    const replyTo = dbMap.EMAIL_REPLY_TO || process.env.EMAIL_REPLY_TO || "";

    if (!host || !user || !pass || !from) {
      return null;
    }

    return {
      host,
      port,
      secure,
      user,
      pass,
      from,
      replyTo,
    };
  } catch (err) {
    console.error("[Settings] Error loading SMTP config from database:", err);
    return null;
  }
}

/**
 * Saves encrypted SMTP configuration to database.
 */
export async function saveSmtpConfig(config: SmtpConfig): Promise<void> {
  const items = [
    { key: "SMTP_HOST", value: config.host, isSecret: false },
    { key: "SMTP_PORT", value: String(config.port), isSecret: false },
    { key: "SMTP_SECURE", value: String(config.secure), isSecret: false },
    { key: "SMTP_USER", value: config.user, isSecret: false },
    { key: "SMTP_PASS", value: config.pass, isSecret: true },
    { key: "EMAIL_FROM", value: config.from, isSecret: false },
    { key: "EMAIL_REPLY_TO", value: config.replyTo || "", isSecret: false },
  ];

  for (const item of items) {
    if (item.isSecret) {
      const encrypted = encrypt(item.value);
      await prisma.appSetting.upsert({
        where: { key: item.key },
        create: {
          key: item.key,
          encryptedValue: encrypted.encryptedValue,
          iv: encrypted.iv,
          authTag: encrypted.authTag,
          isSecret: true,
        },
        update: {
          encryptedValue: encrypted.encryptedValue,
          iv: encrypted.iv,
          authTag: encrypted.authTag,
          isSecret: true,
        },
      });
    } else {
      await prisma.appSetting.upsert({
        where: { key: item.key },
        create: {
          key: item.key,
          encryptedValue: item.value,
          isSecret: false,
        },
        update: {
          encryptedValue: item.value,
          isSecret: false,
        },
      });
    }
  }
}

/**
 * Loads Gemini API key from database or environment.
 */
export async function getActiveGeminiApiKey(): Promise<string> {
  try {
    const setting = await prisma.appSetting.findUnique({
      where: { key: "GEMINI_API_KEY" },
    });
    if (setting && setting.iv && setting.authTag) {
      try {
        const decrypted = decrypt({
          encryptedValue: setting.encryptedValue,
          iv: setting.iv,
          authTag: setting.authTag,
        });
        if (decrypted) return decrypted;
      } catch {}
    }
  } catch {}
  return process.env.GEMINI_API_KEY || "";
}

/**
 * Saves Gemini API key securely to database.
 */
export async function saveGeminiApiKey(apiKey: string): Promise<void> {
  const encrypted = encrypt(apiKey);
  await prisma.appSetting.upsert({
    where: { key: "GEMINI_API_KEY" },
    create: {
      key: "GEMINI_API_KEY",
      encryptedValue: encrypted.encryptedValue,
      iv: encrypted.iv,
      authTag: encrypted.authTag,
      isSecret: true,
    },
    update: {
      encryptedValue: encrypted.encryptedValue,
      iv: encrypted.iv,
      authTag: encrypted.authTag,
      isSecret: true,
    },
  });
}
