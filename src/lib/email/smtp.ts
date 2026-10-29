import nodemailer from "nodemailer";
import fs from "fs";
import path from "path";
import { SmtpConfig } from "../utils/validation";
import { redactSensitive } from "../utils/sanitize";

export interface SendMailOptions {
  smtpConfig: SmtpConfig;
  to: string;
  toName?: string;
  subject: string;
  bodyText: string;
  attachmentPath?: string;
  attachmentFileName?: string;
  attachmentMimeType?: string;
}

export interface SmtpSendResult {
  success: boolean;
  messageId?: string;
  response?: string;
  errorMessage?: string;
  accepted: string[];
  rejected: string[];
}

/**
 * Creates a configured Nodemailer transporter.
 */
export function createTransporter(config: SmtpConfig) {
  const isPort465 = Number(config.port) === 465;
  const isSecure = config.secure !== undefined ? Boolean(config.secure) : isPort465;

  return nodemailer.createTransport({
    host: config.host,
    port: Number(config.port),
    secure: isSecure, // true for 465, false for 587/25
    auth: {
      user: config.user,
      pass: config.pass,
    },
    tls: {
      // Reject unauthorized in production, allow STARTTLS negotiation
      rejectUnauthorized: process.env.NODE_ENV === "production",
      minVersion: "TLSv1.2",
    },
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    socketTimeout: 30000,
  });
}

/**
 * Maps raw SMTP errors into clear, actionable human-readable explanations.
 */
export function diagnoseSmtpError(error: any): string {
  const code = error?.code || "";
  const msg = String(error?.message || error);

  if (code === "EAUTH" || /auth|535|password|credential/i.test(msg)) {
    return (
      "SMTP Authentication Failed: Your username or password was rejected. " +
      "If you are using Gmail, Yahoo, or Outlook, you CANNOT use your regular login password. " +
      "You must generate and use an App-Specific Password (with 2-Factor Authentication enabled)."
    );
  }

  if (code === "ECONNREFUSED") {
    return (
      "SMTP Connection Refused: The mail server could not be reached at this host/port combination. " +
      "Please verify the SMTP Host and Port (e.g. smtp.gmail.com with port 587 or 465)."
    );
  }

  if (code === "ETIMEDOUT") {
    return (
      "SMTP Connection Timed Out: The server did not respond within the time limit. " +
      "Check your firewall or verify if port 587/465 is blocked by your hosting provider/ISP."
    );
  }

  if (code === "ESOCKET" || /tls|ssl|handshake|cert/i.test(msg)) {
    return (
      "TLS/SSL Negotiation Error: Port/encryption mismatch. " +
      "Ensure 'Secure (SSL)' is set to false for port 587 (STARTTLS) and true for port 465 (SSL)."
    );
  }

  if (code === "EENVELOPE" || /recipient/i.test(msg)) {
    return `SMTP Recipient Error: The destination email address was rejected by the server: ${redactSensitive(msg)}`;
  }

  return `SMTP Error (${code || "UNKNOWN"}): ${redactSensitive(msg)}`;
}

/**
 * Tests connection to the SMTP server.
 */
export async function verifySmtpConnection(config: SmtpConfig): Promise<{ success: boolean; message: string }> {
  try {
    const transporter = createTransporter(config);
    await transporter.verify();
    return { success: true, message: "SMTP connection and credentials verified successfully!" };
  } catch (err: any) {
    return { success: false, message: diagnoseSmtpError(err) };
  }
}

/**
 * Sends a real email with the original resume attached.
 */
export async function sendApplicationEmail(options: SendMailOptions): Promise<SmtpSendResult> {
  const { smtpConfig, to, toName, subject, bodyText, attachmentPath, attachmentFileName, attachmentMimeType } =
    options;

  const transporter = createTransporter(smtpConfig);

  const attachments: nodemailer.SendMailOptions["attachments"] = [];

  // Verify and load resume attachment if specified
  if (attachmentPath) {
    if (!fs.existsSync(attachmentPath)) {
      throw new Error(`Resume attachment file does not exist on server: ${path.basename(attachmentPath)}`);
    }

    const stats = fs.statSync(attachmentPath);
    if (stats.size === 0) {
      throw new Error("Resume attachment file is 0 bytes (empty).");
    }

    attachments.push({
      filename: attachmentFileName || path.basename(attachmentPath),
      path: attachmentPath,
      contentType: attachmentMimeType || "application/pdf",
    });
  }

  const recipientString = toName ? `"${toName.replace(/"/g, "")}" <${to}>` : to;

  try {
    const info = await transporter.sendMail({
      from: smtpConfig.from,
      replyTo: smtpConfig.replyTo || smtpConfig.from,
      to: recipientString,
      subject,
      text: bodyText,
      // Provide clean formatted HTML version alongside plain text
      html: `<div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #1e293b; white-space: pre-wrap;">${bodyText.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>`,
      attachments,
    });

    const acceptedList = Array.isArray(info.accepted) ? info.accepted.map(String) : [];
    const rejectedList = Array.isArray(info.rejected) ? info.rejected.map(String) : [];

    return {
      success: acceptedList.length > 0,
      messageId: info.messageId,
      response: String(info.response || "250 Accepted"),
      accepted: acceptedList,
      rejected: rejectedList,
    };
  } catch (err: any) {
    const diagnostic = diagnoseSmtpError(err);
    return {
      success: false,
      errorMessage: diagnostic,
      accepted: [],
      rejected: [to],
    };
  }
}

/**
 * Sends a live verification test email to confirm end-to-end delivery capability.
 */
export async function sendTestEmail(
  config: SmtpConfig,
  recipientEmail: string
): Promise<{ success: boolean; messageId?: string; response?: string; error?: string }> {
  try {
    const result = await sendApplicationEmail({
      smtpConfig: config,
      to: recipientEmail,
      toName: "Test Recipient",
      subject: "Test Email: AI Job Application Platform Setup Verification",
      bodyText:
        "Congratulations!\n\nYour SMTP configuration is operating properly. " +
        "The AI Job Application Platform has successfully connected to your mail provider " +
        "and delivered this test message.\n\nYou are ready to send personalized job applications.",
    });

    if (result.success) {
      return {
        success: true,
        messageId: result.messageId,
        response: result.response,
      };
    } else {
      return {
        success: false,
        error: result.errorMessage,
      };
    }
  } catch (err: any) {
    return {
      success: false,
      error: diagnoseSmtpError(err),
    };
  }
}
