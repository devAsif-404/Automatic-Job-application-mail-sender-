import { describe, it, expect } from "vitest";
import { diagnoseSmtpError, sendApplicationEmail } from "@/lib/email/smtp";
import { SmtpConfigSchema } from "@/lib/utils/validation";

describe("SMTP Configuration & Delivery Error Diagnostics", () => {
  it("should validate complete SMTP configuration", () => {
    const valid = {
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      user: "applicant@gmail.com",
      pass: "abcd efgh ijkl mnop",
      from: "Applicant Name <applicant@gmail.com>",
    };

    const parsed = SmtpConfigSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
  });

  it("should map EAUTH error to actionable App Password guidance", () => {
    const err = { code: "EAUTH", message: "535-5.7.8 Username and Password not accepted" };
    const explanation = diagnoseSmtpError(err);

    expect(explanation).toContain("SMTP Authentication Failed");
    expect(explanation).toContain("App-Specific Password");
  });

  it("should map ECONNREFUSED to host/port explanation", () => {
    const err = { code: "ECONNREFUSED", message: "connect ECONNREFUSED 127.0.0.1:587" };
    const explanation = diagnoseSmtpError(err);

    expect(explanation).toContain("SMTP Connection Refused");
    expect(explanation).toContain("verify the SMTP Host and Port");
  });

  it("should map ETIMEDOUT to firewall/ISP guidance", () => {
    const err = { code: "ETIMEDOUT", message: "Connection timed out" };
    const explanation = diagnoseSmtpError(err);

    expect(explanation).toContain("SMTP Connection Timed Out");
  });

  it("should map ESOCKET to TLS/SSL port mismatch guidance", () => {
    const err = { code: "ESOCKET", message: "wrong version number" };
    const explanation = diagnoseSmtpError(err);

    expect(explanation).toContain("TLS/SSL Negotiation Error");
  });

  it("should reject sending when specified resume attachment file does not exist", async () => {
    await expect(
      sendApplicationEmail({
        smtpConfig: {
          host: "localhost",
          port: 587,
          secure: false,
          user: "test@example.com",
          pass: "test",
          from: "test@example.com",
        },
        to: "recruiter@example.com",
        subject: "Test Subject",
        bodyText: "Test Body",
        attachmentPath: "/path/to/nonexistent/resume.pdf",
      })
    ).rejects.toThrow(/Resume attachment file does not exist on server/);
  });
});
