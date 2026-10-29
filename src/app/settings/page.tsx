"use client";

import { useState, useEffect } from "react";
import {
  Settings,
  Mail,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Key,
  Save,
  Send,
  HelpCircle,
  Trash2,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { TestEmailModal } from "@/components/TestEmailModal";

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);

  // SMTP Form State
  const [smtp, setSmtp] = useState({
    host: "",
    port: 587,
    secure: false,
    user: "",
    pass: "",
    from: "",
    replyTo: "",
    isConfigured: false,
  });

  // Gemini State
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [geminiInfo, setGeminiInfo] = useState({
    isConfigured: false,
    maskedKey: "",
    model: "gemini-2.5-flash",
  });

  const loadSettings = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/settings");
      const data = await res.json();
      if (data.smtp) {
        setSmtp(data.smtp);
      }
      if (data.gemini) {
        setGeminiInfo(data.gemini);
        setGeminiApiKey(data.gemini.maskedKey);
      }
    } catch (err: any) {
      toast.error("Failed to load settings: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleApplyPreset = (preset: string) => {
    if (preset === "gmail") {
      setSmtp({
        ...smtp,
        host: "smtp.gmail.com",
        port: 587,
        secure: false,
      });
      toast.info("Applied Gmail preset (Port 587 with STARTTLS). Use a 16-character App Password.");
    } else if (preset === "gmail-ssl") {
      setSmtp({
        ...smtp,
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
      });
      toast.info("Applied Gmail SSL preset (Port 465 with SSL).");
    } else if (preset === "outlook") {
      setSmtp({
        ...smtp,
        host: "smtp.office365.com",
        port: 587,
        secure: false,
      });
      toast.info("Applied Outlook/Office 365 preset (Port 587).");
    } else if (preset === "zoho") {
      setSmtp({
        ...smtp,
        host: "smtp.zoho.com",
        port: 465,
        secure: true,
      });
      toast.info("Applied Zoho Mail preset (Port 465 with SSL).");
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const payload: any = { smtp };
      if (geminiApiKey && !geminiApiKey.includes("••••")) {
        payload.geminiApiKey = geminiApiKey;
      }

      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save settings.");

      toast.success("Settings securely encrypted and saved!");
      loadSettings();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    try {
      setTesting(true);
      setTestResult(null);
      const res = await fetch("/api/settings/test-smtp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ smtp }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setTestResult({
          success: true,
          message: "SMTP handshake and credentials verified successfully!",
        });
        toast.success("SMTP connection verified!");
      } else {
        setTestResult({
          success: false,
          message: data.error || "SMTP test failed.",
        });
        toast.error("SMTP verification failed.");
      }
    } catch (err: any) {
      setTestResult({ success: false, message: err.message });
    } finally {
      setTesting(false);
    }
  };

  const handleResetData = async (target: string) => {
    const confirmation = prompt(
      `CAUTION: To delete ${target}, type 'CONFIRM_DELETE' below:`
    );
    if (confirmation !== "CONFIRM_DELETE") {
      toast.info("Reset cancelled.");
      return;
    }

    try {
      const res = await fetch("/api/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target, confirmation: "CONFIRM_DELETE" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(data.message);
      loadSettings();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div className="container py-8 max-w-5xl space-y-8">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Email & AI Configuration
        </h1>
        <p className="text-slate-500 text-sm mt-0.5">
          Configure authentic SMTP delivery credentials and Google Gemini API integration. Secrets are encrypted at rest with AES-256-GCM.
        </p>
      </div>

      <form onSubmit={handleSaveSettings} className="space-y-8">
        {/* SMTP Configuration Section */}
        <div className="bg-white rounded-xl border p-6 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
                <Mail className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-bold text-slate-900 text-base">SMTP Mail Server Settings</h2>
                <p className="text-xs text-slate-500">
                  Required for real email dispatch. Compatible with Gmail, Outlook, Zoho, or private mail hosts.
                </p>
              </div>
            </div>

            {/* Presets buttons */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-semibold text-slate-400 mr-1">Presets:</span>
              <button
                type="button"
                onClick={() => handleApplyPreset("gmail")}
                className="px-2 py-1 text-xs font-medium rounded border hover:bg-slate-50 transition"
              >
                Gmail 587
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset("gmail-ssl")}
                className="px-2 py-1 text-xs font-medium rounded border hover:bg-slate-50 transition"
              >
                Gmail 465
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset("outlook")}
                className="px-2 py-1 text-xs font-medium rounded border hover:bg-slate-50 transition"
              >
                Outlook
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset("zoho")}
                className="px-2 py-1 text-xs font-medium rounded border hover:bg-slate-50 transition"
              >
                Zoho
              </button>
            </div>
          </div>

          {/* Test Result Alert */}
          {testResult && (
            <div
              className={`p-4 rounded-lg text-xs flex items-start gap-3 border ${
                testResult.success
                  ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                  : "bg-rose-50 border-rose-200 text-rose-800"
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
              )}
              <div className="leading-relaxed">
                <strong className="block font-semibold mb-0.5">
                  {testResult.success ? "Connection Verified" : "Connection Error Diagnostic"}
                </strong>
                {testResult.message}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                SMTP Host <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="smtp.gmail.com"
                value={smtp.host}
                onChange={(e) => setSmtp({ ...smtp, host: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                SMTP Port <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                placeholder="587"
                value={smtp.port}
                onChange={(e) => setSmtp({ ...smtp, port: Number(e.target.value) })}
                className="w-full px-3 py-2 text-sm rounded-lg border bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Username / Email Address <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="your_email@gmail.com"
                value={smtp.user}
                onChange={(e) => setSmtp({ ...smtp, user: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Password / App Password <span className="text-rose-500">*</span>
              </label>
              <input
                type="password"
                placeholder="16-character App Password"
                value={smtp.pass}
                onChange={(e) => setSmtp({ ...smtp, pass: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <span className="text-[11px] text-slate-400 mt-0.5 block">
                Saved passwords are encrypted with AES-256-GCM.
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                From Name & Email <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="John Doe <john@gmail.com>"
                value={smtp.from}
                onChange={(e) => setSmtp({ ...smtp, from: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Reply-To Email (Optional)
              </label>
              <input
                type="email"
                placeholder="john.doe@personal.com"
                value={smtp.replyTo}
                onChange={(e) => setSmtp({ ...smtp, replyTo: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={smtp.secure}
                onChange={(e) => setSmtp({ ...smtp, secure: e.target.checked })}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
              />
              <span className="text-xs font-medium text-slate-700">
                Use Direct SSL/TLS (True for port 465; leave unchecked for port 587 STARTTLS)
              </span>
            </label>
          </div>

          {/* Test buttons */}
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testing}
                className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 shadow-xs transition disabled:opacity-50"
              >
                <CheckCircle2 className="h-4 w-4 text-blue-600" />
                {testing ? "Testing..." : "Test SMTP Connection"}
              </button>

              <button
                type="button"
                onClick={() => setIsTestModalOpen(true)}
                className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 shadow-xs transition"
              >
                <Send className="h-4 w-4 text-emerald-600" />
                Send Test Email
              </button>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {saving ? "Saving..." : "Save Configuration"}
            </button>
          </div>
        </div>

        {/* Gmail & Provider Configuration Guidance Alert */}
        <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
            <HelpCircle className="h-4 w-4 text-amber-700" />
            Important Provider Authentication Guidance (Gmail, Outlook, Yahoo)
          </div>
          <div className="text-xs text-amber-900/90 space-y-2 leading-relaxed">
            <p>
              <strong>Gmail users:</strong> Google disables direct SMTP login using regular account passwords. You must generate an <strong>App Password</strong>:
            </p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Enable 2-Step Verification on your Google Account (<a href="https://myaccount.google.com/security" target="_blank" rel="noreferrer" className="underline font-semibold text-amber-950">Google Account Security</a>).</li>
              <li>Search for &ldquo;App Passwords&rdquo; in your account search bar.</li>
              <li>Create a new app named &ldquo;Job Outreach&rdquo; and copy the 16-character code.</li>
              <li>Paste that 16-character code into the Password field above.</li>
            </ol>
            <p className="pt-1 text-[11px] text-amber-800">
              Port 587 uses STARTTLS encryption (Secure unchecked). Port 465 uses direct SSL (Secure checked).
            </p>
          </div>
        </div>

        {/* Google Gemini AI Configuration */}
        <div className="bg-white rounded-xl border p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b">
            <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-base">Google Gemini AI Settings</h2>
              <p className="text-xs text-slate-500">
                Powers role-tailored ATS email drafts and cover letters grounded strictly in your resume facts.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Gemini API Key
              </label>
              <input
                type="password"
                placeholder="AIzaSy..."
                value={geminiApiKey}
                onChange={(e) => setGeminiApiKey(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
                <span>Stored securely in encrypted database settings.</span>
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 hover:underline inline-flex items-center gap-0.5"
                >
                  Get free key at Google AI Studio <ExternalLink className="h-2.5 w-2.5" />
                </a>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Active Gemini Model
              </label>
              <input
                type="text"
                disabled
                value={geminiInfo.model}
                className="w-full px-3 py-2 text-sm rounded-lg border bg-slate-100 text-slate-600 cursor-not-allowed"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Configurable via server environment variable <code>GEMINI_MODEL</code>.
              </span>
            </div>
          </div>
        </div>

        {/* Danger Zone: Data Reset */}
        <div className="bg-white rounded-xl border border-rose-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 text-rose-700 font-bold text-sm">
            <Trash2 className="h-4 w-4" />
            Data Retention & Deletion
          </div>
          <p className="text-xs text-slate-500">
            Permanently delete uploaded resumes, imported contacts, or application history from server disk and database.
          </p>

          <div className="flex items-center gap-3 flex-wrap pt-2">
            <button
              type="button"
              onClick={() => handleResetData("contacts")}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 transition"
            >
              Clear Contacts & Drafts
            </button>
            <button
              type="button"
              onClick={() => handleResetData("resumes")}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 transition"
            >
              Clear Uploaded Resumes
            </button>
            <button
              type="button"
              onClick={() => handleResetData("campaigns")}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 transition"
            >
              Clear Campaign History
            </button>
            <button
              type="button"
              onClick={() => handleResetData("all")}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition"
            >
              Reset Entire Application
            </button>
          </div>
        </div>
      </form>

      {/* Test Email Modal */}
      <TestEmailModal
        isOpen={isTestModalOpen}
        onClose={() => setIsTestModalOpen(false)}
        currentSmtpConfig={smtp}
      />
    </div>
  );
}

