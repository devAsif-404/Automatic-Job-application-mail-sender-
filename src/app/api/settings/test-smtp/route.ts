import { NextRequest, NextResponse } from "next/server";
import { verifySmtpConnection } from "@/lib/email/smtp";
import { getActiveSmtpConfig } from "@/lib/settings/config";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    let configToTest = body.smtp;

    // If no config or masked password sent, retrieve active config
    if (!configToTest || !configToTest.host || !configToTest.pass || configToTest.pass.includes("••••")) {
      const active = await getActiveSmtpConfig();
      if (!active) {
        return NextResponse.json(
          { error: "No active SMTP settings found. Please fill in all SMTP fields." },
          { status: 400 }
        );
      }
      configToTest = {
        ...active,
        ...(configToTest || {}),
        pass: configToTest?.pass && !configToTest.pass.includes("••••") ? configToTest.pass : active.pass,
      };
    }

    const result = await verifySmtpConnection(configToTest);

    if (result.success) {
      return NextResponse.json({ success: true, message: result.message });
    } else {
      return NextResponse.json({ success: false, error: result.message }, { status: 400 });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

