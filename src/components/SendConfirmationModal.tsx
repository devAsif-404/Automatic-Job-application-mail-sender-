"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle2, FileText, Send, ShieldAlert } from "lucide-react";

interface SendConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  approvedCount: number;
  approvedDrafts: any[];
  resumeName: string;
  onConfirmBatch: (params: {
    campaignName: string;
    delayMs: number;
    concurrency: number;
  }) => Promise<void>;
}

export function SendConfirmationModal({
  isOpen,
  onClose,
  approvedCount,
  resumeName,
  onConfirmBatch,
}: SendConfirmationModalProps) {
  const [campaignName, setCampaignName] = useState(`Outreach Batch - ${new Date().toLocaleDateString()}`);
  const [delayMs, setDelayMs] = useState(3000);
  const [concurrency, setConcurrency] = useState(2);
  const [confirmed, setConfirmed] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmed) {
      setError("Please check the confirmation box to authorize sending live emails.");
      return;
    }

    try {
      setSending(true);
      setError(null);
      await onConfirmBatch({
        campaignName,
        delayMs,
        concurrency,
      });
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 space-y-5 animate-in fade-in-50 zoom-in-95">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600">
            <Send className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-lg">Confirm Bulk Email Outreach</h3>
            <p className="text-xs text-slate-500">
              Review sending parameters before initiating the SMTP delivery pipeline.
            </p>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Campaign / Batch Name
            </label>
            <input
              type="text"
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* Audit Verification Summary */}
          <div className="p-3.5 bg-slate-50 rounded-lg border space-y-2 text-xs text-slate-700">
            <div className="flex justify-between">
              <span className="text-slate-500">Recipients to Send:</span>
              <strong className="text-blue-700 font-bold">{approvedCount} approved contacts</strong>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Attachment:</span>
              <span className="inline-flex items-center gap-1 font-medium text-slate-900">
                <FileText className="h-3.5 w-3.5 text-blue-600" />
                {resumeName || "Master Resume"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Duplicate Prevention:</span>
              <span className="text-emerald-700 font-medium">Active (skips previously sent contacts)</span>
            </div>
          </div>

          {/* Sending Delay & Concurrency */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Delay Between Emails
              </label>
              <select
                value={delayMs}
                onChange={(e) => setDelayMs(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={2000}>2 seconds (Standard)</option>
                <option value={3000}>3 seconds (Recommended)</option>
                <option value={5000}>5 seconds (Safe / Anti-spam)</option>
                <option value={10000}>10 seconds (Strict limits)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Concurrency Limit
              </label>
              <select
                value={concurrency}
                onChange={(e) => setConcurrency(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={1}>1 connection (Conservative)</option>
                <option value={2}>2 concurrent (Recommended)</option>
                <option value={3}>3 concurrent</option>
              </select>
            </div>
          </div>

          {/* Explicit Confirmation Checkbox */}
          <div className="pt-2 border-t">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
              />
              <span className="text-xs text-slate-600 leading-tight">
                I have inspected the generated emails and approve sending this batch of real messages to the selected HR contacts through my configured SMTP account.
              </span>
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t">
            <button
              type="button"
              onClick={onClose}
              disabled={sending}
              className="px-4 py-2 text-sm font-semibold rounded-lg text-slate-700 hover:bg-slate-100 transition disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={sending || !confirmed}
              className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              {sending ? "Initiating Batch..." : "Start Sending Batch"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

