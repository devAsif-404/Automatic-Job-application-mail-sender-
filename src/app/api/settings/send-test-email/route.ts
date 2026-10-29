import { NextRequest, NextResponse } from "next/server";
import { sendTestEmail } from "@/lib/email/smtp";
import { getActiveSmtpConfig } from "@/lib/settings/config";
import { EmailSchema } from "@/lib/utils/validation";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { recipientEmail, smtp } = body;

    const emailValidation = EmailSchema.safeParse(recipientEmail);
    if (!emailValidation.success) {
      return NextResponse.json({ error: "Invalid test recipient email." }, { status: 400 });
    }

    let configToUse = smtp;
    if (!configToUse || !configToUse.host || !configToUse.pass || configToUse.pass.includes("••••")) {
      const active = await getActiveSmtpConfig();
      if (!active) {
        return NextResponse.json(
          { error: "No active SMTP configuration found. Please save or configure SMTP first." },
          { status: 400 }
        );
      }
      configToUse = {
        ...active,
        ...(configToUse || {}),
        pass: configToUse?.pass && !configToUse.pass.includes("••••") ? configToUse.pass : active.pass,
      };
    }

    const result = await sendTestEmail(configToUse, emailValidation.data);

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: `Test email successfully sent to ${emailValidation.data}!`,
        messageId: result.messageId,
        response: result.response,
      });
    } else {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

