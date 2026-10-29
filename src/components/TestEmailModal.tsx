"use client";

import { useState } from "react";
import { Mail, Send, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface TestEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSmtpConfig: any;
}

export function TestEmailModal({ isOpen, onClose, currentSmtpConfig }: TestEmailModalProps) {
  const [recipientEmail, setRecipientEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  if (!isOpen) return null;

  const handleSendTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientEmail.trim()) {
      toast.error("Please enter a destination test email address.");
      return;
    }

    try {
      setSending(true);
      setResult(null);

      const res = await fetch("/api/settings/send-test-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientEmail: recipientEmail.trim(),
          smtp: currentSmtpConfig,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setResult({
          success: false,
          message: data.error || "Failed to send test email.",
        });
      } else {
        setResult({
          success: true,
          message: `Test email successfully accepted by SMTP server! Message ID: ${data.messageId}`,
        });
        toast.success("Test email sent!");
      }
    } catch (err: any) {
      setResult({ success: false, message: err.message });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4 animate-in fade-in-50 zoom-in-95">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-blue-50 text-blue-600">
            <Mail className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-base">Send Live Test Email</h3>
            <p className="text-xs text-slate-500">
              Verify your SMTP server configuration by sending an authentic test message.
            </p>
          </div>
        </div>

        {result && (
          <div
            className={`p-3 rounded-lg text-xs flex items-start gap-2 border ${
              result.success
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-rose-50 border-rose-200 text-rose-800"
            }`}
          >
            {result.success ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
            )}
            <div className="leading-relaxed">{result.message}</div>
          </div>
        )}

        <form onSubmit={handleSendTest} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Your Personal Test Recipient Email
            </label>
            <input
              type="email"
              placeholder="e.g. your_personal_email@gmail.com"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Check your inbox (and spam folder) after sending to verify delivery.
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t">
            <button
              type="button"
              onClick={onClose}
              disabled={sending}
              className="px-4 py-2 text-sm font-semibold rounded-lg text-slate-700 hover:bg-slate-100 transition disabled:opacity-50"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={sending}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              {sending ? "Sending Test..." : "Send Test Email"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

