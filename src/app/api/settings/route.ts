import { NextRequest, NextResponse } from "next/server";
import { getActiveSmtpConfig, saveSmtpConfig, saveGeminiApiKey, getActiveGeminiApiKey } from "@/lib/settings/config";
import { maskSecret } from "@/lib/crypto/encryption";
import { SmtpConfigSchema } from "@/lib/utils/validation";

export async function GET() {
  try {
    const config = await getActiveSmtpConfig();
    const geminiKey = await getActiveGeminiApiKey();

    return NextResponse.json({
      smtp: config
        ? {
            host: config.host,
            port: config.port,
            secure: config.secure,
            user: config.user,
            pass: maskSecret(config.pass),
            from: config.from,
            replyTo: config.replyTo || "",
            isConfigured: true,
          }
        : {
            host: "",
            port: 587,
            secure: false,
            user: "",
            pass: "",
            from: "",
            replyTo: "",
            isConfigured: false,
          },
      gemini: {
        isConfigured: Boolean(geminiKey && geminiKey.trim() !== ""),
        maskedKey: geminiKey ? `${geminiKey.slice(0, 4)}••••••••${geminiKey.slice(-4)}` : "",
        model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // If Gemini key provided, save it
    if (body.geminiApiKey && typeof body.geminiApiKey === "string" && !body.geminiApiKey.includes("••••")) {
      await saveGeminiApiKey(body.geminiApiKey.trim());
    }

    // If SMTP fields provided
    if (body.smtp) {
      let passwordToSave = body.smtp.pass;

      // If user kept the masked password, load the existing password from DB/env
      if (!passwordToSave || passwordToSave.includes("••••")) {
        const existing = await getActiveSmtpConfig();
        if (existing?.pass) {
          passwordToSave = existing.pass;
        } else {
          return NextResponse.json({ error: "SMTP password cannot be empty." }, { status: 400 });
        }
      }

      const smtpPayload = {
        host: body.smtp.host,
        port: Number(body.smtp.port),
        secure: Boolean(body.smtp.secure),
        user: body.smtp.user,
        pass: passwordToSave,
        from: body.smtp.from,
        replyTo: body.smtp.replyTo || "",
      };

      const validated = SmtpConfigSchema.parse(smtpPayload);
      await saveSmtpConfig(validated);
    }

    return NextResponse.json({ success: true, message: "Settings saved successfully." });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
